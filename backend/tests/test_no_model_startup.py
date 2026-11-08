"""F6: the API must import and start with no model configured, and a job that needs one must fail cleanly."""
import subprocess
import sys

import pytest

from app.ai.pipeline import AIPipeline
from app.ai.runtime import DetectorLoadError, airuntime


def test_api_imports_and_starts_with_no_model_configured(tmp_path):
    """A real fresh process: MODEL unset and no .env file reachable must still import app.main."""
    code = (
        "import os\n"
        "os.environ.pop('MODEL', None)\n"
        "os.environ['DATABASE_URL']='postgres://u:p@127.0.0.1:1/none'\n"
        "from fastapi.testclient import TestClient\n"
        "import app.main as m\n"
        "from app.ai.settings import ai_settings\n"
        "ai_settings.model_type = 'none'\n"
        "with TestClient(m.app) as c:\n"
        "    body = c.get('/health').json()\n"
        "    print('RESULT', c.get('/live').status_code, body['detectorLoaded'], body['currentDetector'], body['processingReady'])\n"
    )
    import pathlib

    backend = pathlib.Path(__file__).resolve().parents[1]
    out = subprocess.run([sys.executable, "-I", "-c", code], cwd=backend, capture_output=True, text=True, timeout=120,
                         env={"PATH": "", "SYSTEMROOT": __import__("os").environ.get("SYSTEMROOT", "")})
    # -I ignores PYTHONPATH and cwd; add the backend folder explicitly
    if "ModuleNotFoundError: No module named 'app'" in out.stderr:
        out = subprocess.run([sys.executable, "-c", code], cwd=backend, capture_output=True, text=True, timeout=120,
                             env={"PATH": "", "SYSTEMROOT": __import__("os").environ.get("SYSTEMROOT", ""), "MODEL": "none"})
    assert "RESULT 200 False none False" in out.stdout, out.stderr[-600:]


def test_pipeline_object_can_exist_without_any_detector(monkeypatch):
    monkeypatch.setattr(airuntime, "_detector", None)
    monkeypatch.setattr(airuntime, "_initialized", True)
    pipeline = AIPipeline()
    assert pipeline.detector_name == "none"  # never raises: used inside error handling
    with pytest.raises(DetectorLoadError):
        pipeline.detector


def test_running_a_job_without_a_detector_is_a_clean_pipeline_error(monkeypatch):
    from app.ai.runtime import PipelineError

    monkeypatch.setattr(airuntime, "_detector", None)
    monkeypatch.setattr(airuntime, "_initialized", True)
    with pytest.raises(Exception) as info:  # DetectorLoadError or PipelineError, never a crash of the API
        AIPipeline().run("whatever.mp4")
    assert isinstance(info.value, (DetectorLoadError, PipelineError))
