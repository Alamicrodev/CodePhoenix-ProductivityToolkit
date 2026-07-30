from functools import lru_cache
from typing import List   #built-in Python module that contains type hints.

from pydantic import Field   #field sort of helps us store metadata about a field, including validation rules
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # if these properties are not in env vars, use these defaults
    app_name: str = "CodePhoenix Productivity Toolkit API"   #e.g. looks for APP_NAME in env vars, if it does not exist use this default value
    api_v1_prefix: str = "/api/v1"
    secret_key: str = Field("change-me-in-production", alias="SECRET_KEY")  #alias (look for this name in env vars)
    access_token_expire_minutes: int = Field(60, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    database_url: str = Field(
        "postgresql+psycopg://codephoenix:codephoenix@db:5432/codephoenix",
        alias="DATABASE_URL",
    )
    gemini_api_key: str = Field("", alias="GEMINI_API_KEY")
    scheduler_model: str = Field("gemini-3.5-flash", alias="SCHEDULER_MODEL")
    scheduler_model_timeout_seconds: int = Field(60, alias="SCHEDULER_MODEL_TIMEOUT_SECONDS")
    cors_origins: List[str] = Field(      
        default_factory=lambda: [    #default_factory expects a function that returns a list    
            "http://localhost:5173",    #lambda (just assume theres a function here which returns this list), we do this to create a new list(with diff reference each time)
            "http://127.0.0.1:5173",    #this means everytime you call settings() we get a new list with different memory address
        ],                                 
        alias="CORS_ORIGINS",
    )

    # WebRTC ICE servers, served to the browser by GET /cowork-sessions/ice-config.
    # Keeping them server-side (instead of baking them into the Vite bundle) means
    # TURN credentials stay out of the frontend build and the provider can be
    # swapped without redeploying the frontend.
    stun_urls: List[str] = Field(
        default_factory=lambda: [
            "stun:stun.l.google.com:19302",
            "stun:stun1.l.google.com:19302",
        ],
        alias="STUN_URLS",
    )
    # Without TURN, peers behind symmetric NAT (corporate / campus / some mobile
    # networks) simply cannot connect to each other.
    #
    # Cloudflare Realtime issues short-lived credentials rather than a fixed
    # username/password, so the backend holds the long-term key and mints a fresh
    # credential per request. The key must never reach the browser.
    turn_key_id: str | None = Field(default=None, alias="TURN_KEY_ID")
    turn_key_api_token: str | None = Field(default=None, alias="TURN_KEY_API_TOKEN")
    # Credentials that expire mid-call kill the relay, so this wants to be longer
    # than the longest plausible cowork session. Cloudflare's ceiling is 48h.
    turn_credential_ttl_seconds: int = Field(21600, alias="TURN_CREDENTIAL_TTL_SECONDS")

    # Cloudflare Realtime SFU app (separate from the TURN key — created under
    # Realtime -> SFU in the dashboard). The secret authorizes the Sessions/
    # Tracks API, so it stays server-side; the frontend talks to our proxy
    # routes and only media flows browser <-> Cloudflare.
    sfu_app_id: str | None = Field(default=None, alias="SFU_APP_ID")
    sfu_app_secret: str | None = Field(default=None, alias="SFU_APP_SECRET")

    model_config = SettingsConfigDict(    
        env_file=".env",                    #look for this file for env vars
        env_file_encoding="utf-8",        
        case_sensitive=False,              
        extra="ignore",                     #ignore extra env vars
    )                                                  


@lru_cache  #decorator: caches the previous return values > everytime get_settings is called > Settings() does not have to run again.
def get_settings() -> Settings:
    return Settings()
