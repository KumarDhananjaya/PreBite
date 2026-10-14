from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "PreBite API"
    api_v1_prefix: str = "/api/v1"

    environment: str = "development"

    # Database
    mongodb_uri: str = ""
    mongodb_database: str = "prebite"
    mongo_allow_invalid_cert: bool = False

    # Authentication
    jwt_secret: str = ""
    jwt_expire_minutes: int = 60

    # Frontend
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    # Optional Google Images search via SerpApi; Wikimedia remains the free fallback.
    serpapi_api_key: str = ""

    # Claude is the only supported AI provider.
    claude_api_key: str = ""
    anthropic_api_key: str = ""
    claude_model: str = "claude-sonnet-5-5"


    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @model_validator(mode="after")
    def sync_claude_keys(self):
        if not self.claude_api_key and self.anthropic_api_key:
            self.claude_api_key = self.anthropic_api_key

        if not self.anthropic_api_key and self.claude_api_key:
            self.anthropic_api_key = self.claude_api_key

        if self.environment == "production":
            if len(self.jwt_secret) < 32 or self.jwt_secret.startswith("replace-"):
                raise ValueError("Production requires a strong JWT_SECRET of at least 32 characters")
            if not self.mongodb_uri or "<" in self.mongodb_uri:
                raise ValueError("Production requires MONGODB_URI")
            if self.mongo_allow_invalid_cert:
                raise ValueError("Production requires MongoDB certificate verification")
            if not self.allowed_origins or any(not origin.startswith("https://") for origin in self.allowed_origins):
                raise ValueError("Production requires explicit HTTPS CORS_ORIGINS")
        return self

    @property
    def allowed_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
