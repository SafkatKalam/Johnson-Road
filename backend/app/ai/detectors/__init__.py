from app.ai.detectors.stub_detector import StubDetector

# YOLODetector is not imported here: it needs torch and ultralytics, which are installed
# only when the real model is used (import it from app.ai.detectors.yolo_detector).
__all__ = ["StubDetector"]
