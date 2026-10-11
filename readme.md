# PreBite

Hackathon project helping people choose unfamiliar food with confidence.

## Backend

The FastAPI backend lives in [`backend/`](backend/). It includes JWT authentication,
user profiles, an Italian pasta catalog loaded into MongoDB, taste bridge and flavour map endpoints,
community analogies and first-timer reactions, and passport stamps.

### Run locally

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

API docs are available at `http://localhost:8000/docs`; health check at
`http://localhost:8000/health`. The API connects to MongoDB Atlas at startup and creates
indexes for its collections. Add your Atlas connection details to `backend/.env` before
starting the server.

### Configure MongoDB Atlas

1. In MongoDB Atlas, create a database user and allow your current IP address under
   **Network Access**.
2. Select **Connect > Drivers** and copy the connection string.
3. Paste it into `MONGODB_URI` in `backend/.env`, replacing the username, password, and
   cluster host. If your password contains special characters, URL-encode them.
4. Set `MONGODB_DATABASE` to the database name you want, such as `prebite`.

Keep `.env` private; it is ignored by Git. `JWT_SECRET` should also be set to a long,
random value. The app will report a configuration or connection error at startup if the
Atlas URI is missing, still contains placeholders, or cannot reach the cluster.

### API outline

- `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`
- `GET /api/v1/dishes`, `GET /api/v1/dishes/{dish_id}`
- `GET /api/v1/dishes/{dish_id}/taste-bridge?home_cuisine=Indian`
- `GET /api/v1/dishes/flavour-map`
- `GET /api/v1/community/dishes/{dish_id}/guide` and `/analogies`
- `POST /api/v1/community/dishes/{dish_id}/analogies`, `PUT .../rating` (Bearer token)
- `GET /api/v1/passport`, `POST /api/v1/passport/stamps` (Bearer token)
- `GET/PATCH /api/v1/users/me` (Bearer token)

Use the `Authorization: Bearer <access_token>` header for protected endpoints. The
The starter catalog is in `backend/app/data/dishes.json`. On startup, the API inserts
these dishes only when the MongoDB `dishes` collection is empty. Dish endpoints then
read from MongoDB, so changing a dish document in Atlas changes what the API returns.
The seed file is for initial demo data; it is not re-applied on every startup. Accounts,
analogies, ratings, and passport stamps are also stored in MongoDB. LangChain integration
guidance is in `backend/app/services/README.md`.
