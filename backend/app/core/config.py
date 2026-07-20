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
    turn_urls: List[str] = Field(default_factory=list, alias="TURN_URLS")
    turn_username: str | None = Field(default=None, alias="TURN_USERNAME")
    turn_credential: str | None = Field(default=None, alias="TURN_CREDENTIAL")

    model_config = SettingsConfigDict(    
        env_file=".env",                    #look for this file for env vars
        env_file_encoding="utf-8",        
        case_sensitive=False,              
        extra="ignore",                     #ignore extra env vars
    )                                                  


@lru_cache  #decorator: caches the previous return values > everytime get_settings is called > Settings() does not have to run again.
def get_settings() -> Settings:
    return Settings()
