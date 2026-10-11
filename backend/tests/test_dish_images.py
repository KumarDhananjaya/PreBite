from unittest.mock import patch
from app.controllers import menu_controller
from app.db import FallbackDatabase
from app.services.dish_image_service import find_dish_images


def test_lookup_failure_is_optional():
    with patch('app.services.dish_image_service.request.urlopen', side_effect=TimeoutError):
        assert find_dish_images('Pad Thai') == []


def test_old_cache_enriched_persisted_and_reused():
    db = FallbackDatabase([])
    db.menus.insert_one({'id': 'menu', 'dishes': [{'id': 'dish', 'name': 'Pad Thai',
        'explanation_cache': {'dish_id': 'dish', 'dish_name': 'Pad Thai', 'general_explanation': 'Noodles'}}]})
    images = [{'url': 'https://upload.wikimedia.org/food.jpg', 'source_url': 'https://commons.wikimedia.org/wiki/File:Food.jpg', 'license': 'CC BY'}]
    with patch.object(menu_controller, 'find_dish_images', return_value=images) as lookup:
        assert menu_controller.explain_dish(db, 'menu', 'dish')['images'] == images
        assert db.menus.find_one({'id': 'menu'})['dishes'][0]['explanation_cache']['images'] == images
        assert menu_controller.explain_dish(db, 'menu', 'dish')['images'] == images
        lookup.assert_called_once_with('Pad Thai')
