from fastapi import APIRouter, Depends, Query
from pymongo.database import Database

from app.controllers import dish_controller
from app.dependencies import db_session

router = APIRouter(prefix="/dishes", tags=["dishes"])


@router.get("")
def list_dishes(cuisine: str | None = None, q: str | None = Query(default=None, max_length=100),
                dietary: str | None = None, db: Database = Depends(db_session)):
    return {"items": dish_controller.list_dishes(db, cuisine, q, dietary)}


@router.get("/flavour-map")
def flavour_map(db: Database = Depends(db_session)):
    return dish_controller.flavour_map(db)


@router.get("/{dish_id}")
def get_dish(dish_id: str, db: Database = Depends(db_session)):
    return dish_controller.get_dish(db, dish_id)


@router.get("/{dish_id}/taste-bridge")
def taste_bridge(dish_id: str, home_cuisine: str | None = None, db: Database = Depends(db_session)):
    return dish_controller.taste_bridge(db, dish_id, home_cuisine)
