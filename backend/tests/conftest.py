import pytest
from app.services import dish_explanation_service, dish_image_service, gemini_service, menu_service

@pytest.fixture(autouse=True)
def offline_external_services(monkeypatch):
    for module in (dish_explanation_service, gemini_service, menu_service):
        monkeypatch.setattr(module, "run_structured", lambda **kwargs: (None, None))
    monkeypatch.setattr(menu_service, "run_text", lambda **kwargs: None)
    monkeypatch.setattr(dish_image_service.request, "urlopen", lambda *args, **kwargs: (_ for _ in ()).throw(TimeoutError("offline test")))
