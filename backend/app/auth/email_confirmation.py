"""Ask Supabase whether a person's email address was really confirmed (used before accepting an invitation).

An invitation belongs to one email address, and accepting it proves "I own that address" by matching the address in
the sign-in token. That is only true if Supabase confirmed the address before issuing any token (its "Confirm email"
setting, open item O11). The token cannot say so itself (user_metadata is editable by the person), so the check asks
Supabase directly with the server-side secret key.

It FAILS CLOSED: only a clear True lets an invitation be accepted. No key, an unreachable Supabase, an unexpected
answer or an address that does not match all refuse.
"""
from __future__ import annotations

import http.client
import json
import logging
import urllib.error
import urllib.parse
import urllib.request
from typing import Callable

from app.core.config import settings
from app.core.errors import AppError

logger = logging.getLogger("johnsonroad.auth")
_warned = False
_TIMEOUT_SECONDS = 4


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Never follow a redirect: the secret key would be sent along to wherever it points."""

    def redirect_request(self, *args, **kwargs):  # noqa: D102
        return None


_opener = urllib.request.build_opener(_NoRedirect)


def email_is_confirmed(subject: str, email: str) -> bool | None:
    """True/False when Supabase answers; None when the check cannot run (no key). None is NOT a pass."""
    global _warned
    if not settings.supabase_secret_key or not settings.supabase_url:
        if not _warned:
            logger.warning("SUPABASE_SECRET_KEY is not set: invitations cannot be accepted (the server cannot confirm addresses)")
            _warned = True
        return None
    if not settings.supabase_url.startswith("https://"):
        logger.error("SUPABASE_URL is not https: the secret key is never sent over plain http")
        return None
    url = f"{settings.supabase_url}/auth/v1/admin/users/{urllib.parse.quote(subject, safe='')}"
    request = urllib.request.Request(
        url, headers={"apikey": settings.supabase_secret_key, "Authorization": f"Bearer {settings.supabase_secret_key}"}
    )
    try:
        with _opener.open(request, timeout=_TIMEOUT_SECONDS) as response:
            data = json.load(response)
    except (OSError, http.client.HTTPException, ValueError) as exc:  # URLError, timeouts, resets, bad JSON
        logger.error("email confirmation lookup failed: %s", type(exc).__name__)  # the type only: never the request
        raise AppError("auth_unavailable", 503, "Sign-in checking is temporarily unavailable. Try again shortly.") from None
    if not isinstance(data, dict):
        logger.error("email confirmation lookup returned an unexpected answer")
        raise AppError("auth_unavailable", 503, "Sign-in checking is temporarily unavailable. Try again shortly.")
    # The address Supabase holds must be the address in the token, and it must have been confirmed (email only:
    # "confirmed_at" would also be set by confirming a phone number).
    if str(data.get("email", "")).strip().lower() != email.strip().lower():
        return False
    return bool(data.get("email_confirmed_at"))


def get_email_confirmation_check() -> Callable[[str, str], bool | None]:
    """A dependency, so tests can replace the real network call."""
    return email_is_confirmed
