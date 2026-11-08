"""F07: the real PyJWKClient against a local key server (the other tests use a fake key list)."""
import http.server
import json
import threading
import time

import jwt
import pytest
from auth_support import KID, PRIVATE_KEY, claims, new_key, token
from jwt.algorithms import ECAlgorithm

from app.auth.tokens import TokenVerifier
from app.core.errors import AppError

URL = "http://127.0.0.1"  # the verifier accepts http only for localhost-style addresses in tests below


def _jwk(key, kid):
    data = json.loads(ECAlgorithm.to_jwk(key.public_key()))
    data.update({"kid": kid, "alg": "ES256", "use": "sig"})
    return data


@pytest.fixture()
def key_server():
    """Serves /auth/v1/.well-known/jwks.json and counts how often it is downloaded."""
    state = {"keys": [_jwk(PRIVATE_KEY, KID)], "hits": 0, "status": 200}

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):  # noqa: N802
            state["hits"] += 1
            body = json.dumps({"keys": state["keys"]}).encode()
            self.send_response(state["status"])
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args):  # keep the test output quiet
            pass

    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    state["url"] = f"http://127.0.0.1:{server.server_port}"
    yield state
    server.shutdown()


def verifier_for(state):
    return TokenVerifier(state["url"], "authenticated", 10)


def good(state, **kw):
    return token(iss=f"{state['url']}/auth/v1", **kw)


def test_real_client_verifies_a_valid_token_and_downloads_the_keys_once(key_server):
    v = verifier_for(key_server)
    for _ in range(5):
        assert v.verify(good(key_server)).email == "person@example.com"
    assert key_server["hits"] == 1


def test_random_key_ids_cannot_force_repeated_downloads(key_server):
    v = verifier_for(key_server)
    for i in range(30):
        with pytest.raises(AppError) as info:
            v.verify(good(key_server, kid=f"random-{i}"))
        assert info.value.http_status == 401
    assert key_server["hits"] <= 2  # the first download plus at most one for the first unknown id


def test_a_known_good_key_still_works_while_unknown_ids_are_paused(key_server):
    v = verifier_for(key_server)
    assert v.verify(good(key_server))
    with pytest.raises(AppError):
        v.verify(good(key_server, kid="unknown-1"))
    assert v.verify(good(key_server))  # not blocked by the pause


def test_a_rotated_in_key_works_after_the_pause_ends(key_server):
    v = verifier_for(key_server)
    assert v.verify(good(key_server))
    new = new_key()
    key_server["keys"].append(_jwk(new, "rotated-2"))
    rotated = good(key_server, key=new, kid="rotated-2")
    v._blocked_until = 0.0  # stand-in for "10 seconds have passed"
    # the client's cached key list is stale, so force it to look again, as a real rotation would
    v._jwk_client.jwk_set_cache = None
    assert v.verify(rotated)


def test_key_server_down_is_503_not_401_and_not_allowed(key_server):
    key_server["status"] = 500
    v = verifier_for(key_server)
    with pytest.raises(AppError) as info:
        v.verify(good(key_server))
    assert info.value.http_status == 503 and info.value.code == "auth_unavailable"


def test_token_without_a_key_id_is_refused(key_server):
    v = verifier_for(key_server)
    with pytest.raises(AppError) as info:
        v.verify(jwt.encode(claims(iss=f"{key_server['url']}/auth/v1"), PRIVATE_KEY, algorithm="ES256"))
    assert info.value.http_status == 401


def test_token_issued_in_the_future_is_refused(key_server):
    v = verifier_for(key_server)
    with pytest.raises(AppError):
        v.verify(good(key_server, iat=int(time.time()) + 3600))


def test_rs256_tokens_are_accepted_when_the_key_list_has_an_rsa_key(key_server):
    from cryptography.hazmat.primitives.asymmetric import rsa
    from jwt.algorithms import RSAAlgorithm

    rsa_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    jwk = json.loads(RSAAlgorithm.to_jwk(rsa_key.public_key()))
    jwk.update({"kid": "rsa-1", "alg": "RS256", "use": "sig"})
    key_server["keys"].append(jwk)
    v = verifier_for(key_server)
    tok = jwt.encode(claims(iss=f"{key_server['url']}/auth/v1"), rsa_key, algorithm="RS256", headers={"kid": "rsa-1"})
    assert v.verify(tok).email == "person@example.com"
