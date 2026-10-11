from fastapi import APIRouter, Depends
from pymongo.database import Database

from app.controllers import auth_controller
from app.dependencies import current_user_id, db_session
from app.schemas import LoginRequest, TokenResponse, UserCreate, UserPublic

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(payload: UserCreate, db: Database = Depends(db_session)):
    return auth_controller.register(db, payload)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Database = Depends(db_session)):
    return auth_controller.login(db, payload)


@router.get("/me", response_model=UserPublic)
def me(user_id: str = Depends(current_user_id), db: Database = Depends(db_session)):
    return auth_controller.get_user(db, user_id)
