"""
Application configuration
"""

from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""
    
    # App
    PROJECT_NAME: str = "Aman AI"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = True
    
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
    SECRET_KEY: str = "super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # AI Services
    MODEL_PATH: str = "./models"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

