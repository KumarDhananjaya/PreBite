from fastapi import APIRouter, Depends, HTTPException
from pymongo.database import Database

from app.controllers import community_controller
from app.dependencies import current_user_id, db_session
from app.schemas import AnalogyCreate, RatingCreate

router = APIRouter(prefix="/community", tags=["community"])


@router.get("/dishes/{dish_id}/guide")
def guide(dish_id: str, db: Database = Depends(db_session)):
    return community_controller.local_guide(db, dish_id)


@router.get("/dishes/{dish_id}/analogies")
def analogies(dish_id: str, db: Database = Depends(db_session)):
    return {"items": community_controller.list_analogies(db, dish_id)}


@router.post("/dishes/{dish_id}/analogies", status_code=201)
def add_analogy(dish_id: str, payload: AnalogyCreate, user_id: str = Depends(current_user_id), db: Database = Depends(db_session)):
    return community_controller.add_analogy(db, user_id, dish_id, payload.home_dish, payload.note)


@router.put("/dishes/{dish_id}/rating")
def rate(dish_id: str, payload: RatingCreate, user_id: str = Depends(current_user_id), db: Database = Depends(db_session)):
    return community_controller.rate_dish(db, user_id, dish_id, payload.reaction, payload.note)
