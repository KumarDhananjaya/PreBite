import pytest
from fastapi import HTTPException

from app.controllers import menu_controller
from app.db import FallbackDatabase
from app.schemas import DishExplanationSchema, ExtractedDishSchema
from app.services.dish_explanation_service import generate_dish_explanation
from app.services.menu_service import HeuristicMenuProvider, MenuService


JPEG = b"\xff\xd8\xfffixture"

class FixtureProvider:
    def extract(self, file_name, file_bytes, page_hint=None):
        names = ["Pad Thai", "Tom Yum", "Green Curry"] if file_bytes.endswith(b"thai") else ["Rigatoni alla Carbonara", "Cacio e Pepe", "Salad", "Pizza"]
        return [{"name": name, "category": "Primi", "dietary_labels": ["Vegetarian"] if name == "Salad" else [], "confidence": 0.9} for name in names]

@pytest.fixture(autouse=True)
def fixture_service(monkeypatch):
    monkeypatch.setattr(menu_controller, "menu_service", MenuService(provider=FixtureProvider(), inline_limit_bytes=1024))


def create_test_db():
    return FallbackDatabase([])


def test_menu_upload_validation():
    service = MenuService()

    # Empty file name
    with pytest.raises(ValueError, match="A menu file is required"):
        service.validate_upload("", b"data")

    # Empty bytes
    with pytest.raises(ValueError, match="empty"):
        service.validate_upload("menu.jpg", b"")

    # Unsupported format
    with pytest.raises(ValueError, match="Unsupported menu format"):
        service.validate_upload("menu.exe", b"executable-bytes")

    with pytest.raises(ValueError, match="Unsupported menu format"):
        service.validate_upload("menu.txt", b"plain text", content_type="text/plain")

    # Valid formats do not raise
    service.validate_upload("menu.jpg", JPEG)
    service.validate_upload("menu.png", b"\x89PNG\r\n\x1a\nfixture")
    service.validate_upload("menu.webp", b"RIFF0000WEBPfixture")
    service.validate_upload("menu.pdf", b"%PDF-1.4 fixture")


def test_menu_upload_single_and_multiple_files():
    db = create_test_db()

    # Single file upload
    menu_single = menu_controller.upload_menu(
        db,
        "trattoria_menu.jpg",
        JPEG,
        restaurant_name="Trattoria Roma",
    )
    assert menu_single["restaurant_name"] == "Trattoria Roma"
    assert menu_single["status"] == "processed"
    assert len(menu_single["source_files"]) == 1
    assert len(menu_single["dishes"]) >= 1

    # Multi-file upload (multi-page menu)
    multi_files = [
        ("page1_starters.jpg", JPEG, "image/jpeg"),
        ("page2_mains.jpg", JPEG, "image/jpeg"),
    ]
    menu_multi = menu_controller.upload_menu(
        db,
        multi_files,
        restaurant_name="Multi-Page Ristorante",
    )
    assert menu_multi["restaurant_name"] == "Multi-Page Ristorante"
    assert len(menu_multi["source_files"]) == 2
    assert menu_multi["source_files"][0]["name"] == "page1_starters.jpg"
    assert menu_multi["source_files"][1]["name"] == "page2_mains.jpg"


def test_menu_extraction_accuracy_and_missing_values():
    """Verify that extraction does not invent fields and handles missing values as None/empty."""
    provider = HeuristicMenuProvider()
    dishes = provider.extract("custom_unknown_dish.jpg", b"raw-bytes")
    assert dishes == []  # A filename and arbitrary bytes are not menu evidence.
    dishes = provider.extract("menu.txt", b"Noodles 12\nSalad 8")
    assert len(dishes) == 2
    assert dishes[0]["price"] == 12
    assert dishes[0]["ingredients"] == []
    assert dishes[0]["allergens"] == []
    assert dishes[0]["confidence"] < 0.6


def test_dish_listing_and_filtering():
    db = create_test_db()
    menu = menu_controller.upload_menu(
        db,
        "trattoria_menu.jpg",
        JPEG,
        restaurant_name="Trattoria Roma",
    )
    menu_id = menu["id"]

    # All dishes
    all_dishes = menu_controller.list_menu_dishes(db, menu_id)
    assert len(all_dishes) >= 4

    # Search by keyword 'carbonara'
    carbonara_dishes = menu_controller.list_menu_dishes(db, menu_id, q="carbonara")
    assert len(carbonara_dishes) >= 1
    assert any("carbonara" in d["name"].lower() for d in carbonara_dishes)

    # Filter by category
    pasta_dishes = menu_controller.list_menu_dishes(db, menu_id, category="Primi")
    assert len(pasta_dishes) >= 1
    assert all(d["category"].lower() == "primi" for d in pasta_dishes)

    # Filter by dietary label
    veg_dishes = menu_controller.list_menu_dishes(db, menu_id, dietary="Vegetarian")
    assert len(veg_dishes) >= 1
    assert all("Vegetarian" in d["dietary_labels"] for d in veg_dishes)


