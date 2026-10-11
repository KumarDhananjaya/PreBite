import re
from typing import Any

from fastapi import HTTPException
from pymongo.database import Database

from app.services.gemini_service import analyze_menu_image, enrich_dish_record


def _tokenize(text: str | None) -> list[str]:
    """Convert text into lowercase alphanumeric tokens."""
    return re.findall(r"[a-z0-9]+", (text or "").lower())


def _normalize_name(value: str | None) -> str:
    """Normalize dish names for comparison."""
    return " ".join(_tokenize(value))


def _as_string_list(value: Any) -> list[str]:
    """Normalize a value into a list of strings."""
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


def _best_catalog_match(
    name: str,
    dishes: list[dict],
    minimum_score: float = 0.65,
) -> dict | None:
    """
    Return a sufficiently similar catalog dish, or None.

    Exact normalized matches are preferred. Partial matches are accepted
    only when their token overlap is strong enough.
    """
    wanted = _normalize_name(name)
    if not wanted:
        return None

    wanted_tokens = set(wanted.split())
    if not wanted_tokens:
        return None

    best_match: dict | None = None
    best_score = 0.0

    for dish in dishes:
        candidate = _normalize_name(dish.get("name"))
        if not candidate:
            continue

        if candidate == wanted:
            return dish

        candidate_tokens = set(candidate.split())

        # Avoid treating short names as matches for unrelated longer names.
        intersection = wanted_tokens & candidate_tokens
        precision = len(intersection) / len(wanted_tokens)
        recall = len(intersection) / len(candidate_tokens)
        token_score = (
            2 * precision * recall / (precision + recall)
            if precision + recall
            else 0.0
        )

        # Allow a complete multiword name to match when the catalog name
        # is contained in the extracted name, but require substantial overlap.
        if wanted in candidate or candidate in wanted:
            token_score = max(token_score, 0.85)

        if token_score > best_score:
            best_score = token_score
            best_match = dish

    if best_score < minimum_score:
        return None

    return best_match


def _fallback_matches_from_file_name(file_name: str | None, dishes: list[dict]) -> list[dict]:
    """When an uploaded file is not a real image payload, still rank dishes by the file name."""
    if not file_name:
        return []

    stem = re.sub(r"\.[A-Za-z0-9]+$", "", file_name)
    tokens = re.findall(r"[a-z0-9]+", stem.lower().replace("_", " "))
    if not tokens:
        return []

    scored: list[tuple[float, dict]] = []
    for dish in dishes:
        name = str(dish.get("name") or "")
        normalized = _normalize_name(name)
        if not normalized:
            continue

        score = 0.0
        for token in tokens:
            if not token:
                continue
            if token == normalized:
                score = max(score, 1.0)
            elif token in normalized:
                score = max(score, 0.8)
            elif any(token in part for part in normalized.split()):
                score = max(score, 0.6)

        if score > 0:
            scored.append((score, {
                "name": name,
                "summary": dish.get("description") or name,
                "explanation": dish.get("familiarity_bridge") or dish.get("description") or name,
                "ingredients": _as_string_list(dish.get("ingredients")),
                "dietary_flags": _as_string_list(dish.get("dietary_flags")),
                "confidence": min(0.95, 0.55 + score * 0.35),
                "photo": dish.get("image_url"),
            }))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [item[1] for item in scored[:5]]


