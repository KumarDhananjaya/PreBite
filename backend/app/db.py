from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from pymongo import MongoClient # type: ignore
from pymongo.database import Database # type: ignore

from app.core.config import get_settings


class FallbackCollection:
    def __init__(self, records: list[dict[str, Any]]):
        self._records = records

    def find(self, filters: dict | None = None, projection: dict | None = None, *args, **kwargs):
        records = list(self._records)

        if filters and "id" in filters:
            records = [item for item in records if item.get("id") == filters["id"]]

        if filters and filters.get("$or"):
            clause = filters["$or"]
            filtered = []
            for item in records:
                matches = False
                for condition in clause:
                    for key, value in condition.items():
                        if not isinstance(value, dict):
                            continue
                        regex = value.get("$regex", "")
                        if not regex:
                            continue
                        pattern = re.compile(regex, re.IGNORECASE)
                        if key == "name" and pattern.search(str(item.get("name", ""))):
                            matches = True
                        elif key == "description" and pattern.search(str(item.get("description", ""))):
                            matches = True
                        elif key == "ingredients" and any(pattern.search(str(ingredient)) for ingredient in item.get("ingredients", [])):
                            matches = True
                if matches:
                    filtered.append(item)
            records = filtered

        if filters and "cuisine" in filters:
            regex = filters["cuisine"].get("$regex", "")
            pattern = re.compile(regex, re.IGNORECASE)
            records = [item for item in records if pattern.search(str(item.get("cuisine", "")))]

        if filters and "dietary_flags" in filters:
            regex = filters["dietary_flags"].get("$regex", "")
            pattern = re.compile(regex, re.IGNORECASE)
            records = [
                item for item in records
                if any(pattern.search(str(flag)) for flag in item.get("dietary_flags", []))
            ]

        return records

    def find_one(self, filters: dict, projection: dict | None = None, *args, **kwargs):
        for item in self._records:
            if item.get("id") == filters.get("id"):
                return item
        return None

    def count_documents(self, filters: dict | None = None) -> int:
        return len(self.find(filters))

    def distinct(self, key: str) -> list[Any]:
        values = []
        for item in self._records:
            value = item.get(key)
            if value is not None and value not in values:
                values.append(value)
        return values

    def create_index(self, *args, **kwargs):
        return None

    def insert_many(self, items: list[dict[str, Any]]) -> None:
        self._records.extend(items)

    def insert_one(self, item: dict[str, Any]) -> Any:
        self._records.append(item)
        return type("InsertResult", (), {"inserted_id": item.get("_id", item.get("id"))})()

    def update_one(self, filters: dict, update: dict, *args, **kwargs):
        for item in self._records:
            if item.get("id") == filters.get("id"):
                item.update(update.get("$set", {}))
                return type("UpdateResult", (), {"matched_count": 1, "modified_count": 1})()
        return type("UpdateResult", (), {"matched_count": 0, "modified_count": 0})()

    def sort(self, field: str, direction: int = 1):
        return list(sorted(self._records, key=lambda item: item.get(field, "")))


class FallbackDatabase:
    def __init__(self, records: list[dict[str, Any]]):
        self.dishes = FallbackCollection(records)
        self.users = FallbackCollection([])
        self.food_analogies = FallbackCollection([])
        self.dish_ratings = FallbackCollection([])
        self.passport_stamps = FallbackCollection([])
        self.menus = FallbackCollection([])


@lru_cache
def get_mongo_client() -> MongoClient | None:
    settings = get_settings()
    if not settings.mongodb_uri or "<" in settings.mongodb_uri:
        return None
    client_kwargs: dict[str, Any] = {"serverSelectionTimeoutMS": 5000}
    if "mongodb.net" in settings.mongodb_uri or settings.mongodb_uri.startswith("mongodb+srv://"):
        client_kwargs["tls"] = True
        if settings.mongo_allow_invalid_cert:
            client_kwargs["tlsAllowInvalidCertificates"] = True
    return MongoClient(settings.mongodb_uri, **client_kwargs)


def _load_seed_dishes() -> list[dict[str, Any]]:
    seed_path = Path(__file__).parent / "data" / "dishes.json"
    with seed_path.open(encoding="utf-8") as seed_file:
        return json.load(seed_file)



def get_db() -> Database | FallbackDatabase:
    settings = get_settings()
    client = get_mongo_client()

    # Use seed data only when MongoDB is intentionally unconfigured.
    if client is None:
        return FallbackDatabase(_load_seed_dishes())

    # If Atlas is configured but unavailable, surface the error.
    client.admin.command("ping")
    return client[settings.mongodb_database]


def init_db() -> None:
    """Verify Atlas connectivity, prepare indexes, and load starter dishes once."""
    db = get_db()
    if isinstance(db, FallbackDatabase):
        return

    db.users.create_index("email", unique=True)
    db.dishes.create_index("id", unique=True)
    db.menus.create_index("id", unique=True)
    db.food_analogies.create_index([("dish_id", 1), ("created_at", -1)])
    db.dish_ratings.create_index([("dish_id", 1), ("user_id", 1)], unique=True)
    db.passport_stamps.create_index([("user_id", 1), ("stamp_key", 1)], unique=True)

    if db.dishes.count_documents({}) == 0:
        seed_path = Path(__file__).parent / "data" / "dishes.json"
        with seed_path.open(encoding="utf-8") as seed_file:
            starter_dishes = json.load(seed_file)
        if starter_dishes:
            db.dishes.insert_many(starter_dishes)


def close_mongo_client() -> None:
    client = get_mongo_client()
    if client:
        client.close()
        get_mongo_client.cache_clear()
