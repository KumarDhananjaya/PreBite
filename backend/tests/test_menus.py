from app.controllers import menu_controller
from app.services.menu_service import HeuristicMenuProvider, MenuService
import pytest


class FixtureProvider:
    def extract(self, *args, **kwargs):
        return [{"name": "Test dish", "price": None, "confidence": 0.9}]


@pytest.fixture(autouse=True)
def fixture_menu_service(monkeypatch):
    monkeypatch.setattr(menu_controller, "menu_service", MenuService(provider=FixtureProvider()))


class FakeMenuCollection:
    def __init__(self, items):
        self.items = items

    def find_one(self, query, projection=None):
        for item in self.items:
            if item.get("id") == query.get("id"):
                return item
        return None

    def insert_one(self, item):
        item["_id"] = "mongo-generated-id"
        self.items.append(item)
        return type("InsertResult", (), {"inserted_id": item["_id"]})()

    def update_one(self, query, update):
        for item in self.items:
            if item.get("id") == query.get("id"):
                item.update(update["$set"])
                return type("UpdateResult", (), {"matched_count": 1})()
        return type("UpdateResult", (), {"matched_count": 0})()


class FakeMenusDB:
    def __init__(self):
        self.menus = FakeMenuCollection([])


def test_upload_menu_creates_menu_record():
    db = FakeMenusDB()
    menu = menu_controller.upload_menu(db, "menu.jpg", b"\xff\xd8\xfffixture", restaurant_name="Test Bistro")
    assert menu["restaurant_name"] == "Test Bistro"
    assert menu["status"] == "processed"
    assert menu["dishes"]


def test_update_menu_dish_persists_corrections():
    db = FakeMenusDB()
    menu = menu_controller.upload_menu(db, "menu.jpg", b"\xff\xd8\xfffixture", restaurant_name="Test Bistro")
    dish_id = menu["dishes"][0]["id"]
    updated = menu_controller.update_menu_dish(db, menu["id"], dish_id, {"price": 24.5, "description": "Corrected description"})
    assert updated["price"] == 24.5
    assert updated["description"] == "Corrected description"


def test_upload_menu_strips_mongo_internal_fields_from_response():
    db = FakeMenusDB()
    menu = menu_controller.upload_menu(db, "menu.jpg", b"\xff\xd8\xfffixture", restaurant_name="Test Bistro")
    assert "_id" not in menu
    assert "_id" not in menu["dishes"][0]


def test_thai_menu_heuristic_does_not_invent_generic_dishes():
    provider = HeuristicMenuProvider()

    result = provider.extract("thai-menu.jpg", b"not-a-real-menu-image")

    assert result == []