def _menu_response_from_dish(
    dish: dict,
    extra: dict | None = None,
) -> dict:
    """Build a consistent menu-dish response."""
    item = dict(dish)

    if extra:
        item.update(extra)

    description = (
        item.get("description")
        or item.get("summary")
        or item.get("explanation")
        or ""
    )

    summary = (
        item.get("summary")
        or item.get("gemini_summary")
        or description
    )

    explanation = (
        item.get("explanation")
        or item.get("dish_story")
        or item.get("familiarity_bridge")
        or description
    )

    confidence = item.get("confidence")
    if confidence is None:
        confidence = item.get("gemini_confidence")
    if confidence is None:
        confidence = 0.8

    dietary_notes = item.get("dietary_notes")
    if dietary_notes is None:
        dietary_notes = item.get("dietary_flags", [])

    return {
        "id": item.get("id"),
        "name": item.get("name"),
        "cuisine": item.get("cuisine"),
        "description": description,
        "ingredients": _as_string_list(item.get("ingredients")),
        "familiarity_score": item.get("familiarity_score", 80),
        "new_tags": _as_string_list(item.get("new_tags")),
        "dietary_flags": _as_string_list(item.get("dietary_flags")),
        "familiarity_bridge": (
            item.get("familiarity_bridge")
            or item.get("dish_story")
            or ""
        ),
        "image_url": item.get("image_url"),
        "summary": summary,
        "explanation": explanation,
        "best_ordering": (
            item.get("best_ordering")
            or "Serve with a fresh side and a light drink."
        ),
        "dietary_notes": _as_string_list(dietary_notes),
        "confidence": confidence,
        "photo": item.get("photo") or item.get("image_url"),
    }


def _build_extracted_dish(
    match: dict,
    index: int,
) -> dict:
    """Build a response for an extracted dish absent from the catalog."""
    name = str(match.get("name") or match.get("dish_name") or "").strip()

    summary = match.get("summary") or match.get("description") or ""
    explanation = match.get("explanation") or summary
    dietary_flags = _as_string_list(match.get("dietary_flags"))

    confidence = match.get("confidence")
    if confidence is None:
        confidence = 0.8

    # The index makes IDs unique when multiple extracted dishes have
    # the same normalized name. These IDs are response identifiers, not
    # persisted catalog records.
    normalized = _normalize_name(name).replace(" ", "-")
    dish_id = f"extracted-{normalized or 'dish'}-{index}"

    return _menu_response_from_dish({
        "id": dish_id,
        "name": name,
        "cuisine": match.get("cuisine"),
        "description": summary,
        "ingredients": _as_string_list(match.get("ingredients")),
        "dietary_flags": dietary_flags,
        "familiarity_bridge": explanation,
        "image_url": match.get("photo") or match.get("image_url"),
        "summary": summary,
        "explanation": explanation,
        "best_ordering": match.get("best_ordering"),
        "dietary_notes": dietary_flags,
        "confidence": confidence,
    })


def scan_uploaded_menu(
    db: Database,
    file_name: str | None,
    uploaded_bytes: bytes | None = None,
) -> list[dict]:
    """
    Extract dishes from an uploaded menu image and enrich them using
    catalog data when a reliable match exists.

    Never substitutes arbitrary catalog dishes when extraction fails.
    """
    if not uploaded_bytes:
        raise HTTPException(
            status_code=400,
            detail="The uploaded menu image is empty or missing.",
        )

    dishes = list(db.dishes.find({}, {"_id": 0}))

    try:
        llm_matches = analyze_menu_image(
            uploaded_bytes,
            file_name,
            [str(dish.get("name") or "") for dish in dishes],
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Menu image analysis failed. Please try again.",
        ) from exc

    if not llm_matches:
        llm_matches = _fallback_matches_from_file_name(file_name, dishes)

    if not llm_matches:
        return []

    response: list[dict] = []
    seen: set[str] = set()

    for index, match in enumerate(llm_matches, start=1):
        if not isinstance(match, dict):
            continue

        name = str(
            match.get("name") or match.get("dish_name") or ""
        ).strip()

        normalized_name = _normalize_name(name)
        if not normalized_name or normalized_name in seen:
            continue

        seen.add(normalized_name)

        catalog_match = _best_catalog_match(name, dishes)

        if catalog_match is not None:
            enriched = enrich_dish_record(catalog_match)

            confidence = match.get("confidence")
            if confidence is None:
                confidence = enriched.get("gemini_confidence")
            if confidence is None:
                confidence = 0.8

            payload = _menu_response_from_dish(
                enriched,
                {
                    "summary": (
                        match.get("summary")
                        or enriched.get("gemini_summary")
                        or enriched.get("description")
                    ),
                    "explanation": (
                        match.get("explanation")
                        or enriched.get("dish_story")
                        or enriched.get("familiarity_bridge")
                    ),
                    "best_ordering": (
                        match.get("best_ordering")
                        or enriched.get("best_ordering")
                    ),
                    "dietary_notes": (
                        match.get("dietary_flags")
                        if match.get("dietary_flags") is not None
                        else enriched.get("dietary_notes")
                    ),
                    "confidence": confidence,
                    "photo": (
                        match.get("photo")
                        or enriched.get("image_url")
                    ),
                },
            )
        else:
            # Preserve the dish extracted from the image without falsely
            # attaching an unrelated catalog record.
            payload = _build_extracted_dish(match, index)

        response.append(payload)

        if len(response) >= 5:
            break

    return response


