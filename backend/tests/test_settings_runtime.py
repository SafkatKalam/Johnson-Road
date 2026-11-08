"""F2/F4/F6 audit fixes: settings errors, AI settings from .env, non-fatal model failure, no silent model switch."""
import pytest

from app.ai import runtime as runtime_module
from app.ai.runtime import AIRuntime, DetectorLoadError, airuntime
from app.ai.settings import AISettings, ai_settings
from app.core.config import BACKEND_DIR as BACKEND
from app.core.config import SettingsError, _load_settings

# --- API settings ---------------------------------------------------------------

def test_missing_database_url_gives_one_plain_message_naming_it(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(SettingsError, match=r"DATABASE_URL: is not set.*backend/\.env\.example"):
        _load_settings(_env_file=None)


@pytest.mark.parametrize("value", ["*", "localhost:3000", "ftp://x"])
def test_frontend_origin_must_be_one_http_origin(value, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgres://u:p@127.0.0.1:5430/d")
    monkeypatch.setenv("FRONTEND_ORIGIN", value)
    with pytest.raises(SettingsError, match="FRONTEND_ORIGIN"):
        _load_settings(_env_file=None)


@pytest.mark.parametrize("url", ["postgres://u:p@h:5430/d", "postgresql://u:p@h:5430/d", "postgresql+psycopg://u:p@h:5430/d"])
def test_database_url_forms_are_normalised(url, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", url)
    s = _load_settings(_env_file=None)
    assert s.database_url == "postgresql+psycopg://u:p@h:5430/d" and s.libpq_url == "postgresql://u:p@h:5430/d"


def test_non_postgres_url_is_refused(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite:///x.db")
    with pytest.raises(SettingsError, match="DATABASE_URL"):
        _load_settings(_env_file=None)


def test_cors_never_contains_a_wildcard(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgres://u:p@h:5430/d")
    monkeypatch.setenv("FRONTEND_ORIGIN", "https://app.example.com/")
    s = _load_settings(_env_file=None)
    assert "*" not in s.cors_origins and "https://app.example.com" in s.cors_origins


# --- AI settings ----------------------------------------------------------------

def test_ai_settings_read_the_env_file(tmp_path, monkeypatch):
    for name in ("MODEL", "DEVICE", "ENABLE_WARMUP", "FRAME_SKIP"):
        monkeypatch.delenv(name, raising=False)  # real environment variables win over the file
    env = tmp_path / ".env"
    env.write_text("MODEL=yolo8\nDEVICE=cuda:0\nENABLE_WARMUP=false\nFRAME_SKIP=3\n", encoding="utf-8")
    s = AISettings(_env_file=env)
    assert (s.model_type, s.device, s.enable_warmup, s.frame_skip) == ("yolo8", "cuda:0", False, 3)


def test_ai_settings_default_is_no_model_never_a_silent_stub(monkeypatch, tmp_path):
    for name in ("MODEL", "DEVICE", "ENABLE_WARMUP"):
        monkeypatch.delenv(name, raising=False)
    assert AISettings(_env_file=tmp_path / "missing.env").model_type == "none"


def test_malformed_ai_setting_gives_a_plain_message(monkeypatch):
    from pydantic import ValidationError

    from app.ai.settings import _load_ai_settings

    monkeypatch.setenv("FRAME_SKIP", "abc")
    with pytest.raises(SettingsError, match=r"Invalid AI settings.*FRAME_SKIP"):
        _load_ai_settings()
    assert not issubclass(SettingsError, ValidationError)


def test_unknown_tracker_is_an_error_not_bytetrack(monkeypatch):
    from app.ai.trackers.factory import TrackerFactory

    monkeypatch.setattr(ai_settings, "tracker", "deepsort")
    with pytest.raises(ValueError, match="unknown TRACKER 'deepsort'"):
        TrackerFactory.create()
    monkeypatch.setattr(ai_settings, "tracker", "SORT")
    assert TrackerFactory.create().__class__.__name__ == "SortTracker"


# --- runtime: a failed model load must not stop the API -------------------------

@pytest.fixture()
def fresh_runtime(monkeypatch):
    monkeypatch.setattr(airuntime, "_initialized", False)
    monkeypatch.setattr(airuntime, "_detector", None)
    monkeypatch.setattr(airuntime, "_warmed_up", False)
    monkeypatch.setattr(airuntime, "_load_error", "")
    return airuntime


def test_missing_model_file_is_recorded_not_raised(fresh_runtime, monkeypatch):
    monkeypatch.setattr(ai_settings, "model_type", "yolo8")
    monkeypatch.setattr(ai_settings, "model_path", "does-not-exist.pt")
    fresh_runtime.initialize()  # must not raise
    status = fresh_runtime.get_status()
    assert status.initialized and not status.detector_loaded
    # the file is checked BEFORE the AI libraries are imported, so this is the reason with or without torch
    assert "MODEL_PATH file not found: does-not-exist.pt" in status.load_error
    assert status.device == "none"
    with pytest.raises(DetectorLoadError):
        fresh_runtime.get_detector()


def test_no_silent_switch_to_another_model(fresh_runtime, monkeypatch):
    # yolov8n.pt exists in backend/, but MODEL_PATH names a different missing file: it must not be used.
    assert (BACKEND / "yolov8n.pt").exists()
    monkeypatch.setattr(ai_settings, "model_type", "yolo11")
    monkeypatch.setattr(ai_settings, "model_path", "yolo11n-missing.pt")
    fresh_runtime.initialize()
    status = fresh_runtime.get_status()
    assert not status.detector_loaded
    assert "MODEL_PATH file not found: yolo11n-missing.pt" in status.load_error


def test_no_model_configured_is_reported_not_hidden(fresh_runtime, monkeypatch):
    monkeypatch.setattr(ai_settings, "model_type", "none")
    fresh_runtime.initialize()
    status = fresh_runtime.get_status()
    assert not status.detector_loaded and "no detector configured" in status.load_error


def test_unknown_model_type_is_an_error_not_a_stub(fresh_runtime, monkeypatch):
    monkeypatch.setattr(ai_settings, "model_type", "banana")
    fresh_runtime.initialize()
    assert "unknown MODEL" in fresh_runtime.get_status().load_error


def test_health_reports_a_failed_detector_and_stays_200(client, fresh_runtime, monkeypatch):
    monkeypatch.setattr(ai_settings, "model_type", "yolo8")
    monkeypatch.setattr(ai_settings, "model_path", "does-not-exist.pt")
    fresh_runtime.initialize()
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["detectorLoaded"] is False and r.json()["currentDetector"] == "none"
    assert "does-not-exist" not in r.text and "load_error" not in r.text  # detail stays in the log


def test_stub_loads(fresh_runtime, monkeypatch):
    monkeypatch.setattr(ai_settings, "model_type", "stub")
    fresh_runtime.initialize()
    status = fresh_runtime.get_status()
    assert status.detector_loaded and status.detector_name == "StubDetector" and status.load_error == ""


def test_runtime_module_has_no_fallback_map():
    assert not hasattr(AIRuntime, "_fallback_map") and "fallback_map" not in open(runtime_module.__file__, encoding="utf-8").read()
