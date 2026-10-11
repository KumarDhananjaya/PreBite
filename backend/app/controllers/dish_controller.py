import re

from fastapi import HTTPException
from pymongo.database import Database


def list_dishes(db: Database, cuisine: str | None = None, query: str | None = None,
                dietary: str | None = None) -> list[dict]:
    filters: dict = {}
    if cuisine:
        filters["cuisine"] = {"$regex": f"^{re.escape(cuisine)}$", "$options": "i"}
    if query:
        term = {"$regex": re.escape(query), "$options": "i"}
        filters["$or"] = [{"name": term}, {"description": term}, {"ingredients": term}]
    if dietary:
        filters["dietary_flags"] = {"$regex": re.escape(dietary), "$options": "i"}
    return list(db.dishes.find(filters, {"_id": 0}).sort("name", 1).limit(200))


def get_dish(db: Database, dish_id: str) -> dict:
    dish = db.dishes.find_one({"id": dish_id}, {"_id": 0})
    if not dish:
        raise HTTPException(status_code=404, detail="Dish not found")
    return dish


def taste_bridge(db: Database, dish_id: str, home_cuisine: str | None = None) -> dict:
    dish = get_dish(db, dish_id)
    bridges = dish.get("taste_bridges", {})
    bridge = bridges.get((home_cuisine or "").casefold(), dish["familiarity_bridge"])
    return {"dish_id": dish_id, "dish_name": dish["name"], "home_cuisine": home_cuisine,
            "explanation": bridge, "familiarity_score": dish["familiarity_score"],
            "new_tags": dish["new_tags"], "dietary_flags": dish["dietary_flags"]}


def flavour_map(db: Database) -> dict:
    cuisines = db.dishes.distinct("cuisine")
    ingredients = db.dishes.distinct("ingredients")
    return {"cuisines": sorted(cuisines), "building_blocks": sorted(ingredients),
            "status": "from-mongodb"}
