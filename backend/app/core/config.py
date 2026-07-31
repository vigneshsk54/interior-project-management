from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Atelier Flow"
    app_env: str = "development"
    secret_key: str = "development-secret-key-change-me-please"
    database_url: str = "sqlite:///./atelier_flow.db"
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_database: str = "atelier_flow"
    mongodb_timeout_ms: int = 3000
    cors_origins: str = "http://localhost:5173,http://localhost"
    access_token_minutes: int = 30
    refresh_token_days: int = 7
    n8n_webhook_secret: str = "development-webhook-secret"
    upload_dir: str = "uploads"
    max_upload_bytes: int = 20 * 1024 * 1024
    initial_admin_email: str = ""
    initial_admin_password: str = ""
    initial_admin_name: str = "Workspace Administrator"
    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
