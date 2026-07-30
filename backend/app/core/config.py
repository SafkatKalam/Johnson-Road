from pydantic import BaseModel


class Settings(BaseModel):
    app_name: str = "Johnson Road API"
    api_prefix: str = "/api"
    model: str = "stub"
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:4173",
        "http://localhost:5173",
    ]


settings = Settings()
