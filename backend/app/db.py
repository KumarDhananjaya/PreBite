from functools import lru_cache
import json
from pathlib import Path

from pymongo import MongoClient
from pymongo.database import Database

from app.core.config import get_settings


@lru_cache
def get_mongo_client() -> MongoClient:
    settings = get_settings()
    if not settings.mongodb_uri or "<" in settings.mongodb_uri:
        raise RuntimeError(
            "MongoDB is not configured. Add your Atlas connection string to backend/.env as MONGODB_URI."
        )
    return MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000)


def get_db() -> Database:
    return get_mongo_client()[get_settings().mongodb_database]


def init_db() -> None:
    """Verify Atlas connectivity, prepare indexes, and load starter dishes once."""
    db = get_db()
    get_mongo_client().admin.command("ping")
    db.users.create_index("email", unique=True)
    db.dishes.create_index("id", unique=True)
    db.food_analogies.create_index([("dish_id", 1), ("created_at", -1)])
    db.dish_ratings.create_index([("dish_id", 1), ("user_id", 1)], unique=True)
    db.passport_stamps.create_index([("user_id", 1), ("stamp_key", 1)], unique=True)

    # Starter catalog is imported only when dishes is empty. After that, MongoDB is the
    # source of truth, so edits made in Atlas are returned by the API on the next request.
    if db.dishes.count_documents({}) == 0:
        seed_path = Path(__file__).parent / "data" / "dishes.json"
        with seed_path.open(encoding="utf-8") as seed_file:
            starter_dishes = json.load(seed_file)
        if starter_dishes:
            db.dishes.insert_many(starter_dishes)


def close_mongo_client() -> None:
    if get_mongo_client.cache_info().currsize:
        get_mongo_client().close()
        get_mongo_client.cache_clear()
