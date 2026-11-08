"""Test helpers for sign-in: a local EC key pair stands in for Supabase's signing key."""
import time
import types

import jwt
from cryptography.hazmat.primitives.asymmetric import ec
from jwt import PyJWKClientError

SUPABASE_URL = "https://testproject.supabase.co"
ISSUER = f"{SUPABASE_URL}/auth/v1"
KID = "test-key-1"


def new_key():
    return ec.generate_private_key(ec.SECP256R1())


PRIVATE_KEY = new_key()


class FakeJWKS:
    """Looks like PyJWKClient: returns the public key for a known kid, raises like it does otherwise."""

    def __init__(self, keys=None, fail=None):
        self.keys = keys if keys is not None else {KID: PRIVATE_KEY.public_key()}
        self.fail = fail

    def get_signing_key_from_jwt(self, token):
        if self.fail:
            raise PyJWKClientError(self.fail)
        kid = jwt.get_unverified_header(token).get("kid")
        if kid not in self.keys:
            raise PyJWKClientError(f'Unable to find a signing key that matches: "{kid}"')
        return types.SimpleNamespace(key=self.keys[kid])


def claims(**overrides):
    now = int(time.time())
    base = {
        "iss": ISSUER, "aud": "authenticated", "sub": "11111111-1111-1111-1111-111111111111",
        "email": "person@example.com", "role": "authenticated", "iat": now, "exp": now + 3600,
        "user_metadata": {"email_verified": True},
    }
    base.update(overrides)
    return {k: v for k, v in base.items() if v is not None}


def token(payload=None, key=None, alg="ES256", kid=KID, **overrides):
    payload = payload if payload is not None else claims(**overrides)
    headers = {"kid": kid} if kid else {}
    return jwt.encode(payload, key or PRIVATE_KEY, algorithm=alg, headers=headers)


def bearer(tok):
    return {"Authorization": f"Bearer {tok}"}
