"""Verify Supabase access tokens (F07; O48: Supabase signs people in, this backend owns the data).

Rules:
- Only asymmetric algorithms are accepted (ES256, RS256). A token that claims HS256 or "none" is refused,
  so nobody can sign a token with the public key as if it were a shared secret.
- The signature is checked with the project's public key from its JWKS endpoint. The key is cached;
  an unknown key id triggers one refresh, so key rotation works without a restart.
- Issuer, audience, expiry and subject are all required and checked.
- If the keys cannot be fetched, the request is refused with 503 (fail closed), never allowed.
- Nothing from the token's own role or metadata claims grants access: roles come from backend PostgreSQL.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass

import jwt
from jwt import PyJWKClient, PyJWKClientError

from app.core.config import settings
from app.core.errors import AppError

logger = logging.getLogger("johnsonroad.auth")

ALLOWED_ALGORITHMS = ["ES256", "RS256"]
_BEARER_HEADER = {"WWW-Authenticate": "Bearer"}


@dataclass(frozen=True)
class Identity:
    """Who the token says the caller is. Only fields this backend needs; nothing here is a permission.

    There is deliberately NO "email verified" field. The only place a token carries such a flag is
    user_metadata, which the signed-in person can edit themselves, so it cannot be trusted.
    Today Supabase's own "Confirm email" setting is what stops an unconfirmed address from getting any
    token at all (open item O11). If that setting is ever turned off, nothing here may treat the email
    as proven: do not match invitations or merge accounts by email until a server-set source exists.
    """

    subject: str  # the Supabase user id ("sub"), stored as users.auth_subject
    email: str


def _invalid(reason: str) -> AppError:
    # The reason goes to the log; the client always gets the same plain message.
    logger.info("token refused: %s", reason)
    return AppError("invalid_token", 401, "Your sign-in is missing, expired or not valid. Please sign in again.",
                    headers=_BEARER_HEADER)


class TokenVerifier:
    MISS_PAUSE_SECONDS = 10  # after an unknown key id, other unknown ids are refused this long without a download

    def __init__(self, supabase_url: str | None, audience: str, leeway: int, jwk_client: PyJWKClient | None = None):
        self.audience = audience
        self.leeway = leeway
        self._known_kids: set[str] = set()
        self._blocked_until = 0.0
        self.issuer = f"{supabase_url}/auth/v1" if supabase_url else None
        self._jwk_client = jwk_client
        if jwk_client is None and supabase_url:
            self._jwk_client = PyJWKClient(
                f"{supabase_url}/auth/v1/.well-known/jwks.json", cache_keys=True, lifespan=3600, timeout=5
            )

    def verify(self, token: str) -> Identity:
        if self._jwk_client is None or self.issuer is None:
            raise AppError("auth_not_configured", 503, "Sign-in checking is not set up on the server.")
        if not token or token.count(".") != 2:
            raise _invalid("malformed token")
        try:
            header = jwt.get_unverified_header(token)
        except jwt.PyJWTError:
            raise _invalid("unreadable header") from None
        if header.get("alg") not in ALLOWED_ALGORITHMS:
            # The value is attacker-chosen: log only a short, printable slice of it.
            shown = str(header.get("alg"))[:12].encode("ascii", "replace").decode()
            raise _invalid(f"algorithm {shown!r} not allowed")
        kid = header.get("kid")
        kid = kid if isinstance(kid, str) else None
        # An unknown key id makes PyJWKClient download the key list again. Anyone can send random key ids for
        # free, so after one miss further unknown ids are refused for a short time WITHOUT another download.
        # A key id that has verified a token before is always allowed through.
        if kid not in self._known_kids and time.monotonic() < self._blocked_until:
            raise _invalid("unknown signing key (lookup paused)")
        try:
            signing_key = self._jwk_client.get_signing_key_from_jwt(token)
        except PyJWKClientError as exc:
            if "Unable to find a signing key" in str(exc):
                self._blocked_until = time.monotonic() + self.MISS_PAUSE_SECONDS
                raise _invalid("unknown signing key") from None
            logger.error("signing keys unavailable: %s", type(exc).__name__)
            raise AppError("auth_unavailable", 503, "Sign-in checking is temporarily unavailable. Try again shortly.") from None
        except jwt.PyJWTError:
            raise _invalid("unusable signing key") from None
        try:
            claims = jwt.decode(
                token,
                signing_key.key,
                algorithms=ALLOWED_ALGORITHMS,
                audience=self.audience,
                issuer=self.issuer,
                leeway=self.leeway,
                options={"require": ["exp", "sub", "iss", "aud"]},
            )
        except jwt.ExpiredSignatureError:
            raise _invalid("expired") from None
        except jwt.PyJWTError as exc:
            raise _invalid(type(exc).__name__) from None
        if kid is not None and len(self._known_kids) < 50:
            self._known_kids.add(kid)  # this key id produced a valid signature: it is a real key

        subject = claims.get("sub")
        email = claims.get("email")
        if not isinstance(subject, str) or not subject:
            raise _invalid("no subject")
        if claims.get("is_anonymous"):
            raise AppError("anonymous_not_allowed", 403, "Please sign in with an email address.")
        if not isinstance(email, str) or "@" not in email:
            raise _invalid("no email claim")
        return Identity(subject=subject, email=email.strip())


_verifier: TokenVerifier | None = None


def get_verifier() -> TokenVerifier:
    global _verifier
    if _verifier is None:
        _verifier = TokenVerifier(settings.supabase_url, settings.supabase_jwt_audience, settings.jwt_leeway_seconds)
    return _verifier
