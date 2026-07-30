from app.ai.trackers.base import TrackedObject


class Counter:
    def count(self, tracks: list[TrackedObject]) -> int:
        return len(tracks)
