"""Application settings, read from environment variables only.

No defaults are provided for connection values: they must be supplied
explicitly (docker-compose builds DATABASE_URL from .env). See NF02.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")

    # e.g. postgresql+asyncpg://user:password@db:5432/claimwise
    database_url: str
    app_env: str = "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()
