import asyncio
from functools import partial
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pymongo.database import Database

from app.controllers import menu_controller
from app.dependencies import db_session

router = APIRouter(prefix="/menus", tags=["menus"])


@router.post("/upload", status_code=201)
async def upload_menu(
    files: list[UploadFile] = File(default=[]),
    file: UploadFile | None = File(default=None),
    restaurant_name: str | None = Form(default=None),
    db: Database = Depends(db_session),
):
    # Combine single file and files list
    all_uploads: list[UploadFile] = list(files)
    if file and file not in all_uploads:
        all_uploads.insert(0, file)

    if not all_uploads:
        raise HTTPException(status_code=400, detail="At least one menu file (JPG, PNG, WebP, or PDF) is required.")

    file_tuples: list[tuple[str, bytes, str | None]] = []
    for f in all_uploads:
        content = await f.read()
        file_tuples.append((f.filename or "menu-upload", content, f.content_type))

    try:
        if len(file_tuples) == 1:
            name, content, c_type = file_tuples[0]
            # Run blocking Gemini/IO work in a thread pool to avoid blocking the event loop
            return await asyncio.to_thread(
                menu_controller.upload_menu, db, name, content, restaurant_name
            )
        return await asyncio.to_thread(
            menu_controller.upload_menu, db, file_tuples, None, restaurant_name
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("")
def list_menus(db: Database = Depends(db_session)):
    return {"items": menu_controller.list_menus(db)}


@router.get("/{menu_id}")
def get_menu(menu_id: str, db: Database = Depends(db_session)):
    return menu_controller.get_menu(db, menu_id)


@router.get("/{menu_id}/dishes")
def get_menu_dishes(
    menu_id: str,
    q: str | None = None,
    category: str | None = None,
    dietary: str | None = None,
    db: Database = Depends(db_session),
):
    return {"items": menu_controller.list_menu_dishes(db, menu_id, q=q, category=category, dietary=dietary)}


@router.get("/{menu_id}/dishes/{dish_id}")
def get_menu_dish(menu_id: str, dish_id: str, db: Database = Depends(db_session)):
    return menu_controller.get_menu_dish(db, menu_id, dish_id)


@router.patch("/{menu_id}/dishes/{dish_id}")
def patch_menu_dish(menu_id: str, dish_id: str, payload: dict[str, Any], db: Database = Depends(db_session)):
    return menu_controller.update_menu_dish(db, menu_id, dish_id, payload)


@router.post("/{menu_id}/scan")
async def scan_menu_image(menu_id: str, file: UploadFile = File(...), db: Database = Depends(db_session)):
    content = await file.read()
    fname = file.filename or "scan.jpg"
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded scan image is empty.")
    try:
        items = await asyncio.to_thread(
            menu_controller.scan_menu_image, db, menu_id, fname, content
        )
        return {"items": items}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{menu_id}/dishes/{dish_id}/explain")
async def explain_menu_dish(menu_id: str, dish_id: str, db: Database = Depends(db_session)):
    return await asyncio.to_thread(menu_controller.explain_dish, db, menu_id, dish_id)


@router.post("/{menu_id}/retry")
async def retry_menu_processing(
    menu_id: str,
    file: UploadFile | None = File(default=None),
    db: Database = Depends(db_session),
):
    content = None
    filename = None
    if file:
        content = await file.read()
        filename = file.filename
    return await asyncio.to_thread(
        menu_controller.retry_menu_processing, db, menu_id, filename, content
    )


@router.post("/{menu_id}/dishes/{dish_id}/comparison")
async def compare_menu_dish(
    menu_id: str, dish_id: str,
    home_cuisine: str = Query(min_length=1, max_length=100),
    db: Database = Depends(db_session),
):
    from app.services.cuisine_comparison_service import compare_home_cuisine

    menu = await asyncio.to_thread(menu_controller._get_menu, db, menu_id)
    dish = next((item for item in menu.get("dishes", [])
                 if isinstance(item, dict) and item.get("id") == dish_id), None)
    if dish is None:
        raise HTTPException(status_code=404, detail="Dish not found in this menu")
    return await asyncio.to_thread(compare_home_cuisine, dish, home_cuisine)
