from pathlib import Path

from pydantic import ValidationError, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class SettingsError(RuntimeError):
    """Raised at start-up with one plain message naming the missing or invalid setting."""


class Settings(BaseSettings):
    """Backend settings. Values come from environment variables or backend/.env."""

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Johnson Road API"
    api_prefix: str = "/api"
    backend_port: int = 5000
    frontend_origin: str = "http://localhost:3000"
    database_url: str  # required: no default, so a missing setting is reported, not guessed
    # Supabase signs people in (O48). The project URL is public; no secret is needed because the backend
    # verifies tokens with the project's public signing keys. Without it every protected route answers 503.
    supabase_url: str | None = None
    # Server-side only. Used for one thing: confirming an address really was confirmed before an invitation is accepted.
    supabase_secret_key: str | None = None
    supabase_jwt_audience: str = "authenticated"
    jwt_leeway_seconds: int = 10  # tolerated clock difference between Supabase and this server
    storage_root: str = "data"
    s3_endpoint: str = "http://127.0.0.1:9110"
    s3_region: str = "us-east-1"
    s3_bucket: str = "johnson-road-media"
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""

    @field_validator("database_url")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        # Accept "postgres://" and "postgresql://" and use the psycopg 3 driver.
        for prefix in ("postgres://", "postgresql://"):
            if value.startswith(prefix):
                return "postgresql+psycopg://" + value[len(prefix):]
        if not value.startswith("postgresql+psycopg://"):
            raise ValueError("must start with postgres:// or postgresql://")
        return value

    @field_validator("supabase_url")
    @classmethod
    def check_supabase_url(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return None
        if not value.startswith(("https://", "http://localhost", "http://127.0.0.1")):
            raise ValueError("must be an https:// project URL such as https://abcd.supabase.co")
        return value.rstrip("/")

    @field_validator("frontend_origin")
    @classmethod
    def check_frontend_origin(cls, value: str) -> str:
        # "*" together with credentials would let any site call the API as the signed-in user.
        if value == "*" or not value.startswith(("http://", "https://")):
            raise ValueError("must be one http(s) origin such as http://localhost:3000, not '*'")
        return value.rstrip("/")

    @property
    def libpq_url(self) -> str:
        """The database URL in the plain form psycopg expects (no +psycopg)."""
        return self.database_url.replace("postgresql+psycopg://", "postgresql://", 1)

    @property
    def cors_origins(self) -> list[str]:
        origins = [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:4173",
            "http://localhost:5173",
        ]
        if self.frontend_origin not in origins:
            origins.append(self.frontend_origin)
        return origins

    @property
    def storage_path(self) -> Path:
        path = Path(self.storage_root)
        return path if path.is_absolute() else BACKEND_DIR / path


def _load_settings(**options) -> Settings:
    try:
        return Settings(**options)
    except ValidationError as exc:
        problems = "; ".join(
            f"{'.'.join(str(p) for p in err['loc']).upper()}: {'is not set' if err['type'] == 'missing' else err['msg']}"
            for err in exc.errors()
        )
        raise SettingsError(
            f"Invalid settings - {problems}. Copy backend/.env.example to backend/.env and fill it in."
        ) from None


settings = _load_settings()
