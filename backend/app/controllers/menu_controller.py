
from __future__ import annotations

import base64
import binascii
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from pymongo.database import Database

from app.schemas import DishUpdateSchema
from app.services.dish_explanation_service import generate_dish_explanation
from app.services.menu_service import MenuService
from app.services.dish_image_service import find_dish_images, is_unsplash_image

logger = logging.getLogger(__name__)

menu_service = MenuService()


def _menu_collection(db: Database):
    return db.menus


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _as_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return str(value)


def _as_string_list(value: Any) -> list[str]:
    if value is None:
        return []

    if isinstance(value, str):
        return [value] if value.strip() else []

    if isinstance(value, (list, tuple, set)):
        return [
            str(item).strip()
            for item in value
            if item is not None and str(item).strip()
        ]

    return []


def _strip_internal_fields(
    document: dict[str, Any] | None,
) -> dict[str, Any] | None:
    """Remove MongoDB internal IDs from a document and embedded dishes."""
    if document is None:
        return None

    cleaned = dict(document)
    cleaned.pop("_id", None)

    dishes = cleaned.get("dishes")
    if isinstance(dishes, list):
        cleaned["dishes"] = [
            {
                key: value
                for key, value in dish.items()
                if key != "_id"
            }
            for dish in dishes
            if isinstance(dish, dict)
        ]

    return cleaned


def _get_menu(db: Database, menu_id: str) -> dict[str, Any]:
    menu = _menu_collection(db).find_one(
        {"id": menu_id},
        {"_id": 0},
    )

    if not menu:
        raise HTTPException(
            status_code=404,
            detail=f"Menu with ID '{menu_id}' not found",
        )

    legacy = [dish for dish in menu.get("dishes", []) if isinstance(dish, dict)
              and (is_unsplash_image(dish.get("image_url")) or is_unsplash_image(dish.get("photo"))
                   or not (dish.get("image_url") or dish.get("photo")))]
    if legacy:
        with ThreadPoolExecutor(max_workers=min(4, len(legacy))) as pool:
            results = list(pool.map(lambda dish: find_dish_images(dish.get("name") or "", dish.get("cuisine") or dish.get("category")), legacy))
        for dish, images in zip(legacy, results):
            image = images[0] if images else {}
            dish.update(reference_images=images, image_url=image.get("url"), photo=image.get("url"),
                        image_source_url=image.get("source_url"), image_source=image.get("source"),
                        image_provider=image.get("provider"))
        try:
            _persist_menu(db, menu_id, {"dishes": menu["dishes"]})
        except Exception:
            logger.warning("Unable to persist refreshed menu photos for %s", menu_id)
    return menu


def _persist_menu(
    db: Database,
    menu_id: str,
    menu: dict[str, Any],
) -> None:
    """Persist the supplied menu and detect missing records or failed writes."""
    result = _menu_collection(db).update_one(
        {"id": menu_id},
        {"$set": menu},
    )

    if getattr(result, "matched_count", 1) == 0:
        raise HTTPException(
            status_code=404,
            detail=f"Menu with ID '{menu_id}' not found",
        )


