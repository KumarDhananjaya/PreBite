from collections.abc import Iterator

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pymongo.database import Database

from app.core.security import decode_access_token
from app.db import get_db

bearer_scheme = HTTPBearer(auto_error=False)


def db_session() -> Iterator[Database]:
    # The MongoDB client is shared across requests; PyMongo manages its connection pool.
    yield get_db()


def current_user_id(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
                    db: Database = Depends(db_session)) -> str:
    user_id = decode_access_token(credentials.credentials) if credentials else None
    if not user_id or not db.users.find_one({"id": user_id}, {"_id": 1}):
        raise HTTPException(status_code=401, detail="Invalid or expired authentication token",
                            headers={"WWW-Authenticate": "Bearer"})
    return user_id
