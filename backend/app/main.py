from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.ai.runtime import airuntime
from app.core.config import settings
from app.routers import dashboard_router, processing_router, projects_router, reports_router, uploads_router

app = FastAPI(
    title=settings.app_name,
    version="0.3.1",
    description="Mock FastAPI backend for Johnson Road frontend service layer",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard_router, prefix=settings.api_prefix)
app.include_router(projects_router, prefix=settings.api_prefix)
app.include_router(uploads_router, prefix=settings.api_prefix)
app.include_router(processing_router, prefix=settings.api_prefix)
app.include_router(reports_router, prefix=settings.api_prefix)


@app.on_event("startup")
def startup_event():
    airuntime.initialize()


@app.on_event("shutdown")
def shutdown_event():
    return None


@app.get("/", summary="Root")
def root():
    return {"project": "Johnson Road", "status": "running", "version": "0.3.1"}


@app.get("/health", summary="Health check")
def health():
    runtime = airuntime.get_status()
    return {
        "status": "healthy",
        "service": "backend",
        "runtimeInitialized": runtime.initialized,
        "detectorLoaded": runtime.detector_loaded,
        "currentDetector": runtime.detector_name,
        "device": runtime.device,
        "modelPath": runtime.model_path,
    }
