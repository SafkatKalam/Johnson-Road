"""F07: every way a token can be wrong is refused; a good one is accepted. No database needed."""
import logging
import time

import jwt
import pytest
from auth_support import ISSUER, KID, PRIVATE_KEY, SUPABASE_URL, FakeJWKS, claims, new_key, token

from app.auth.tokens import Identity, TokenVerifier
from app.core.errors import AppError


def make(jwks=None, url=SUPABASE_URL):
    return TokenVerifier(url, "authenticated", 10, jwks or FakeJWKS())


def refused(tok, status=401, code="invalid_token", verifier=None):
    with pytest.raises(AppError) as info:
        (verifier or make()).verify(tok)
    assert info.value.http_status == status and info.value.code == code
    return info.value


def test_valid_token_gives_the_identity():
    identity = make().verify(token())
    assert identity == Identity("11111111-1111-1111-1111-111111111111", "person@example.com")


def test_there_is_no_email_verified_field_because_the_token_cannot_prove_it():
    """user_metadata can be edited by the signed-in person, so it must never become a 'verified' flag."""
    forged = make().verify(token(user_metadata={"email_verified": True, "role": "owner"}))
    assert not hasattr(forged, "email_verified") and not hasattr(forged, "role")
    assert forged == make().verify(token(user_metadata=None))  # the metadata changes nothing at all


@pytest.mark.parametrize("bad", ["", "abc", "a.b", "a.b.c", "....", " ", "Bearer x.y.z"])
def test_malformed_tokens_are_refused(bad):
    refused(bad)


def test_missing_token_has_a_www_authenticate_header():
    assert refused("").headers == {"WWW-Authenticate": "Bearer"}


def test_expired_token_is_refused_but_a_few_seconds_of_clock_difference_is_not():
    now = int(time.time())
    refused(token(exp=now - 60))
    assert make().verify(token(exp=now - 5))  # inside the 10 second leeway


def test_token_not_valid_yet_is_refused():
    refused(token(nbf=int(time.time()) + 600))


def test_wrong_issuer_is_refused():
    refused(token(iss="https://evil.supabase.co/auth/v1"))
    refused(token(iss=None))


def test_wrong_audience_is_refused():
    refused(token(aud="someone-else"))
    refused(token(aud=None))


@pytest.mark.parametrize("missing", ["exp", "sub"])
def test_required_claims_must_be_present(missing):
    refused(token(**{missing: None}))


def test_unsigned_token_with_alg_none_is_refused():
    unsigned = jwt.encode(claims(), key=None, algorithm="none", headers={"kid": KID})
    refused(unsigned)


def test_hs256_token_signed_with_the_public_key_is_refused():
    """Algorithm confusion: treating the public key as a shared secret must not work."""
    from cryptography.hazmat.primitives import serialization

    public_pem = PRIVATE_KEY.public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
    import base64
    import hashlib
    import hmac
    import json

    def b64(data: bytes) -> str:
        return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

    header = b64(json.dumps({"alg": "HS256", "typ": "JWT", "kid": KID}).encode())
    body = b64(json.dumps(claims()).encode())
    signature = b64(hmac.new(public_pem, f"{header}.{body}".encode(), hashlib.sha256).digest())
    refused(f"{header}.{body}.{signature}")  # built by hand, the way an attacker would


def test_token_signed_by_another_key_is_refused():
    refused(token(key=new_key()))  # same kid, different private key


def test_unknown_key_id_is_refused_not_an_outage():
    refused(token(kid="rotated-away"))


def test_tampered_payload_is_refused():
    head, body, sig = token().split(".")
    forged_body = token(sub="99999999-9999-9999-9999-999999999999").split(".")[1]
    refused(f"{head}.{forged_body}.{sig}")


def test_anonymous_user_is_refused_with_403():
    refused(token(is_anonymous=True), status=403, code="anonymous_not_allowed")


@pytest.mark.parametrize("email", [None, "", "not-an-email", 5])
def test_token_without_a_usable_email_is_refused(email):
    refused(token(email=email) if email is not None else token(email=None))


def test_role_claims_in_the_token_grant_nothing():
    identity = make().verify(token(role="service_role", user_metadata={"role": "owner", "email_verified": True}))
    assert not hasattr(identity, "role")  # the identity carries no permission at all


def test_signing_key_outage_fails_closed_with_503():
    refused(token(), status=503, code="auth_unavailable",
            verifier=make(FakeJWKS(fail="Fail to fetch data from the url, err: timed out")))


def test_server_without_a_supabase_url_answers_503_never_lets_anyone_in():
    refused(token(), status=503, code="auth_not_configured", verifier=TokenVerifier(None, "authenticated", 10))


def test_a_refused_token_is_never_written_to_the_log(caplog):
    secret_token = token(exp=int(time.time()) - 600)
    with caplog.at_level(logging.DEBUG):
        with pytest.raises(AppError):
            make().verify(secret_token)
    assert secret_token not in caplog.text and secret_token.split(".")[1] not in caplog.text


def test_issuer_is_built_from_the_project_url():
    assert make().issuer == ISSUER


def test_key_rotation_new_key_works_once_published():
    new = new_key()
    jwks = FakeJWKS({"rotated": new.public_key()})
    refused(token(key=new, kid="rotated"), verifier=make(FakeJWKS()))        # not published yet
    assert make(jwks).verify(token(key=new, kid="rotated"))                  # published
