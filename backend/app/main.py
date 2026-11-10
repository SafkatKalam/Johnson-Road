from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.deps import current_member

from app.ai.runtime import airuntime
from app.core.config import settings
from app.core.errors import AppError, register_error_handlers
from app.core.health import database_ready, schema_current, worker_ready
from app.core.logging_setup import configure_logging
from app.core.request_context import REQUEST_ID_HEADER, RequestIdMiddleware
from app.routers import (
    account_router,
    invites_router,
    organization_router,
    dashboard_router,
    processing_router,
    projects_router,
    reports_router,
    uploads_router,
)

configure_logging()

APP_VERSION = "0.3.1"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # A detector that fails to load is recorded, not raised: the API stays up (F6).
    airuntime.initialize()
    yield


app = FastAPI(
    title=settings.app_name,
    version=APP_VERSION,
    description="Johnson Road backend API (some routes still return sample data)",
    lifespan=lifespan,
)

register_error_handlers(app)
app.add_middleware(RequestIdMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,  # sign-in uses an Authorization header, not cookies (F07); turn on only if cookies are used
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[REQUEST_ID_HEADER],
)

# Account routes need a valid sign-in but no organisation yet (FD16). Everything else needs an active membership.
app.include_router(account_router, prefix=settings.api_prefix)
app.include_router(invites_router, prefix=settings.api_prefix)  # accepting an invitation needs no organisation yet
_members_only = [Depends(current_member)]
app.include_router(organization_router, prefix=settings.api_prefix, dependencies=_members_only)
app.include_router(dashboard_router, prefix=settings.api_prefix, dependencies=_members_only)
app.include_router(projects_router, prefix=settings.api_prefix, dependencies=_members_only)
app.include_router(uploads_router, prefix=settings.api_prefix, dependencies=_members_only)
app.include_router(processing_router, prefix=settings.api_prefix, dependencies=_members_only)
app.include_router(reports_router, prefix=settings.api_prefix, dependencies=_members_only)



@app.get("/", summary="Root")
def root():
    return {"project": "Johnson Road", "status": "running", "version": APP_VERSION}


@app.get("/live", summary="Liveness: the API process is running")
def live():
    return {"status": "alive"}


@app.get("/health", summary="Health check (public; no paths or credentials)")
def health():
    runtime = airuntime.get_status()
    database = database_ready()
    worker = worker_ready()
    is_stub = runtime.detector_name == "StubDetector"
    return {
        # "status" describes the API itself (it needs the database). Whether videos can be processed is
        # a separate answer: "processingReady" needs a worker AND a real (non-stub) detector.
        "status": "healthy" if database else "degraded",
        "service": "backend",
        "databaseReady": database,
        "workerReady": worker,
        "processingReady": bool(database and worker and runtime.detector_loaded and not is_stub),
        "runtimeInitialized": runtime.initialized,
        "detectorLoaded": runtime.detector_loaded,
        "detectorIsStub": is_stub,
        "currentDetector": runtime.detector_name,
        "device": runtime.device,
    }


@app.get("/ready", summary="Readiness: 200 only when the database answers and migrations are applied")
def ready():
    database = database_ready()
    schema = database and schema_current()
    if not (database and schema):
        raise AppError(
            "not_ready",
            503,
            "The service is not ready yet.",
            details={"databaseReady": database, "schemaCurrent": schema},
        )
    return {"status": "ready", "databaseReady": True, "schemaCurrent": True}
