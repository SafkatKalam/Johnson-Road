from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Johnson Road API",
    version="0.1.0",
    description="Backend API for Johnson Road"
)

# Allow React frontend to communicate with FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "project": "Johnson Road",
        "status": "running",
        "version": "0.1.0"
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "backend"
    }