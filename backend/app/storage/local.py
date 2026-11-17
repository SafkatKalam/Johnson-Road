"""Storage interface and the local-disk adapter (F21).

Rules this module enforces (REQUIREMENTS 4.13-4.14, defect D4):
- Source videos, preview frames and annotated outputs live in separate areas under one root.
- A stored object's name is generated here: "<organisation id>/<project id>/<object id>.<ext>". The client's file name is
  never part of a path.
- A key is checked against a strict pattern, and the final path is checked to still be inside the area after symlinks
  and Windows junctions are resolved, so "../" tricks, absolute paths and links cannot escape.
- "The disk cannot be used" (StorageUnavailable) is a different failure from "that object is not there" (StorageNotFound).
- Whether a caller may read an object is decided by the caller's organisation: `key_belongs_to` compares the first
  key segment. A future cloud adapter must keep the same methods and the same key format.
"""
from __future__ import annotations

import hashlib
import os
import re
import uuid
from pathlib import Path
from typing import BinaryIO, Iterable
from uuid import UUID

from app.core.config import settings

AREAS = ("sources", "previews", "outputs")
EXTENSIONS = ("mp4", "mkv", "avi", "jpg", "png", "csv", "pdf")  # sources: O18 list; previews: jpg; outputs: annotated video, exports

_UUID = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
_KEY = re.compile(rf"^({_UUID})/({_UUID})/({_UUID})\.({'|'.join(EXTENSIONS)})$")
_FILE_ATTRIBUTE_REPARSE_POINT = 0x400  # Windows junctions and symlinks


class StorageKeyError(ValueError):
    """The key or area is not one this module would ever have generated."""


class StorageNotFound(FileNotFoundError):
    """The key is valid but nothing is stored under it."""


class StorageUnavailable(OSError):
    """The storage location cannot be used (missing, no permission, disk full)."""


class StorageTooLarge(Exception):
    """A write went over the allowed size and was discarded."""


def make_key(organization_id: UUID | str, project_id: UUID | str, extension: str, object_id: UUID | str | None = None) -> str:
    key = f"{str(organization_id).lower()}/{str(project_id).lower()}/{str(object_id or uuid.uuid4()).lower()}.{extension.lower().lstrip('.')}"
    _check_key(key)
    return key


def _check_key(key: str) -> None:
    if not isinstance(key, str) or len(key) > 200 or not _KEY.fullmatch(key):
        raise StorageKeyError("not a valid storage key")


def key_belongs_to(key: str, organization_id: UUID | str) -> bool:
    """True only when the key sits under this organisation. Call before serving any object."""
    _check_key(key)
    return key.split("/", 1)[0] == str(organization_id).lower()


def _is_link(path: Path) -> bool:
    try:
        st = path.lstat()
    except FileNotFoundError:
        return False
    if path.is_symlink():
        return True
    return bool(getattr(st, "st_file_attributes", 0) & _FILE_ATTRIBUTE_REPARSE_POINT)


class LocalStorage:
    def __init__(self, root: Path):
        self.root = Path(root)

    # --- paths ---------------------------------------------------------------------

    def _area_dir(self, area: str) -> Path:
        if area not in AREAS:
            raise StorageKeyError("unknown storage area")
        return self.root / area

    def resolve(self, area: str, key: str) -> Path:
        """The real file path for a key, proven to be inside its area (no links followed out of it)."""
        _check_key(key)
        base = self._area_dir(area)
        path = base / key
        try:
            real_base = base.resolve(strict=False)
            real = path.resolve(strict=False)
        except (OSError, RuntimeError) as exc:  # RuntimeError: symlink loop on older Pythons
            raise StorageUnavailable("storage path cannot be resolved") from exc
        if not real.is_relative_to(real_base):
            raise StorageKeyError("key resolves outside its area")
        # Refuse any link between the area and the file, even one that happens to point back inside.
        cur = base
        for part in Path(key).parts:
            cur = cur / part
            if _is_link(cur):
                raise StorageKeyError("links are not followed")
        return path

    # --- operations ----------------------------------------------------------------

    def write_stream(self, area: str, key: str, chunks: Iterable[bytes], *, max_bytes: int) -> tuple[int, str]:
        """Write chunks to a temporary file then move it into place. Returns (size, sha256 hex).
        Memory use is one chunk. Over `max_bytes`, or any failure, leaves nothing behind. Never overwrites an object."""
        path = self.resolve(area, key)
        tmp = path.with_name(path.name + f".{uuid.uuid4().hex}.part")
        digest, size = hashlib.sha256(), 0
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            if path.exists():
                raise StorageKeyError("an object already exists under this key")
            with open(tmp, "xb") as out:
                for chunk in _from_source(chunks):
                    size += len(chunk)
                    if size > max_bytes:
                        raise StorageTooLarge()
                    digest.update(chunk)
                    out.write(chunk)
                out.flush()
                os.fsync(out.fileno())
            if path.exists():  # a concurrent writer finished first
                raise StorageKeyError("an object already exists under this key")
            os.replace(tmp, path)
        except _SourceFailed as failed:
            _silent_remove(tmp)
            raise failed.__cause__ from None  # the caller sees its own error, unchanged
        except (StorageTooLarge, StorageKeyError):
            _silent_remove(tmp)
            raise
        except OSError as exc:
            _silent_remove(tmp)
            raise StorageUnavailable("the storage location could not be written") from exc
        except BaseException:
            _silent_remove(tmp)
            raise
        return size, digest.hexdigest()

    def open_read(self, area: str, key: str) -> BinaryIO:
        path = self.resolve(area, key)
        try:
            return open(path, "rb")
        except FileNotFoundError as exc:
            if not self._root_usable():
                raise StorageUnavailable("the storage location is not available") from exc
            raise StorageNotFound() from exc
        except OSError as exc:
            raise StorageUnavailable("the storage location could not be read") from exc

    def exists(self, area: str, key: str) -> bool:
        path = self.resolve(area, key)
        try:
            return path.is_file()
        except OSError as exc:
            raise StorageUnavailable("the storage location could not be read") from exc

    def delete(self, area: str, key: str) -> bool:
        """Remove one object. Returns False if it was already gone."""
        path = self.resolve(area, key)
        try:
            path.unlink()
            return True
        except FileNotFoundError:
            return False
        except OSError as exc:
            raise StorageUnavailable("the storage location could not be changed") from exc

    def _root_usable(self) -> bool:
        try:
            return self.root.is_dir()
        except OSError:
            return False


class _SourceFailed(Exception):
    """Internal: the incoming data failed (for example the client disconnected). Not a disk problem."""


def _from_source(chunks: Iterable[bytes]):
    """Yield chunks; an error raised by the incoming data is re-raised as itself, never as a disk error."""
    it = iter(chunks)
    while True:
        try:
            chunk = next(it)
        except StopIteration:
            return
        except BaseException as exc:
            raise _SourceFailed() from exc
        yield chunk


def _silent_remove(path: Path) -> None:
    try:
        path.unlink()
    except OSError:
        pass


storage = LocalStorage(settings.storage_path)
