from datetime import datetime, timezone
import uuid

from pymongo.database import Database

from app.controllers.dish_controller import get_dish


def add_analogy(db: Database, user_id: str, dish_id: str, home_dish: str, note: str) -> dict:
    dish = get_dish(db, dish_id)
    user = db.users.find_one({"id": user_id}, {"name": 1})
    record = {"id": str(uuid.uuid4()), "dish_id": dish_id, "user_id": user_id,
              "home_dish": home_dish.strip(), "note": note.strip(),
              "created_at": datetime.now(timezone.utc).isoformat()}
    db.food_analogies.insert_one(record)
    return {"id": record["id"], "dish_id": dish_id, "dish_name": dish["name"],
            "home_dish": record["home_dish"], "note": record["note"],
            "author": user["name"] if user else "Community member", "created_at": record["created_at"]}


def list_analogies(db: Database, dish_id: str) -> list[dict]:
    get_dish(db, dish_id)
    records = list(db.food_analogies.find({"dish_id": dish_id}).sort("created_at", -1).limit(100))
    user_ids = {record["user_id"] for record in records}
    users = {user["id"]: user["name"] for user in db.users.find({"id": {"$in": list(user_ids)}}, {"id": 1, "name": 1})}
    return [{"id": item["id"], "dish_id": item["dish_id"], "home_dish": item["home_dish"],
             "note": item["note"], "created_at": item["created_at"],
             "author": users.get(item["user_id"], "Community member")} for item in records]


def rate_dish(db: Database, user_id: str, dish_id: str, reaction: str, note: str | None) -> dict:
    get_dish(db, dish_id)
    record = {"dish_id": dish_id, "user_id": user_id, "reaction": reaction, "note": note,
              "created_at": datetime.now(timezone.utc).isoformat()}
    db.dish_ratings.update_one({"dish_id": dish_id, "user_id": user_id}, {"$set": record}, upsert=True)
    return record


def local_guide(db: Database, dish_id: str) -> dict:
    dish = get_dish(db, dish_id)
    reaction_counts = {"loved": 0, "okay": 0, "challenging": 0}
    for row in db.dish_ratings.aggregate([
        {"$match": {"dish_id": dish_id}},
        {"$group": {"_id": "$reaction", "count": {"$sum": 1}}},
    ]):
        reaction_counts[row["_id"]] = row["count"]
    ratings = list(db.dish_ratings.find({"dish_id": dish_id, "note": {"$ne": None}})
                   .sort("created_at", -1).limit(20))
    user_ids = {rating["user_id"] for rating in ratings}
    users = {user["id"]: user["name"] for user in db.users.find({"id": {"$in": list(user_ids)}}, {"id": 1, "name": 1})}
    notes = [{"author": users.get(item["user_id"], "Community member"), "reaction": item["reaction"],
              "note": item["note"], "created_at": item["created_at"]} for item in ratings]
    return {"dish_id": dish_id, "dish_name": dish["name"], "starter_note": dish["acquired_taste"],
            "community_reactions": reaction_counts, "community_notes": notes, "sample_data": True}
