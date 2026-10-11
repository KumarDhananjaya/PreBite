from fastapi import APIRouter, Depends, HTTPException
from pymongo.database import Database

from app.controllers import passport_controller
from app.dependencies import current_user_id, db_session
from app.schemas import StampCreate

router = APIRouter(prefix="/passport", tags=["passport and rewards"])


@router.get("")
def passport(user_id: str = Depends(current_user_id), db: Database = Depends(db_session)):
    return passport_controller.list_stamps(db, user_id)


@router.post("/stamps", status_code=201)
def earn_stamp(payload: StampCreate, user_id: str = Depends(current_user_id), db: Database = Depends(db_session)):
    result = passport_controller.earn_stamp(db, user_id, payload.stamp_key)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result)
    return result
