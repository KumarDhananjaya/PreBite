import io
import json
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse
from unittest.mock import patch

import pytest
from app.services import dish_image_service
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
        lookup.assert_called_once_with('Pad Thai', None)



@pytest.fixture(autouse=True)
def clear_image_cache():
    dish_image_service._CACHE.clear()
    yield
    dish_image_service._CACHE.clear()


def response(data):
    return io.BytesIO(json.dumps(data).encode())


def google_result(title='Miso Ramen recipe', **overrides):
    return {'title': title, 'original': 'https://recipes.example/miso-ramen.jpg',
            'link': 'https://recipes.example/miso-ramen', 'source': 'Recipes',
            'original_width': 1200, 'original_height': 900, **overrides}


def test_google_query_keeps_dish_and_cuisine_and_prefers_closest_results(monkeypatch):
    monkeypatch.setattr(dish_image_service, 'get_settings', lambda: SimpleNamespace(serpapi_api_key='test-key'))
    with patch.object(dish_image_service.request, 'urlopen', return_value=response({'images_results': [
        google_result('Pasta recipes', original='https://recipes.example/pasta.jpg'), google_result('Ramen noodles', original='https://recipes.example/ramen.jpg'), google_result()]})) as lookup:
        images = find_dish_images('Miso Ramen', 'Japanese')
    query = parse_qs(urlparse(lookup.call_args.args[0].full_url).query)
    assert query['engine'] == ['google_images']
    assert query['q'] == ['Miso Ramen Japanese plated food']
    assert len(images) == 3
    assert images[0]["title"] == "Miso Ramen recipe"
    assert images[1]["title"] == "Ramen noodles"
    assert images[0]['provider'] == 'google_images'
    assert images[0]['source_url'] == 'https://recipes.example/miso-ramen'


@pytest.mark.parametrize('overrides', [
    {'original': 'javascript:alert(1)'}, {'original': 'https://127.0.0.1/image.jpg'},
    {'original': 'https://images.unsplash.com/stock.jpg'}, {'link': 'http://recipes.example/ramen'},
    {'original_width': 100, 'original_height': 100}, {'original': 'https://user:secret@recipes.example/image.jpg'},
])
def test_google_rejects_unsafe_stock_or_tiny_images(monkeypatch, overrides):
    monkeypatch.setattr(dish_image_service, 'get_settings', lambda: SimpleNamespace(serpapi_api_key='test-key'))
    with patch.object(dish_image_service.request, 'urlopen', side_effect=[
        response({'images_results': [google_result(**overrides)]}), response({})]):
        assert find_dish_images('Miso Ramen') == []


def commons_result():
    return {'query': {'pages': {'1': {'title': 'File:Pad Thai dish.jpg', 'imageinfo': [{
        'thumburl': 'https://upload.wikimedia.org/pad-thai.jpg',
        'descriptionurl': 'https://commons.wikimedia.org/wiki/File:Pad_Thai.jpg',
        'mime': 'image/jpeg', 'extmetadata': {'LicenseShortName': {'value': 'CC BY'},
                                           'Artist': {'value': '<b>Cook</b>'}}}]}}}}


def test_free_fallback_without_key_preserves_attribution(monkeypatch):
    monkeypatch.setattr(dish_image_service, 'get_settings', lambda: SimpleNamespace(serpapi_api_key=''))
    with patch.object(dish_image_service.request, 'urlopen', return_value=response(commons_result())) as lookup:
        images = find_dish_images('Pad Thai')
    assert urlparse(lookup.call_args.args[0].full_url).hostname == 'commons.wikimedia.org'
    assert images[0]['artist'] == 'Cook'
    assert images[0]['license'] == 'CC BY'
    assert images[0]['provider'] == 'wikimedia'


def test_google_failure_falls_back_without_logging_key(monkeypatch, caplog):
    monkeypatch.setattr(dish_image_service, 'get_settings', lambda: SimpleNamespace(serpapi_api_key='private-test-key'))
    with patch.object(dish_image_service.request, 'urlopen', side_effect=[
        TimeoutError('https://serpapi.com/search?api_key=private-test-key'), response(commons_result())]):
        assert find_dish_images('Pad Thai')[0]['provider'] == 'wikimedia'
    assert 'private-test-key' not in caplog.text


