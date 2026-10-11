from app.controllers import dish_controller
from app.services.gemini_service import _safe_image_url


class FakeCursor:
    def __init__(self, items):
        self.items = items

    def __iter__(self):
        return iter(self.items)


class FakeCollection:
    def __init__(self, items):
        self.items = items
        self._records = items

    def find_one(self, filters, projection=None):
        return next((item for item in self.items if item.get("id") == filters.get("id")), None)

    def find(self, filters=None, projection=None):
        return FakeCursor(self.items)


class FakeDB:
    def __init__(self, items):
        self.dishes = FakeCollection(items)


def test_safe_image_url_uses_web_image_for_specific_dish_name():
    photo = _safe_image_url("Miso Ramen", "Japanese")

    assert photo
    assert "unsplash" in photo.lower() or "images.unsplash.com" in photo.lower() or "source.unsplash.com" in photo.lower()


def test_scan_uploaded_menu_ranks_ordered_dishes_from_uploaded_image_name():
    db = FakeDB([
        {"id": "carbonara", "name": "Rigatoni alla Carbonara", "cuisine": "Italian", "description": "Creamy pasta", "ingredients": ["egg", "pork", "pecorino"], "dietary_flags": ["contains pork"], "familiarity_bridge": "Rich and savory", "new_tags": ["creamy", "savory"], "image_url": "https://example.com/carbonara.jpg", "familiarity_score": 80},
        {"id": "aglio-e-olio", "name": "Spaghetti Aglio e Olio", "cuisine": "Italian", "description": "Garlic pasta", "ingredients": ["garlic", "olive oil"], "dietary_flags": ["vegan"], "familiarity_bridge": "Light and fragrant", "new_tags": ["garlicky", "bright"], "image_url": "https://example.com/aglio.jpg", "familiarity_score": 90},
    ])

    result = dish_controller.scan_uploaded_menu(db, "menu-carbonara.jpg", b"fake-pixel-data")

    assert result[0]["id"] == "carbonara"
    assert len(result) >= 1
    assert "summary" in result[0]
    assert result[0]["photo"]


def test_get_dish_returns_reference_image():
    db = FakeDB([
        {"id": "carbonara", "name": "Rigatoni alla Carbonara", "cuisine": "Italian", "description": "Creamy pasta", "ingredients": ["egg", "pork", "pecorino"], "dietary_flags": ["contains pork"], "familiarity_bridge": "Rich and savory", "new_tags": ["creamy", "savory"], "familiarity_score": 80},
    ])

    result = dish_controller.get_dish(db, "carbonara")

    assert result["image_url"]
    assert "unsplash" in result["image_url"].lower()


def test_scan_uploaded_menu_uses_llm_menu_analysis(monkeypatch):
    db = FakeDB([
        {"id": "carbonara", "name": "Rigatoni alla Carbonara", "cuisine": "Italian", "description": "Creamy pasta", "ingredients": ["egg", "pork", "pecorino"], "dietary_flags": ["contains pork"], "familiarity_bridge": "Rich and savory", "new_tags": ["creamy", "savory"], "image_url": "https://example.com/carbonara.jpg", "familiarity_score": 80},
        {"id": "margherita", "name": "Margherita Pizza", "cuisine": "Italian", "description": "Classic pizza", "ingredients": ["tomato", "mozzarella", "basil"], "dietary_flags": ["vegetarian"], "familiarity_bridge": "Fresh and balanced", "new_tags": ["classic", "fresh"], "image_url": "https://example.com/margherita.jpg", "familiarity_score": 85},
    ])

    monkeypatch.setattr(
        dish_controller,
        "analyze_menu_image",
        lambda uploaded_bytes, file_name=None, known_dishes=None: [
            {
                "name": "Margherita Pizza",
                "summary": "Fresh tomato pizza with basil and mozzarella.",
                "explanation": "Light, bright, and crowd-pleasing with a balanced tomato base.",
                "ingredients": ["tomato", "mozzarella", "basil"],
                "dietary_flags": ["vegetarian"],
                "confidence": 0.95,
            }
        ],
    )

    result = dish_controller.scan_uploaded_menu(db, "menu.jpg", b"fake-pixel-data")

    assert result[0]["name"] == "Margherita Pizza"
    assert result[0]["summary"] == "Fresh tomato pizza with basil and mozzarella."
    assert result[0]["confidence"] >= 0.9
    assert result[0]["photo"]
