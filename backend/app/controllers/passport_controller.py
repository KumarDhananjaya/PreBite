from datetime import datetime, timezone
import uuid

from pymongo.database import Database

VALID_STAMPS = {"roman-four", "first-bite", "bold-flavors", "pasta-explorer"}


def list_stamps(db: Database, user_id: str) -> dict:
    rows = db.passport_stamps.find({"user_id": user_id}, {"_id": 0, "stamp_key": 1, "earned_at": 1}).sort("earned_at", 1)
    return {"stamps": list(rows), "available": sorted(VALID_STAMPS)}


def earn_stamp(db: Database, user_id: str, stamp_key: str) -> dict:
    if stamp_key not in VALID_STAMPS:
        return {"error": "Unknown stamp", "available": sorted(VALID_STAMPS)}
    earned_at = datetime.now(timezone.utc).isoformat()
    db.passport_stamps.update_one(
        {"user_id": user_id, "stamp_key": stamp_key},
        {"$setOnInsert": {"id": str(uuid.uuid4()), "user_id": user_id,
                           "stamp_key": stamp_key, "earned_at": earned_at}},
        upsert=True,
    )
    return db.passport_stamps.find_one({"user_id": user_id, "stamp_key": stamp_key},
                                        {"_id": 0, "stamp_key": 1, "earned_at": 1})
