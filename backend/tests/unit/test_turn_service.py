"""Unit tests for minting Cloudflare TURN credentials.

The room must survive Cloudflare being slow, misconfigured, or down — a failure
here degrades video quality on hard networks, it must never break the room.
"""

import httpx
import pytest

from app.services import turn


class FakeResponse:
    def __init__(self, payload, status_code=201):
        self._payload = payload
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("boom", request=None, response=None)

    def json(self):
        return self._payload


# The shape Cloudflare actually returns: one entry carrying STUN and TURN URLs.
CLOUDFLARE_PAYLOAD = {
    "iceServers": [
        {
            "urls": [
                "stun:stun.cloudflare.com:3478",
                "turn:turn.cloudflare.com:3478?transport=udp",
                "turn:turn.cloudflare.com:3478?transport=tcp",
                "turns:turn.cloudflare.com:5349?transport=tcp",
            ],
            "username": "user-xyz",
            "credential": "secret-xyz",
        }
    ]
}


@pytest.fixture()
def configured(monkeypatch):
    monkeypatch.setattr(turn.settings, "turn_key_id", "key-123")
    monkeypatch.setattr(turn.settings, "turn_key_api_token", "token-abc")
    monkeypatch.setattr(turn.settings, "turn_credential_ttl_seconds", 21600)


def test_returns_none_when_turn_is_not_configured(monkeypatch):
    monkeypatch.setattr(turn.settings, "turn_key_id", None)
    monkeypatch.setattr(turn.settings, "turn_key_api_token", None)

    assert turn.fetch_turn_ice_servers() is None
    assert turn.is_turn_configured() is False


def test_mints_a_credential_with_the_key_and_ttl(configured, monkeypatch):
    captured = {}

    def fake_post(url, **kwargs):
        captured["url"] = url
        captured["headers"] = kwargs["headers"]
        captured["json"] = kwargs["json"]
        return FakeResponse(CLOUDFLARE_PAYLOAD)

    monkeypatch.setattr(turn.httpx, "post", fake_post)

    servers = turn.fetch_turn_ice_servers()

    assert "key-123" in captured["url"]
    assert captured["headers"]["Authorization"] == "Bearer token-abc"
    assert captured["json"] == {"ttl": 21600}
    assert servers[0]["username"] == "user-xyz"
    assert any(url.startswith("turn:") for url in servers[0]["urls"])
    # The TLS relay on 5349 is the only fallback that works through firewalls
    # that block UDP and plain TCP — it must survive normalization.
    assert "turns:turn.cloudflare.com:5349?transport=tcp" in servers[0]["urls"]


def test_drops_port_53_urls_browsers_cannot_use(configured, monkeypatch):
    payload = {
        "iceServers": [
            {
                "urls": [
                    "turn:turn.cloudflare.com:3478",
                    "turn:turn.cloudflare.com:53",
                    "turn:turn.cloudflare.com:53?transport=udp",
                    "turns:turn.cloudflare.com:5349?transport=tcp",
                ],
                "username": "u",
                "credential": "c",
            }
        ]
    }
    monkeypatch.setattr(turn.httpx, "post", lambda url, **kwargs: FakeResponse(payload))

    servers = turn.fetch_turn_ice_servers()

    # Browsers block port 53, so gathering candidates for it only wastes time —
    # but ":53" must match as a whole port, not as a prefix of ":5349".
    assert servers[0]["urls"] == [
        "turn:turn.cloudflare.com:3478",
        "turns:turn.cloudflare.com:5349?transport=tcp",
    ]


def test_accepts_a_single_server_object_as_well_as_a_list(configured, monkeypatch):
    payload = {"iceServers": {"urls": ["turn:turn.cloudflare.com:3478"], "username": "u", "credential": "c"}}
    monkeypatch.setattr(turn.httpx, "post", lambda url, **kwargs: FakeResponse(payload))

    assert turn.fetch_turn_ice_servers()[0]["urls"] == ["turn:turn.cloudflare.com:3478"]


def test_network_failure_degrades_instead_of_raising(configured, monkeypatch):
    def explode(url, **kwargs):
        raise httpx.ConnectTimeout("cloudflare unreachable")

    monkeypatch.setattr(turn.httpx, "post", explode)

    assert turn.fetch_turn_ice_servers() is None


def test_error_status_degrades_instead_of_raising(configured, monkeypatch):
    monkeypatch.setattr(turn.httpx, "post", lambda url, **kwargs: FakeResponse({}, status_code=401))

    assert turn.fetch_turn_ice_servers() is None


def test_empty_or_junk_payload_degrades(configured, monkeypatch):
    monkeypatch.setattr(turn.httpx, "post", lambda url, **kwargs: FakeResponse({"iceServers": []}))
    assert turn.fetch_turn_ice_servers() is None

    monkeypatch.setattr(turn.httpx, "post", lambda url, **kwargs: FakeResponse({"nope": 1}))
    assert turn.fetch_turn_ice_servers() is None
