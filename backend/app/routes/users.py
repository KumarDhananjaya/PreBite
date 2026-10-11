from fastapi import APIRouter, Depends
from pymongo.database import Database

from app.controllers import auth_controller
from app.dependencies import current_user_id, db_session
from app.schemas import ProfileUpdate, UserPublic

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserPublic)
def get_profile(user_id: str = Depends(current_user_id), db: Database = Depends(db_session)):
    return auth_controller.get_user(db, user_id)


@router.patch("/me", response_model=UserPublic)
def update_profile(payload: ProfileUpdate, user_id: str = Depends(current_user_id), db: Database = Depends(db_session)):
    return auth_controller.update_user(db, user_id, payload.model_dump(exclude_unset=True))