def list_dishes(
    db: Database,
    cuisine: str | None = None,
    query: str | None = None,
    dietary: str | None = None,
) -> list[dict]:
    """List catalog dishes with optional cuisine, text and dietary filters."""
    filters: dict = {}

    if cuisine:
        filters["cuisine"] = {
            "$regex": f"^{re.escape(cuisine)}$",
            "$options": "i",
        }

    if query:
        term = {"$regex": re.escape(query), "$options": "i"}
        filters["$or"] = [
            {"name": term},
            {"description": term},
            {"ingredients": term},
        ]

    if dietary:
        filters["dietary_flags"] = {
            "$regex": re.escape(dietary),
            "$options": "i",
        }

    dishes = list(db.dishes.find(filters, {"_id": 0}))

    enriched = [enrich_dish_record(item) for item in dishes]
    enriched.sort(key=lambda item: str(item.get("name") or "").casefold())

    return enriched[:200]


def get_dish(db: Database, dish_id: str) -> dict:
    """Retrieve a dish by ID."""
    dish = db.dishes.find_one({"id": dish_id}, {"_id": 0})

    if not dish:
        raise HTTPException(status_code=404, detail="Dish not found")

    return enrich_dish_record(dish)


def taste_bridge(
    db: Database,
    dish_id: str,
    home_cuisine: str | None = None,
) -> dict:
    """Explain a dish using the user's familiar cuisine as a reference."""
    dish = get_dish(db, dish_id)
    bridges = dish.get("taste_bridges") or {}

    if not isinstance(bridges, dict):
        bridges = {}

    normalized_cuisine = (home_cuisine or "").casefold()
    default_bridge = dish.get("familiarity_bridge") or ""

    bridge = bridges.get(normalized_cuisine, default_bridge)

    return {
        "dish_id": dish_id,
        "dish_name": dish.get("name"),
        "home_cuisine": home_cuisine,
        "explanation": bridge,
        "familiarity_score": dish.get("familiarity_score", 0),
        "new_tags": _as_string_list(dish.get("new_tags")),
        "dietary_flags": _as_string_list(dish.get("dietary_flags")),
        "image_url": dish.get("image_url"),
        "dish_story": dish.get("dish_story"),
    }


def flavour_map(db: Database) -> dict:
    """Return unique cuisines and flattened ingredient names."""
    cuisines: set[str] = set()
    ingredients: set[str] = set()

    for dish in db.dishes.find({}, {"_id": 0}):
        cuisine = dish.get("cuisine")
        if isinstance(cuisine, str) and cuisine.strip():
            cuisines.add(cuisine.strip())

        for ingredient in _as_string_list(dish.get("ingredients")):
            ingredients.add(ingredient)

    return {
        "cuisines": sorted(cuisines, key=str.casefold),
        "building_blocks": sorted(ingredients, key=str.casefold),
        "status": "from-mongodb",
    }
