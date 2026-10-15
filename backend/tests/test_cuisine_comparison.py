from app.services import cuisine_comparison_service as service


def test_comparison_uses_selected_cuisine_and_validates_rows(monkeypatch):
    expected = {
        "familiar_dish": "Dal",
        "summary": "A comforting analogy with different ingredients.",
        "rows": [{"aspect": aspect, "dish": "Menu context", "home": "Home context",
                  "difference": "Different preparation"} for aspect in service.ASPECTS],
    }

    def structured(**kwargs):
        assert 'North Indian' in kwargs['prompt']
        assert 'Soup' in kwargs['prompt']
        assert kwargs['accept'](expected)
        assert not kwargs['accept']({**expected, 'rows': []})
        assert not kwargs['accept']({**expected, 'rows': [{}] * 5})
        return expected, 'test'

    monkeypatch.setattr(service, 'run_structured', structured)
    assert service.compare_home_cuisine({'name': 'Soup'}, 'North Indian') == {
        'home_cuisine': 'North Indian', 'comparison': expected,
    }


def test_unavailable_service_does_not_invent_comparison(monkeypatch):
    monkeypatch.setattr(service, 'run_structured', lambda **kwargs: (None, None))
    assert service.compare_home_cuisine({'name': 'Soup'}, 'Japanese')['comparison'] is None
