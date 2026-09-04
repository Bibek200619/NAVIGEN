from functools import lru_cache
from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "NAVIGEN API"
    app_env: Literal["development", "test", "production"] = "development"
    debug: bool = False
    app_host: str = "0.0.0.0"
    app_port: int = Field(default=8000, ge=1, le=65535)
    api_v1_prefix: str = Field(default="/api/v1", pattern=r"^/api/v\d+$")
    supabase_url: str = ""
    supabase_publishable_key: SecretStr = SecretStr("")
    supabase_service_role_key: SecretStr = SecretStr("")
    frontend_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]
    ugv_bridge_url: str = "ws://localhost:9090"
    ugv_robot_id: UUID | None = None
    ugv_localization_topic: str | None = None
    ugv_connection_timeout_seconds: float = Field(default=5.0, gt=0, le=60)
    telemetry_stale_threshold_ms: int = Field(default=2000, ge=100, le=60_000)
    telemetry_persistence_enabled: bool = True
    telemetry_persistence_rate_hz: float = Field(default=2.0, gt=0, le=10)
    websocket_queue_size: int = Field(default=100, ge=5, le=1000)
    websocket_max_dropped_messages: int = Field(default=25, ge=1, le=1000)
    websocket_auth_timeout_seconds: float = Field(default=5.0, gt=0, le=30)

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore", case_sensitive=False
    )

    @field_validator("frontend_origins", mode="before")
    @classmethod
    def parse_frontend_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("frontend_origins")
    @classmethod
    def reject_wildcard_origins(cls, value: list[str]) -> list[str]:
        if "*" in value:
            raise ValueError("FRONTEND_ORIGINS cannot contain '*' when credentials are enabled")
        return value

    @model_validator(mode="after")
    def require_production_credentials(self) -> "Settings":
        if self.app_env == "production":
            missing = []
            if not self.supabase_url:
                missing.append("SUPABASE_URL")
            if not self.supabase_publishable_key.get_secret_value():
                missing.append("SUPABASE_PUBLISHABLE_KEY")
            if not self.supabase_service_role_key.get_secret_value():
                missing.append("SUPABASE_SERVICE_ROLE_KEY")
            if missing:
                raise ValueError(f"Missing production configuration: {', '.join(missing)}")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
