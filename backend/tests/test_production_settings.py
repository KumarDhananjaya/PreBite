import pytest
from app.core.config import Settings


def production(**changes):
    values = dict(environment="production", jwt_secret="a" * 48,
                  mongodb_uri="mongodb://localhost:27017", mongo_allow_invalid_cert=False,
                  cors_origins="https://prebite.example.com")
    values.update(changes)
    return Settings(_env_file=None, **values)


def test_production_accepts_complete_configuration():
    assert production().environment == "production"


@pytest.mark.parametrize("changes", [{"jwt_secret": "short"}, {"mongodb_uri": ""},
    {"mongo_allow_invalid_cert": True}, {"cors_origins": "http://localhost:3000"},
    {"cors_origins": "*"}])
def test_production_rejects_unsafe_or_incomplete_configuration(changes):
    with pytest.raises(ValueError):
        production(**changes)