def upload_menu(
    db: Database,
    file_name_or_files: str | list[tuple[str, bytes, str | None]],
    file_bytes: bytes | None = None,
    restaurant_name: str | None = None,
) -> dict[str, Any]:
    """Create a menu from one uploaded file or multiple uploaded files."""
    try:
        menu = menu_service.build_menu_document(
            restaurant_name=restaurant_name,
            file_name_or_files=file_name_or_files,
            file_bytes=file_bytes,
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Failed to process uploaded menu")
        raise HTTPException(
            status_code=502,
            detail="Unable to process the uploaded menu.",
        ) from exc

    if not isinstance(menu, dict):
        raise HTTPException(
            status_code=502,
            detail="Menu processing returned an invalid response.",
        )

    document = dict(menu)

    if not document.get("id"):
        raise HTTPException(
            status_code=500,
            detail="Menu processing did not generate a menu ID.",
        )

    try:
        _menu_collection(db).insert_one(document)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to save uploaded menu")
        raise HTTPException(
            status_code=500,
            detail="The menu was processed but could not be saved.",
        ) from exc

    return _strip_internal_fields(document) or {}


def list_menus(db: Database) -> list[dict[str, Any]]:
    """Return concise menu summaries, newest first when timestamps exist."""
    menus = list(_menu_collection(db).find({}, {"_id": 0}))

    def sort_key(menu: dict[str, Any]) -> str:
        return _as_text(menu.get("created_at"))

    menus.sort(key=sort_key, reverse=True)

    summaries: list[dict[str, Any]] = []

    for menu in menus:
        dishes = menu.get("dishes")
        source_files = menu.get("source_files")

        summaries.append({
            "id": menu.get("id"),
            "restaurant_name": menu.get("restaurant_name"),
            "menu_name": menu.get("menu_name"),
            "status": menu.get("status"),
            "dish_count": len(dishes) if isinstance(dishes, list) else 0,
            "source_files_count": (
                len(source_files) if isinstance(source_files, list) else 0
            ),
            "created_at": menu.get("created_at"),
            "updated_at": menu.get("updated_at"),
        })

    return summaries


def get_menu(db: Database, menu_id: str) -> dict[str, Any]:
    return _strip_internal_fields(_get_menu(db, menu_id)) or {}


def list_menu_dishes(
    db: Database,
    menu_id: str,
    q: str | None = None,
    category: str | None = None,
    dietary: str | None = None,
) -> list[dict[str, Any]]:
    """Filter the dishes belonging to a particular menu."""
    menu = _get_menu(db, menu_id)
    dishes = menu.get("dishes", [])

    if not isinstance(dishes, list):
        dishes = []

    if q and q.strip():
        needle = q.strip().casefold()

        def matches_query(dish: dict[str, Any]) -> bool:
            searchable = [
                _as_text(dish.get("name")),
                _as_text(dish.get("description")),
                *_as_string_list(dish.get("ingredients")),
            ]
            return any(needle in value.casefold() for value in searchable)

        dishes = [
            dish for dish in dishes
            if isinstance(dish, dict) and matches_query(dish)
        ]

    if category and category.strip() and category.strip().casefold() != "all":
        category_value = category.strip().casefold()
        dishes = [
            dish for dish in dishes
            if isinstance(dish, dict)
            and _as_text(dish.get("category")).strip().casefold()
            == category_value
        ]

    if dietary and dietary.strip() and dietary.strip().casefold() != "all":
        dietary_value = dietary.strip().casefold()
        dishes = [
            dish for dish in dishes
            if isinstance(dish, dict)
            and any(
                label.casefold() == dietary_value
                for label in _as_string_list(dish.get("dietary_labels"))
            )
        ]

    return [
        _strip_internal_fields(dish) or {}
        for dish in dishes
        if isinstance(dish, dict)
    ]


def get_menu_dish(
    db: Database,
    menu_id: str,
    dish_id: str,
) -> dict[str, Any]:
    menu = _get_menu(db, menu_id)

    for dish in menu.get("dishes", []):
        if isinstance(dish, dict) and dish.get("id") == dish_id:
            return _strip_internal_fields(dish) or {}

    raise HTTPException(
        status_code=404,
        detail=f"Dish with ID '{dish_id}' not found in menu '{menu_id}'",
    )


def update_menu_dish(
    db: Database,
    menu_id: str,
    dish_id: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Validate and update a dish, then invalidate its cached explanation."""
    menu = _get_menu(db, menu_id)

    if not isinstance(payload, dict) or not payload:
        raise HTTPException(
            status_code=422,
            detail="Provide at least one field to update.",
        )

    try:
        update_data = DishUpdateSchema(
            **payload
        ).model_dump(exclude_unset=True)
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail="Invalid dish update payload.",
        ) from exc

    if not update_data:
        raise HTTPException(
            status_code=422,
            detail="No valid fields were provided for update.",
        )

    dishes = menu.get("dishes", [])

    for index, original_dish in enumerate(dishes):
        if not isinstance(original_dish, dict):
            continue

        if original_dish.get("id") != dish_id:
            continue

        dish = dict(original_dish)

        for key, value in update_data.items():
            # Explicit null values are retained when the schema permits them.
            dish[key] = value

        if "name" in update_data and dish.get("name") != original_dish.get("name"):
            images = find_dish_images(dish.get("name") or "", dish.get("cuisine") or dish.get("category"))
            image = images[0] if images else {}
            dish.update(reference_images=images, image_url=image.get("url"), photo=image.get("url"),
                        image_source_url=image.get("source_url"), image_source=image.get("source"),
                        image_provider=image.get("provider"))

        # Any edit can affect the explanation, so discard stale cached content.
        dish.pop("explanation_cache", None)
        dish["is_user_corrected"] = True
        dishes[index] = dish

        menu["dishes"] = dishes
        menu["updated_at"] = _now_iso()

        _persist_menu(db, menu_id, {"dishes": dishes, "updated_at": menu["updated_at"]})

        return _strip_internal_fields(dish) or {}

    raise HTTPException(
        status_code=404,
        detail=f"Dish with ID '{dish_id}' not found in menu '{menu_id}'",
    )


def scan_menu_image(
    db: Database,
    menu_id: str,
    file_name: str,
    file_bytes: bytes,
) -> list[dict[str, Any]]:
    """Match an uploaded dish image against the menu's dishes."""
    if not file_bytes:
        raise HTTPException(
            status_code=400,
            detail="The uploaded image is empty.",
        )

    menu = _get_menu(db, menu_id)
    dishes = menu.get("dishes", [])

    if not dishes:
        return []

    try:
        matches = menu_service.match_scanned_dish(
            dishes,
            file_name,
            file_bytes,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to match scanned dish against menu %s", menu_id)
        raise HTTPException(
            status_code=502,
            detail="Unable to analyse the dish image.",
        ) from exc

    if not matches:
        return []

    return [
        _strip_internal_fields(match) or {}
        for match in matches
        if isinstance(match, dict)
    ]


def explain_dish(
    db: Database,
    menu_id: str,
    dish_id: str,
) -> dict[str, Any]:
    """Return a cached explanation or generate and persist a new one."""
    menu = _get_menu(db, menu_id)
    dishes = menu.get("dishes", [])

    target_index = next(
        (
            index
            for index, dish in enumerate(dishes)
            if isinstance(dish, dict) and dish.get("id") == dish_id
        ),
        -1,
    )

    if target_index < 0:
        raise HTTPException(
            status_code=404,
            detail=f"Dish with ID '{dish_id}' not found in menu",
        )

    target_dish = dishes[target_index]
    cached = target_dish.get("explanation_cache")

    # Check cache BEFORE calling the AI service.
    if isinstance(cached, dict) and cached and "images" in cached:
        return {**cached, "cached": True}

    try:
        explanation_schema = generate_dish_explanation(
            dish=target_dish,
            all_menu_dishes=dishes,
            source_menu_name=menu.get("restaurant_name"),
        )
        explanation_dict = explanation_schema.model_dump()
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(
            "Failed to generate explanation for dish %s in menu %s",
            dish_id,
            menu_id,
        )
        raise HTTPException(
            status_code=502,
            detail="Unable to generate the dish explanation. Please try again.",
        ) from exc

    explanation_dict["images"] = target_dish.get("reference_images") or find_dish_images(target_dish.get("name") or "", target_dish.get("cuisine"))
    target_dish["explanation_cache"] = explanation_dict
    dishes[target_index] = target_dish

    try:
        _persist_menu(db, menu_id, {"dishes": dishes, "updated_at": _now_iso()})
    except HTTPException:
        raise
    except Exception as exc:
        # The generated explanation can still be returned even if caching fails.
        logger.exception(
            "Explanation generated but cache persistence failed for dish %s",
            dish_id,
        )

    return explanation_dict


def retry_menu_processing(
    db: Database,
    menu_id: str,
    file_name: str | None = None,
    file_bytes: bytes | None = None,
) -> dict[str, Any]:
    """Reprocess a menu using a newly supplied file or stored source files."""
    menu = _get_menu(db, menu_id)

    if file_bytes is not None:
        if not file_bytes:
            raise HTTPException(
                status_code=400,
                detail="The supplied retry file is empty.",
            )
        if not file_name:
            raise HTTPException(
                status_code=400,
                detail="A filename is required when supplying a retry file.",
            )

        files_to_process: str | list[tuple[str, bytes, str | None]] = file_name
        bytes_to_process: bytes | None = file_bytes

    else:
        source_files = menu.get("source_files", [])
        if not isinstance(source_files, list) or not source_files:
            raise HTTPException(
                status_code=400,
                detail=(
                    "The original menu file is unavailable. "
                    "Please upload the menu file again to retry processing."
                ),
            )

        reconstructed_files: list[tuple[str, bytes, str | None]] = []

        for source in source_files:
            if not isinstance(source, dict):
                continue

            encoded = source.get("data_base64")
            if not encoded:
                continue

            try:
                content = base64.b64decode(encoded, validate=True)
            except (binascii.Error, ValueError) as exc:
                logger.warning(
                    "Skipping invalid stored source file for menu %s",
                    menu_id,
                )
                continue

            if not content:
                continue

            reconstructed_files.append((
                source.get("name") or "menu.jpg",
                content,
                source.get("content_type"),
            ))

        if not reconstructed_files:
            raise HTTPException(
                status_code=400,
                detail=(
                    "No usable original menu files are stored. "
                    "Please upload the menu file again to retry processing."
                ),
            )

        files_to_process = reconstructed_files
        bytes_to_process = None

    try:
        fresh = menu_service.build_menu_document(
            restaurant_name=menu.get("restaurant_name"),
            file_name_or_files=files_to_process,
            file_bytes=bytes_to_process,
            existing_menu_id=menu_id,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to retry processing menu %s", menu_id)
        raise HTTPException(
            status_code=502,
            detail="Menu reprocessing failed. Please try again.",
        ) from exc

    if not isinstance(fresh, dict):
        raise HTTPException(
            status_code=502,
            detail="Menu reprocessing returned an invalid response.",
        )

    document = dict(fresh)
    document["id"] = menu_id
    document.setdefault("created_at", menu.get("created_at"))
    document["updated_at"] = _now_iso()

    # Preserve the original source files if the processing service omitted them.
    if not document.get("source_files") and menu.get("source_files"):
        document["source_files"] = menu["source_files"]

    _persist_menu(db, menu_id, document)

    return _strip_internal_fields(document) or {}
