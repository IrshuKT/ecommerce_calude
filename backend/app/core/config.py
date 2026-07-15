from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "Epozy"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False
    SECRET_KEY: str = "change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost/glassstore"
    SYNC_DATABASE_URL: str = "postgresql://postgres:password@localhost/glassstore"

    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""

    STORE_STATE_CODE: str = "32"   # Kerala
    GST_NUMBER: str = ""
    CGST_RATE: float = 9.0
    SGST_RATE: float = 9.0
    IGST_RATE: float = 18.0

    REDIS_URL: str = "redis://localhost:6379/0"

    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    FROM_EMAIL: str = "noreply@epozy.in"

    UPLOAD_DIR: str = "uploads"
    MAX_IMAGE_SIZE_MB: int = 5

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
