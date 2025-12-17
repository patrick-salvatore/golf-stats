"""Configuration management for LiDAR API."""

import os
from typing import List
from pydantic_settings import BaseSettings
from pydantic import Field
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # API Configuration
    app_name: str = "LiDAR Visualizer API"
    app_version: str = "0.1.0"
    debug: bool = Field(default=False, env="DEBUG")
    log_level: str = Field(default="INFO", env="LOG_LEVEL")

    # Server Configuration
    host: str = Field(default="127.0.0.1", env="HOST")
    port: int = Field(default=8000, env="PORT")

    # CORS Configuration
    allowed_origins: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000", env="ALLOWED_ORIGINS"
    )

    @property
    def origins_list(self) -> List[str]:
        """Convert comma-separated origins to list."""
        return [origin.strip() for origin in self.allowed_origins.split(",")]

    # OpenTopography API Configuration
    opentopography_api_key: str = Field(env="OPENTOPOGRAPHY_API_KEY")
    opentopography_base_url: str = Field(
        default="https://cloud.sdsc.edu/v1/", env="OPENTOPOGRAPHY_BASE_URL"
    )

    # File Storage Configuration
    upload_dir: str = Field(default="data/uploads", env="UPLOAD_DIR")
    processed_dir: str = Field(default="data/processed", env="PROCESSED_DIR")
    max_file_size: int = Field(default=100 * 1024 * 1024, env="MAX_FILE_SIZE")  # 100MB

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        # Validate required settings
        if not self.opentopography_api_key:
            raise ValueError("OPENTOPOGRAPHY_API_KEY environment variable is required")

        # Create directories if they don't exist
        os.makedirs(self.upload_dir, exist_ok=True)
        os.makedirs(self.processed_dir, exist_ok=True)


# Global settings instance
settings = Settings()
