"""Mints short-lived TURN credentials from Cloudflare Realtime.

Cloudflare does not issue a fixed username/password. The long-term key lives here
on the server and is exchanged for a credential that expires, which is why the
frontend asks the backend for ICE servers instead of holding any secret itself.
"""

import logging
import re

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

CLOUDFLARE_TURN_ENDPOINT = (
    "https://rtc.live.cloudflare.com/v1/turn/keys/{key_id}/credentials/generate-ice-servers"
)
REQUEST_TIMEOUT_SECONDS = 5.0
# Cloudflare returns primary and alternate ports; browsers block 53, so those
# candidates would only waste time during ICE gathering. The port must match
# whole (end of URL or before the ?transport suffix) — a bare substring test
# would also swallow the TLS relay on 5349.
BLOCKED_PORT_PATTERN = re.compile(r":53(?=\?|$)")


def is_turn_configured() -> bool:
    return bool(settings.turn_key_id and settings.turn_key_api_token)


#ask Cloudflare for a fresh credential; returns None if TURN is unavailable
def fetch_turn_ice_servers() -> list[dict] | None:
    if not is_turn_configured():
        return None

    url = CLOUDFLARE_TURN_ENDPOINT.format(key_id=settings.turn_key_id)
    try:
        response = httpx.post(
            url,
            headers={"Authorization": f"Bearer {settings.turn_key_api_token}"},
            json={"ttl": settings.turn_credential_ttl_seconds},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        payload = response.json()
    except Exception as error:
        # Never fail the room over this: callers fall back to STUN-only and the
        # room UI warns that video may not connect on restrictive networks.
        logger.warning("Could not mint TURN credentials: %s", error)
        return None

    return _normalize(payload.get("iceServers"))


#accept either a single server object or a list of them, and drop unusable URLs
def _normalize(ice_servers: object) -> list[dict] | None:
    if isinstance(ice_servers, dict):
        ice_servers = [ice_servers]
    if not isinstance(ice_servers, list) or not ice_servers:
        logger.warning("TURN response did not contain any ICE servers")
        return None

    normalized: list[dict] = []
    for server in ice_servers:
        if not isinstance(server, dict):
            continue
        raw_urls = server.get("urls") or server.get("url")
        urls = [raw_urls] if isinstance(raw_urls, str) else list(raw_urls or [])
        usable = [url for url in urls if not BLOCKED_PORT_PATTERN.search(url)]
        if not usable:
            continue
        normalized.append(
            {
                "urls": usable,
                "username": server.get("username"),
                "credential": server.get("credential"),
            }
        )

    return normalized or None
