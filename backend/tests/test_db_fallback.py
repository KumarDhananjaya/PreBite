from unittest.mock import patch
import pytest
from app.db import init_db


def test_unconfigured_database_starts_with_demo_data():
    with patch("app.db.get_mongo_client", return_value=None):
        init_db()


def test_configured_database_failure_surfaces():
    with patch("app.db.get_mongo_client", side_effect=RuntimeError("Mongo unavailable")):
        with pytest.raises(RuntimeError, match="Mongo unavailable"):
            init_db()
