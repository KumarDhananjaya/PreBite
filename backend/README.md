# PreBite API

FastAPI API with MongoDB persistence and Claude menu analysis.
Install `requirements-dev.txt` in a virtual environment. Copy `.env.example` to
`.env` and configure MongoDB, JWT signing, Claude model/key, and CORS origins.

Run: `uvicorn app.main:app --host 0.0.0.0 --port 8001`.
Test: `pytest -q`. Package: `python -m build`.

Production configuration and container instructions are in
[`../docs/deployment.md`](../docs/deployment.md).
