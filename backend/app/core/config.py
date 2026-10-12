"""Application settings, read from environment variables only.

No defaults are provided for connection values: they must be supplied
explicitly (docker-compose passes them from .env). See NF02.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")

    # e.g. postgresql+asyncpg://user:password@db:5432/claimwise
    database_url: str
    app_env: str = "development"

    # Keycloak access-token verification (D04). The issuer is the URL the browser
    # sees (tokens carry it in `iss`); the JWKS URL is how this container reaches Keycloak.
    keycloak_issuer: str  # e.g. http://localhost:8080/realms/claimwise
    keycloak_jwks_url: str  # e.g. http://keycloak:8080/realms/claimwise/protocol/openid-connect/certs
    keycloak_audience: str = "claimwise-api"


@lru_cache
def get_settings() -> Settings:
    return Settings()
