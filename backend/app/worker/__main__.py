"""Run the worker: `python -m app.worker` from the backend folder (needs the same .env as the API)."""
import logging

from app.core.logging_setup import configure_logging
from app.database.database import SessionLocal
from app.storage import storage
from app.worker.service import Worker


def main() -> None:
    configure_logging()
    from app.core.config import settings

    worker = Worker(SessionLocal, storage, timeout_seconds=settings.job_timeout_seconds)   # JOB_TIMEOUT_SECONDS in .env; unset = no limit (O46)
    logging.getLogger("johnsonroad.worker").info("worker.started", extra={"worker_id": worker.worker_id})
    try:
        worker.run_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
