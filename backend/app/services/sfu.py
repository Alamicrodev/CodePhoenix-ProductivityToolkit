"""Thin client for the Cloudflare Realtime SFU HTTPS API.

Each participant's browser holds ONE PeerConnection to Cloudflare's edge; this
module is how the backend orchestrates it (create session, publish tracks,
subscribe to other sessions' tracks, renegotiate). The App Secret authorizes
these calls, which is why they are proxied here instead of made from the
browser. Media never flows through this server — only SDP text does.

The request/response bodies are passed through mostly verbatim: the browser
builds them (it owns the PeerConnection) and Cloudflare validates them. The
backend's job is auth, membership gating, and keeping the secret out of the
bundle — not re-modelling Cloudflare's schema.
"""

import logging
from typing import Any

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

SFU_BASE = "https://rtc.live.cloudflare.com/v1/apps"
# SDP exchanges are slower than credential minting: tracks/new blocks server-side
# for up to 5s while the PeerConnection reaches `connected`.
REQUEST_TIMEOUT_SECONDS = 10.0


class SfuError(Exception):
    """A Cloudflare SFU call failed. Video degrades; the room must not."""

    def __init__(self, detail: str, status_code: int):
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


def is_sfu_configured() -> bool:
    return bool(settings.sfu_app_id and settings.sfu_app_secret)


#one session per participant — it corresponds 1:1 with their PeerConnection.
#Publishers negotiate via tracks/new, so they create bare sessions; a
#receive-only participant must instead bootstrap with an initial offer (e.g. a
#data channel), because Cloudflare refuses operations on a session whose
#PeerConnection never connected (observed live: 410 session_error).
def create_session(session_description: dict[str, Any] | None = None) -> dict[str, Any]:
    body = {"sessionDescription": session_description} if session_description else None
    payload = _post("sessions/new", body)
    session_id = payload.get("sessionId")
    if not session_id:
        raise SfuError("Video service returned no session id", 502)
    return {"session_id": str(session_id), "session_description": payload.get("sessionDescription")}


#publish local tracks or subscribe to remote ones — same Cloudflare call, the
#`tracks` entries' `location` field decides which
def new_tracks(
    session_id: str,
    tracks: list[dict[str, Any]],
    session_description: dict[str, Any] | None = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {"tracks": tracks}
    if session_description:
        body["sessionDescription"] = session_description
    return _post(f"sessions/{session_id}/tracks/new", body)


#complete a Cloudflare-initiated renegotiation (subscribes generate its offer)
def renegotiate(session_id: str, session_description: dict[str, Any]) -> dict[str, Any]:
    return _put(f"sessions/{session_id}/renegotiate", {"sessionDescription": session_description})


#unpublish/unsubscribe; best-effort — Cloudflare also garbage-collects tracks
#after 30s without media, so failure here is not fatal
def close_tracks(
    session_id: str,
    tracks: list[dict[str, Any]],
    session_description: dict[str, Any] | None = None,
    force: bool = False,
) -> dict[str, Any]:
    body: dict[str, Any] = {"tracks": tracks, "force": force}
    if session_description:
        body["sessionDescription"] = session_description
    return _put(f"sessions/{session_id}/tracks/close", body)


def _post(path: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
    return _request("POST", path, body)


def _put(path: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
    return _request("PUT", path, body)


def _request(method: str, path: str, body: dict[str, Any] | None) -> dict[str, Any]:
    if not is_sfu_configured():
        raise SfuError("Video service is not configured", 503)

    url = f"{SFU_BASE}/{settings.sfu_app_id}/{path}"
    try:
        # An empty JSON object is NOT equivalent to no body: sessions/new
        # rejects `{}` with a sessionDescription validation error (observed
        # against the live API) but accepts a bodyless POST.
        kwargs: dict[str, Any] = {"json": body} if body is not None else {}
        response = httpx.request(
            method,
            url,
            headers={"Authorization": f"Bearer {settings.sfu_app_secret}"},
            timeout=REQUEST_TIMEOUT_SECONDS,
            **kwargs,
        )
    except httpx.HTTPError as error:
        logger.warning("SFU %s %s failed: %s", method, path, error)
        raise SfuError("Video service is unreachable", 503) from error

    if response.status_code >= 400:
        # Cloudflare's error text is useful for debugging but may reference
        # internals — log it fully, return a stable message to the client.
        logger.warning("SFU %s %s -> %s: %s", method, path, response.status_code, response.text[:500])
        raise SfuError("Video service rejected the request", 502)

    try:
        payload = response.json()
    except ValueError as error:
        raise SfuError("Video service returned an unreadable response", 502) from error

    # Cloudflare reports some failures inside a 200 body.
    error_code = payload.get("errorCode")
    if error_code:
        logger.warning("SFU %s %s errorCode=%s: %s", method, path, error_code, payload.get("errorDescription"))
        raise SfuError("Video service rejected the request", 502)

    return payload
