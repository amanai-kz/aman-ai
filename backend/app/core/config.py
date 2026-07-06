"""
Application configuration
"""

from typing import List
from pydantic_settings import BaseSettings


UNSAFE_SECRET_KEYS = {
    "",
    "super-secret-key-change-in-production",
    "dev-only-secret-key-change-before-production",
}


def validate_secret_key(secret_key: str | None, *, production: bool) -> None:
    """Reject missing/default/weak JWT secrets in production."""
    secret = secret_key or ""
    if not production:
        return
    if secret in UNSAFE_SECRET_KEYS or len(secret) < 32:
        raise ValueError(
            "SECRET_KEY must be set to a strong random value in production"
        )


class Settings(BaseSettings):
    """Application settings"""
    
    # App
    PROJECT_NAME: str = "Aman AI"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = True
    ENVIRONMENT: str = "development"
    NODE_ENV: str | None = None
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://amanai.kz",
    ]
    
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./amanai.db"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    
    # JWT
    SECRET_KEY: str = "dev-only-secret-key-change-before-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    AMAN_AUTH_TEST_MODE: bool = False
    
    # AI Services
    MODEL_PATH: str = "./models"
    # OpenMed PII Deidentification
    PII_DEIDENTIFICATION_ENABLED: bool = True
    
    class Config:
        env_file = ".env"
        case_sensitive = True

    @property
    def is_production(self) -> bool:
        return (
            self.ENVIRONMENT.lower() == "production"
            or (self.NODE_ENV or "").lower() == "production"
            or not self.DEBUG
        )


settings = Settings()
validate_secret_key(settings.SECRET_KEY, production=settings.is_production)

