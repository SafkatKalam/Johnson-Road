from app.ai.settings import ai_settings
from app.ai.trackers.botsort_tracker import BoTSORTTracker
from app.ai.trackers.bytetrack_tracker import ByteTracker
from app.ai.trackers.sort_tracker import SortTracker


class TrackerFactory:
    @staticmethod
    def create():
        tracker = ai_settings.tracker.lower()
        if tracker == "sort":
            return SortTracker()
        if tracker == "botsort":
            return BoTSORTTracker()
        return ByteTracker()
