"""F21: local storage adapter. Uses a temporary folder; no database."""
import hashlib
import os
import sys
import uuid

import pytest

from app.storage import (
    LocalStorage,
    StorageKeyError,
    StorageNotFound,
    StorageTooLarge,
    StorageUnavailable,
    key_belongs_to,
    make_key,
)

ORG, PROJ = str(uuid.uuid4()), str(uuid.uuid4())


@pytest.fixture()
def store(tmp_path):
    root = tmp_path / "data"
    root.mkdir()
    return LocalStorage(root)


def test_key_is_generated_and_never_contains_a_client_name():
    key = make_key(ORG, PROJ, "MP4")
    org, proj, name = key.split("/")
    assert (org, proj) == (ORG, PROJ) and name.endswith(".mp4") and len(name) == 40


@pytest.mark.parametrize("bad", [
    "../etc/passwd", "/abs/path.mp4", "C:\\x.mp4", "a/b/c.mp4", f"{ORG}/{PROJ}/../x.mp4",
    f"{ORG}/{PROJ}/{uuid.uuid4()}.exe", f"{ORG}/{PROJ}/{uuid.uuid4()}.mp4/", f"{ORG}/{PROJ}/my video.mp4",
    f"{ORG}\\{PROJ}\\{uuid.uuid4()}.mp4", f"{ORG}/{PROJ}/{uuid.uuid4()}.mp4\x00.jpg", "", f"{ORG.upper()}/{PROJ}/{uuid.uuid4()}.mp4",
])
def test_malformed_or_hostile_keys_are_refused(store, bad):
    for call in (lambda: store.resolve("sources", bad), lambda: store.exists("sources", bad), lambda: store.open_read("sources", bad),
                 lambda: store.delete("sources", bad)):
        with pytest.raises(StorageKeyError):
            call()


def test_unknown_area_is_refused(store):
    with pytest.raises(StorageKeyError):
        store.resolve("../sources", make_key(ORG, PROJ, "mp4"))


def test_write_read_checksum_and_areas_are_separate(store):
    key = make_key(ORG, PROJ, "mp4")
    size, sha = store.write_stream("sources", key, iter([b"abc", b"def"]), max_bytes=100)
    assert size == 6 and sha == hashlib.sha256(b"abcdef").hexdigest()
    with store.open_read("sources", key) as f:
        assert f.read() == b"abcdef"
    assert store.exists("sources", key) and not store.exists("outputs", key)


def test_over_size_write_leaves_nothing_behind(store):
    key = make_key(ORG, PROJ, "mp4")
    with pytest.raises(StorageTooLarge):
        store.write_stream("sources", key, iter([b"x" * 60, b"x" * 60]), max_bytes=100)
    assert not store.exists("sources", key)
    assert [p for p in (store.root / "sources").rglob("*") if p.is_file()] == []


def test_interrupted_write_leaves_nothing_behind(store):
    key = make_key(ORG, PROJ, "mp4")

    def broken():
        yield b"abc"
        raise ConnectionError("client went away")

    with pytest.raises(ConnectionError):
        store.write_stream("sources", key, broken(), max_bytes=100)
    assert [p for p in (store.root / "sources").rglob("*") if p.is_file()] == []


def test_existing_object_is_never_overwritten(store):
    key = make_key(ORG, PROJ, "mp4")
    store.write_stream("sources", key, iter([b"first"]), max_bytes=100)
    with pytest.raises(StorageKeyError):
        store.write_stream("sources", key, iter([b"second"]), max_bytes=100)
    with store.open_read("sources", key) as f:
        assert f.read() == b"first"


def test_missing_object_is_not_found_but_missing_root_is_unavailable(tmp_path, store):
    key = make_key(ORG, PROJ, "mp4")
    with pytest.raises(StorageNotFound):
        store.open_read("sources", key)
    gone = LocalStorage(tmp_path / "does-not-exist")
    with pytest.raises(StorageUnavailable):
        gone.open_read("sources", key)


def test_delete_reports_whether_anything_was_removed(store):
    key = make_key(ORG, PROJ, "mp4")
    assert store.delete("sources", key) is False
    store.write_stream("sources", key, iter([b"x"]), max_bytes=10)
    assert store.delete("sources", key) is True and not store.exists("sources", key)


def test_another_organisation_does_not_own_the_key():
    key = make_key(ORG, PROJ, "mp4")
    assert key_belongs_to(key, ORG) and not key_belongs_to(key, uuid.uuid4())
    with pytest.raises(StorageKeyError):
        key_belongs_to("../x", ORG)


def test_a_link_inside_the_area_is_not_followed(store, tmp_path):
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "secret.mp4").write_bytes(b"secret")
    area = store.root / "sources"
    area.mkdir()
    link = area / ORG
    try:
        os.symlink(outside, link, target_is_directory=True)
    except (OSError, NotImplementedError):
        if sys.platform == "win32":
            import subprocess
            r = subprocess.run(["cmd", "/c", "mklink", "/J", str(link), str(outside)], capture_output=True)  # junction needs no admin
            if r.returncode != 0:
                pytest.skip("cannot create a link or junction here")
        else:
            pytest.skip("cannot create a link here")
    key = f"{ORG}/{PROJ}/{uuid.uuid4()}.mp4"
    with pytest.raises(StorageKeyError):
        store.resolve("sources", key)
    with pytest.raises(StorageKeyError):
        store.write_stream("sources", key, iter([b"x"]), max_bytes=10)
    assert list(outside.rglob("*.mp4")) == [outside / "secret.mp4"]