def test_cache_reuses_success_without_mutable_aliases(monkeypatch):
    monkeypatch.setattr(dish_image_service, 'get_settings', lambda: SimpleNamespace(serpapi_api_key='test-key'))
    with patch.object(dish_image_service.request, 'urlopen', return_value=response({'images_results': [google_result()]})) as lookup:
        images = find_dish_images('Miso Ramen', 'Japanese')
        images[0]['url'] = 'changed'
        assert find_dish_images('Miso Ramen', 'Japanese')[0]['url'] != 'changed'
        assert lookup.call_count == 1


def test_legacy_menu_catalog_images_are_refreshed_and_persisted():
    db = FallbackDatabase([])
    db.menus.insert_one({'id': 'old-menu', 'dishes': [{'id': 'dish', 'name': 'Pad Thai',
        'image_url': 'https://images.unsplash.com/stock.jpg', 'photo': 'https://source.unsplash.com/featured'}]})
    images = [{'url': 'https://recipes.example/pad-thai.jpg', 'source_url': 'https://recipes.example/pad-thai',
               'source': 'Recipes', 'provider': 'google_images'}]
    with patch.object(menu_controller, 'find_dish_images', return_value=images) as lookup:
        menu = menu_controller.get_menu(db, 'old-menu')
        assert menu['dishes'][0]['image_url'] == images[0]['url']
        assert menu_controller.get_menu(db, 'old-menu')['dishes'][0]['image_source_url'] == images[0]['source_url']
        assert lookup.call_count == 1
    assert db.menus.find_one({'id': 'old-menu'})['dishes'][0]['photo'] == images[0]['url']


def test_uploaded_catalog_uses_search_result_and_source_metadata():
    from app.services import menu_service
    class Provider:
        def extract(self, *args, **kwargs):
            return [{'name': 'Miso Ramen', 'cuisine': 'Japanese', 'confidence': .9,
                     'image_url': 'https://images.unsplash.com/not-trusted.jpg'}]
    images = [{'url': 'https://recipes.example/miso-ramen.jpg', 'source_url': 'https://recipes.example/miso-ramen',
               'provider': 'google_images', 'source': 'Recipes'}]
    with patch.object(menu_service, 'find_dish_images', return_value=images) as lookup:
        menu = menu_service.MenuService(provider=Provider()).build_menu_document(
            restaurant_name=None, file_name_or_files='menu.jpg', file_bytes=b'\xff\xd8\xfffixture')
    dish = menu['dishes'][0]
    assert dish['image_url'] == images[0]['url']
    assert dish['photo'] == images[0]['url']
    assert dish['image_source_url'] == images[0]['source_url']
    lookup.assert_called_once_with('Miso Ramen', 'Japanese')


def test_name_correction_refreshes_photo_instead_of_reusing_wrong_dish():
    db = FallbackDatabase([])
    db.menus.insert_one({'id': 'menu', 'dishes': [{'id': 'dish', 'name': 'Ramen',
        'image_url': 'https://recipes.example/ramen.jpg'}]})
    images = [{'url': 'https://recipes.example/miso-ramen.jpg'}]
    with patch.object(menu_controller, 'find_dish_images', return_value=images):
        dish = menu_controller.update_menu_dish(db, 'menu', 'dish', {'name': 'Miso Ramen'})
    assert dish['image_url'] == images[0]['url']


def test_free_search_accepts_nearby_dish_when_exact_name_is_missing(monkeypatch):
    monkeypatch.setattr(dish_image_service, 'get_settings', lambda: SimpleNamespace(serpapi_api_key=''))
    data = commons_result()
    data['query']['pages']['1']['title'] = 'File:Thai noodles.jpg'
    with patch.object(dish_image_service.request, 'urlopen', return_value=response(data)):
        assert find_dish_images('Pad Thai')[0]['title'] == 'Thai noodles.jpg'


def test_google_accepts_top_related_result_without_literal_name_match(monkeypatch):
    monkeypatch.setattr(dish_image_service, 'get_settings', lambda: SimpleNamespace(serpapi_api_key='test-key'))
    with patch.object(dish_image_service.request, 'urlopen', return_value=response({
        'images_results': [google_result('Japanese noodle soup')]})):
        assert find_dish_images('Miso Ramen')[0]['title'] == 'Japanese noodle soup'
