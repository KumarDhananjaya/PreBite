from datetime import datetime, timezone
import uuid

from fastapi import HTTPException, status
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from app.core.security import create_access_token, hash_password, verify_password
from app.schemas import LoginRequest, UserCreate


def _public(user: dict) -> dict:
    return {"id": user["id"], "name": user["name"], "email": user["email"],
            "home_cuisine": user.get("home_cuisine")}


def register(db: Database, payload: UserCreate) -> dict:
    user = {"id": str(uuid.uuid4()), "email": str(payload.email).lower(),
            "name": payload.name.strip(), "password_hash": hash_password(payload.password),
            "home_cuisine": None, "created_at": datetime.now(timezone.utc).isoformat()}
    try:
        db.users.insert_one(user)
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail="An account with this email already exists") from exc
    return {"access_token": create_access_token(user["id"]), "token_type": "bearer", "user": _public(user)}


def login(db: Database, payload: LoginRequest) -> dict:
    user = db.users.find_one({"email": str(payload.email).lower()})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password",
                            headers={"WWW-Authenticate": "Bearer"})
    return {"access_token": create_access_token(user["id"]), "token_type": "bearer", "user": _public(user)}


def get_user(db: Database, user_id: str) -> dict:
    user = db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _public(user)


def update_user(db: Database, user_id: str, values: dict) -> dict:
    if not db.users.find_one({"id": user_id}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="User not found")
    updates = {key: value for key, value in values.items() if value is not None}
    if updates:
        db.users.update_one({"id": user_id}, {"$set": updates})
    return get_user(db, user_id)
