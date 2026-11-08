from app.ai.settings import ai_settings
from app.ai.trackers.botsort_tracker import BoTSORTTracker
from app.ai.trackers.bytetrack_tracker import ByteTracker
from app.ai.trackers.sort_tracker import SortTracker

_TRACKERS = {"bytetrack": ByteTracker, "sort": SortTracker, "botsort": BoTSORTTracker}


class TrackerFactory:
    @staticmethod
    def create():
        name = ai_settings.tracker.lower()
        if name not in _TRACKERS:
            # Never fall back to another tracker silently: the choice changes the counts.
            raise ValueError(f"unknown TRACKER '{ai_settings.tracker}' (use one of: {', '.join(sorted(_TRACKERS))})")
        return _TRACKERS[name]()
