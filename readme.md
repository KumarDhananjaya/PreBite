# PreBite

A menu scanning and food discovery app built with Next.js, React, and FastAPI.
Upload restaurant menu images or PDFs, browse extracted dishes, read grounded AI
explanations, and view web reference photos with attribution.

## Local setup

Use Node 22 and Python 3.12.

```sh
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8001
```

Set `CLAUDE_API_KEY` and a supported `CLAUDE_MODEL` for OCR and AI explanations.
Set MongoDB for persistent storage. With no MongoDB configuration, seed data is
available for demonstration; use MongoDB for account and menu workflows.
Configured MongoDB failures surface instead of silently dropping data.

```sh
cd frontend
npm ci
cp .env.local.example .env.local
npm run dev
```

Frontend: http://localhost:3000. API docs: http://localhost:8001/docs.

## Verification

```sh
cd backend
pytest -q
python -m build
```

```sh
cd frontend
npm run typecheck
npm run build
```

Unit tests mock external services and do not use API credits. Run
`python test_claude.py` manually to verify your configured model.

## Deploy

See [deployment instructions](docs/deployment.md) for Docker, hosted Node/Python,
production environment variables, persistence, and current demo limitations.
CI builds both apps and uploads the backend wheel.

## Menu API

Routes use `/api/v1/menus`: upload (`POST /upload`), list (`GET /`), retrieve
(`GET /{id}`), dishes (`GET /{id}/dishes`), corrections
(`PATCH /{id}/dishes/{dish_id}`), scan (`POST /{id}/scan`), explanations
(`POST /{id}/dishes/{dish_id}/explain`), and retry (`POST /{id}/retry`).
Restaurant facts and culinary inferences are distinguished. Menu text cannot
establish allergy safety: verify ingredients and preparation with restaurant staff.
Web photos are illustrative and stored with Wikimedia Commons source credits.
