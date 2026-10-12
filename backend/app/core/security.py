"""Keycloak access-token verification (RS256, keys from the realm JWKS endpoint).

The backend never issues tokens or stores passwords: Keycloak is the identity
provider (D04, 2026-10-12).
"""

from functools import lru_cache
from typing import Any

import jwt

from app.core.config import get_settings

JWT_ALGORITHMS = ["RS256"]


@lru_cache
def _jwks_client() -> jwt.PyJWKClient:
    # Caches signing keys; refetches when a token names an unknown key id (key rotation).
    return jwt.PyJWKClient(get_settings().keycloak_jwks_url, cache_keys=True, lifespan=300)


def signing_key_for(token: str) -> Any:
    """Public key matching the token's `kid`. Tests replace this function."""
    return _jwks_client().get_signing_key_from_jwt(token).key


def decode_access_token(token: str) -> dict[str, Any]:
    """Return verified claims; raise jwt.PyJWTError for any unacceptable token.

    Checks signature, expiry, issuer and audience (Keycloak audience mapper `claimwise-api`).
    """
    settings = get_settings()
    return jwt.decode(
        token,
        signing_key_for(token),
        algorithms=JWT_ALGORITHMS,
        issuer=settings.keycloak_issuer,
        audience=settings.keycloak_audience,
        options={"require": ["exp", "iat", "iss", "sub", "aud"]},
    )
