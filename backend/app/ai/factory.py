from app.ai.runtime import airuntime


class DetectorFactory:
    @staticmethod
    def create():
        if not airuntime._initialized:
            airuntime.initialize()
        return airuntime.get_detector()