def test_dish_patch_corrections():
    db = create_test_db()
    menu = menu_controller.upload_menu(
        db,
        "trattoria_menu.jpg",
        JPEG,
        restaurant_name="Trattoria Roma",
    )
    menu_id = menu["id"]
    dish_id = menu["dishes"][0]["id"]

    # User corrects dish information
    correction = {
        "name": "Updated Rigatoni Carbonara",
        "price": 26.50,
        "currency": "EUR",
        "description": "Handmade rigatoni with organic egg yolk and aged pecorino.",
        "dietary_labels": ["Contains Pork", "Gluten-Free Option Available"],
    }
    updated = menu_controller.update_menu_dish(db, menu_id, dish_id, correction)
    assert updated["name"] == "Updated Rigatoni Carbonara"
    assert updated["price"] == 26.50
    assert updated["currency"] == "EUR"
    assert updated["description"] == "Handmade rigatoni with organic egg yolk and aged pecorino."
    assert "Gluten-Free Option Available" in updated["dietary_labels"]

    # Verify persistent retrieval
    fetched = menu_controller.get_menu_dish(db, menu_id, dish_id)
    assert fetched["name"] == "Updated Rigatoni Carbonara"
    assert fetched["price"] == 26.50


def test_scan_menu_exact_and_partial_matches(monkeypatch):
    db = create_test_db()
    menu = menu_controller.upload_menu(
        db,
        "trattoria_menu.jpg",
        JPEG,
        restaurant_name="Trattoria Roma",
    )
    menu_id = menu["id"]

    monkeypatch.setattr("app.services.menu_service.prepare_media", lambda *args: object())
    monkeypatch.setattr("app.services.menu_service.run_text", lambda **kwargs: "Rigatoni alla Carbonara")
    # Match OCR text, independent of filename.
    matches = menu_controller.scan_menu_image(db, menu_id, "carbonara.jpg", JPEG)
    assert len(matches) >= 1
    top_match = matches[0]
    assert "Carbonara" in top_match["name"]
    assert top_match["scan_confidence"] >= 0.8
    assert top_match["match_reason"]

    monkeypatch.setattr("app.services.menu_service.run_text", lambda **kwargs: "Cacio e Pepe")
    # Match exact OCR text.
    matches_cacio = menu_controller.scan_menu_image(db, menu_id, "Cacio e Pepe.png", JPEG)
    assert len(matches_cacio) >= 1
    assert "Cacio e Pepe" in matches_cacio[0]["name"]
    assert matches_cacio[0]["scan_confidence"] >= 0.95


def test_scan_menu_no_match_fallback():
    db = create_test_db()
    menu = menu_controller.upload_menu(
        db,
        "trattoria_menu.jpg",
        JPEG,
        restaurant_name="Trattoria Roma",
    )
    menu_id = menu["id"]

    # Scan completely unrelated text / item
    matches = menu_controller.scan_menu_image(db, menu_id, "unrelated_xyz_burger_99.jpg", JPEG)
    # Must NOT substitute an unrelated dish from another restaurant or invent a match
    assert len(matches) == 0


def test_dish_explanation_service_and_caching():
    db = create_test_db()
    menu = menu_controller.upload_menu(
        db,
        "trattoria_menu.jpg",
        JPEG,
        restaurant_name="Trattoria Roma",
    )
    menu_id = menu["id"]
    dish = menu["dishes"][0]
    dish_id = dish["id"]

    # Explain dish
    explanation = menu_controller.explain_dish(db, menu_id, dish_id)

    # Validate against DishExplanationSchema
    validated = DishExplanationSchema(**explanation)
    assert validated.dish_id == dish_id
    assert validated.dish_name == dish["name"]
    assert validated.general_explanation
    assert validated.allergy_warning
    assert "Menu text alone cannot establish" in validated.allergy_warning

    # Check distinction between restaurant facts and AI inferences
    assert "name" in validated.restaurant_facts
    assert "culinary_context" in validated.ai_inferences or "general_archetype" in validated.ai_inferences

    # Check alternatives from the same menu
    assert len(validated.alternatives) >= 1
    assert validated.alternatives[0].similarity_reason

    # Test caching: Second call should retrieve cached explanation
    explanation_cached = menu_controller.explain_dish(db, menu_id, dish_id)
    assert explanation_cached["cached"] is True
    assert explanation_cached["dish_name"] == dish["name"]


def test_menu_retry_without_reupload():
    db = create_test_db()
    menu = menu_controller.upload_menu(
        db,
        "trattoria_menu.jpg",
        JPEG,
        restaurant_name="Trattoria Roma",
    )
    menu_id = menu["id"]

    # Retry processing without supplying new file bytes
    retried = menu_controller.retry_menu_processing(db, menu_id)
    assert retried["id"] == menu_id
    assert retried["status"] == "processed"
    assert len(retried["dishes"]) >= 1


def test_invalid_menu_or_dish_id_raises_404():
    db = create_test_db()

    with pytest.raises(HTTPException) as exc:
        menu_controller.get_menu(db, "nonexistent-menu-id")
    assert exc.value.status_code == 404

    with pytest.raises(HTTPException) as exc:
        menu_controller.get_menu_dish(db, "nonexistent-menu", "nonexistent-dish")
    assert exc.value.status_code == 404


def test_thai_menu_upload_does_not_return_italian_dishes():
    """Verify that uploading a Thai menu extracts authentic Thai items and NEVER defaults to Italian."""
    db = create_test_db()
    menu = menu_controller.upload_menu(
        db,
        "bangkok_thai_menu.jpg",
        JPEG + b"thai",
        restaurant_name="Siam Bangkok Bistro",
    )
    assert menu["restaurant_name"] == "Siam Bangkok Bistro"
    dish_names = [d["name"].lower() for d in menu["dishes"]]

    # Must contain Thai items
    assert any("pad thai" in name for name in dish_names)
    assert any("tom yum" in name for name in dish_names)
    assert any("green curry" in name for name in dish_names)

    # Must NEVER contain hardcoded Italian dishes
    assert not any("carbonara" in name for name in dish_names)
    assert not any("cacio e pepe" in name for name in dish_names)
    assert not any("margherita" in name for name in dish_names)
