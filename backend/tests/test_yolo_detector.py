"""D1 regression and detector construction. Uses fakes: no real model file or GPU needed."""
import pytest

pytest.importorskip("torch", reason="needs requirements-ai.txt")
pytest.importorskip("ultralytics", reason="needs requirements-ai.txt")

import torch  # noqa: E402

from app.ai.detectors import yolo_detector as yd  # noqa: E402
from app.ai.detectors.yolo_detector import YOLODetector  # noqa: E402


class _Tensor:
    def __init__(self, value):
        self._value = value

    def item(self):
        return self._value

    def __getitem__(self, _index):
        return self

    def tolist(self):
        return self._value


class _Box:
    def __init__(self, cls, conf, xyxy):
        self.cls = _Tensor(cls)
        self.conf = _Tensor(conf)
        self.xyxy = _Tensor(xyxy)


class _Result:
    names = {2: "car", 5: "bus"}

    def __init__(self, boxes):
        self.boxes = boxes


def _detector():
    return YOLODetector.__new__(YOLODetector)  # skip model loading


def test_detection_has_class_id_label_and_box():
    result = _Result([_Box(5, 0.9, [10, 20, 110, 220]), _Box(2, 0.5, [0, 0, 50, 40])])
    detections = _detector()._postprocess([result])
    assert [d.class_id for d in detections] == [5, 2]
    assert [d.label for d in detections] == ["bus", "car"]
    assert detections[0].bbox == (10, 20, 100, 200)
    assert detections[0].frame_index == 0


def test_frame_index_counts_results():
    detections = _detector()._postprocess([_Result([_Box(2, 0.6, [0, 0, 5, 5])]), _Result([_Box(2, 0.7, [1, 1, 6, 6])])])
    assert [d.frame_index for d in detections] == [0, 1]


# --- constructor: what really loaded is recorded, nothing is substituted ---------

class _FakeModel:
    def __init__(self):
        self.moved_to = None

    def to(self, device):
        self.moved_to = device


@pytest.fixture()
def fake_loader(monkeypatch, tmp_path):
    weights = tmp_path / "custom.pt"
    weights.write_bytes(b"not a real model")
    loaded = []

    def loader(path):
        loaded.append(path)
        return _FakeModel()

    monkeypatch.setattr(YOLODetector, "_cached_load_model", staticmethod(loader))
    return weights, loaded


def test_constructor_loads_exactly_the_given_file_and_records_its_identity(fake_loader):
    weights, loaded = fake_loader
    d = YOLODetector(str(weights), device="cpu")
    assert loaded == [str(weights)]
    assert d.model_file_name == "custom.pt" and len(d.model_sha256) == 64 and d.actual_device == "cpu"


def test_asking_for_cuda_without_cuda_is_an_error_not_a_cpu_fallback(fake_loader, monkeypatch):
    weights, _ = fake_loader
    monkeypatch.setattr(torch.cuda, "is_available", lambda: False)
    with pytest.raises(RuntimeError, match="CUDA is not available"):
        YOLODetector(str(weights), device="cuda:0")


def test_missing_weights_file_is_an_error_naming_only_the_file(tmp_path):
    missing = tmp_path / "secret-folder" / "nope.pt"
    with pytest.raises(FileNotFoundError) as info:
        YOLODetector._cached_load_model(str(missing))
    assert "nope.pt" in str(info.value) and "secret-folder" not in str(info.value)


@pytest.mark.parametrize("raw, expected", [("cpu", "cpu"), ("CPU", "cpu"), ("cuda", "cuda"), ("CUDA:0", "cuda:0"),
                                           ("cuda:1", "cuda:1"), ("0", "cuda:0"), (" 1 ", "cuda:1")])
def test_device_is_normalised(raw, expected):
    assert yd.normalize_device(raw) == expected


@pytest.mark.parametrize("raw", ["mps", "gpu", "cuda:x", "cuda:", "", "tpu"])
def test_unsupported_device_is_refused(raw):
    with pytest.raises(ValueError, match="unsupported DEVICE"):
        yd.normalize_device(raw)


def test_capitalised_cuda_is_not_mistaken_for_cpu(fake_loader, monkeypatch):
    weights, _ = fake_loader
    monkeypatch.setattr(torch.cuda, "is_available", lambda: False)
    with pytest.raises(RuntimeError, match="CUDA is not available"):
        YOLODetector(str(weights), device="CUDA:0")


def test_two_detectors_do_not_share_one_model_object(monkeypatch, tmp_path):
    weights = tmp_path / "w.pt"
    weights.write_bytes(b"x")
    monkeypatch.setattr(YOLODetector, "_cached_load_model", staticmethod(lambda p: _FakeModel()))
    assert YOLODetector(str(weights))._model is not YOLODetector(str(weights))._model


def test_file_sha256_matches_a_known_value(tmp_path):
    f = tmp_path / "x.bin"
    f.write_bytes(b"abc")
    assert yd.file_sha256(str(f)) == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
