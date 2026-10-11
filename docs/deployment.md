# Deploy PreBite

Use Node 22 and Python 3.12. Deploy the frontend and backend as separate services.

## Backend

Build a wheel with `cd backend && python -m build`, or build the Dockerfile from
`backend/`. On a Python host install `pip install -r requirements.txt`, then run
`uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers`.
Set `ENVIRONMENT=production`, `MONGODB_URI`, `MONGODB_DATABASE`, `JWT_SECRET`
(at least 32 random characters), `CORS_ORIGINS` (the exact HTTPS frontend origin),
`CLAUDE_API_KEY`, and a `CLAUDE_MODEL` supported by your account. Leave
`MONGO_ALLOW_INVALID_CERT=false`. Allow the deployment host in Atlas Network Access.
Health endpoint: `/health`; API routes: `/api/v1`; API docs: `/docs`.
Database connection failures intentionally stop startup rather than lose writes.

## Frontend

Set `NEXT_PUBLIC_API_BASE_URL=https://YOUR-API-HOST/api/v1` **before building**.
The browser must reach this address; a private container hostname will not work.
On a Node host use `npm ci && npm run build`, then `npm start`.
For a container, build `frontend/Dockerfile` with the same variable as a build arg.
The standalone image listens on port 3000. Serve both services behind HTTPS.

## Local containers

Copy `backend/.env.example` to `backend/.env` and set values.
Run `NEXT_PUBLIC_API_BASE_URL=http://localhost:8001/api/v1 docker compose up --build`.
This is a local development example; replace URLs and enable production settings
on the deployment host.

## Limits and operational notes

Uploaded menus currently allow anonymous access: possession of a menu ID permits
reading and editing it. Deploy as a demo until menu ownership/authentication and
rate limits are implemented for public multi-user use. Add proxy request size
limits and rate limits before exposing uploads publicly. Each uploaded file is
limited to 20 MB; proxy limits must also bound total request size.
Original upload bytes are not retained by default, so retry requires re-uploading.
MongoDB retains extracted dishes, explanations, and web image links. Commons image
search is optional and may return no match; photos are illustrative with source
credits. Third-party API availability and model access require a live deployment
smoke test. Never place private keys in NEXT_PUBLIC variables.

## Release verification

Run `cd backend && pytest -q && python -m build` and
`cd frontend && npm ci && npm run typecheck && npm run build`.
Check `/health`, account registration/login, menu upload, dish details, image
credits, and cached repeat loading on the target host. Check browser requests and
CORS against the actual deployed API URL. Back up MongoDB before releases.
