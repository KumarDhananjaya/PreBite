from fastapi import APIRouter, Depends, File, Query, UploadFile
from pymongo.database import Database

from app.controllers import dish_controller
from app.dependencies import db_session

router = APIRouter(prefix="/dishes", tags=["dishes"])


@router.get("")
def list_dishes(cuisine: str | None = None, q: str | None = Query(default=None, max_length=100),
                dietary: str | None = None, db: Database = Depends(db_session)):
    return {"items": dish_controller.list_dishes(db, cuisine, q, dietary)}


@router.post("/scan-menu")
async def scan_menu(file: UploadFile = File(...), db: Database = Depends(db_session)):
    image_bytes = await file.read()
    items = dish_controller.scan_uploaded_menu(db, file.filename, image_bytes)
    return {
        "items": items,
        "filename": file.filename,
        "count": len(items),
    }


@router.get("/flavour-map")
def flavour_map(db: Database = Depends(db_session)):
    return dish_controller.flavour_map(db)


@router.get("/{dish_id}")
def get_dish(dish_id: str, db: Database = Depends(db_session)):
    return dish_controller.get_dish(db, dish_id)


@router.get("/{dish_id}/taste-bridge")
def taste_bridge(dish_id: str, home_cuisine: str | None = None, db: Database = Depends(db_session)):
    return dish_controller.taste_bridge(db, dish_id, home_cuisine)


@router.get("/{dish_id}/insight")
def dish_insight(dish_id: str, db: Database = Depends(db_session)):
    dish = dish_controller.get_dish(db, dish_id)
    return {
        "dish_id": dish_id,
        "dish_name": dish["name"],
        "summary": dish.get("gemini_summary") or dish.get("description"),
        "why_it_works": dish.get("dish_story") or dish.get("familiarity_bridge"),
        "best_ordering": dish.get("best_ordering") or "Pair it with a crisp side and a light drink.",
        "dietary_notes": dish.get("dietary_notes") or dish.get("dietary_flags", []),
        "confidence": dish.get("gemini_confidence", 0.8),
        "image_url": dish.get("image_url"),
    }
