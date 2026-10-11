from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.db import close_mongo_client, init_db
from app.routes import auth, community, dishes, menus, passport, users

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    try:
        yield
    finally:
        close_mongo_client()


app = FastAPI(title=settings.app_name, version="0.1.0", description="PreBite food discovery API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.allowed_origins, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok", "service": "prebite-api"}


for route in (auth.router, users.router, dishes.router, menus.router, community.router, passport.router):
    app.include_router(route, prefix=settings.api_v1_prefix)

# Also expose menus at root /menus/... for direct path compatibility
app.include_router(menus.router)
