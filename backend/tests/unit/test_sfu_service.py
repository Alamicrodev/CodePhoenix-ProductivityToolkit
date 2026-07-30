"""Unit tests for the Cloudflare SFU client.

Same contract as the TURN service: video failing must degrade, never crash the
room. Errors become typed SfuError with a stable client-safe message.
"""

import httpx
import pytest

from app.services import sfu


class FakeResponse:
    def __init__(self, payload, status_code=200, text=""):
        self._payload = payload
        self.status_code = status_code
        self.text = text

    def json(self):
        if isinstance(self._payload, Exception):
            raise self._payload
        return self._payload


@pytest.fixture()
def configured(monkeypatch):
    monkeypatch.setattr(sfu.settings, "sfu_app_id", "app-123")
    monkeypatch.setattr(sfu.settings, "sfu_app_secret", "secret-abc")


def capture(monkeypatch, response):
    calls = {}

    def fake_request(method, url, **kwargs):
        calls["method"] = method
        calls["url"] = url
        calls["headers"] = kwargs["headers"]
        # Absent entirely for bodyless calls — sessions/new rejects even `{}`.
        calls["json"] = kwargs.get("json", "<no body>")
        return response

    monkeypatch.setattr(sfu.httpx, "request", fake_request)
    return calls


def test_unconfigured_raises_503_before_any_network_call(monkeypatch):
    monkeypatch.setattr(sfu.settings, "sfu_app_id", None)
    monkeypatch.setattr(sfu.settings, "sfu_app_secret", None)

    with pytest.raises(sfu.SfuError) as excinfo:
        sfu.create_session()

    assert excinfo.value.status_code == 503
    assert sfu.is_sfu_configured() is False


def test_create_session_posts_bodyless_with_the_secret(configured, monkeypatch):
    calls = capture(monkeypatch, FakeResponse({"sessionId": "sess-1"}))

    created = sfu.create_session()

    assert created == {"session_id": "sess-1", "session_description": None}
    assert calls["method"] == "POST"
    assert calls["url"] == "https://rtc.live.cloudflare.com/v1/apps/app-123/sessions/new"
    assert calls["headers"]["Authorization"] == "Bearer secret-abc"
    # Observed live: `{}` fails Cloudflare's validation; the POST must carry no body.
    assert calls["json"] == "<no body>"


def test_create_session_with_a_bootstrap_offer_returns_the_answer(configured, monkeypatch):
    # Receive-only participants negotiate at creation (data-channel offer),
    # since a never-connected session refuses all later operations.
    answer = {"type": "answer", "sdp": "v=0 answer"}
    calls = capture(monkeypatch, FakeResponse({"sessionId": "sess-1", "sessionDescription": answer}))

    created = sfu.create_session({"type": "offer", "sdp": "v=0 offer"})

    assert calls["json"] == {"sessionDescription": {"type": "offer", "sdp": "v=0 offer"}}
    assert created == {"session_id": "sess-1", "session_description": answer}


def test_create_session_without_an_id_is_a_502(configured, monkeypatch):
    capture(monkeypatch, FakeResponse({"unexpected": True}))

    with pytest.raises(sfu.SfuError) as excinfo:
        sfu.create_session()

    assert excinfo.value.status_code == 502


def test_new_tracks_passes_the_body_through(configured, monkeypatch):
    answer = {"sessionDescription": {"type": "answer", "sdp": "v=0"}, "tracks": [{"mid": "0"}]}
    calls = capture(monkeypatch, FakeResponse(answer))

    tracks = [{"location": "local", "mid": "0", "trackName": "p1-video"}]
    offer = {"type": "offer", "sdp": "v=0"}
    result = sfu.new_tracks("sess-1", tracks, offer)

    assert calls["url"].endswith("/sessions/sess-1/tracks/new")
    assert calls["json"] == {"tracks": tracks, "sessionDescription": offer}
    assert result == answer


def test_subscribe_shape_omits_the_session_description(configured, monkeypatch):
    calls = capture(monkeypatch, FakeResponse({"tracks": []}))

    sfu.new_tracks("sess-1", [{"location": "remote", "sessionId": "sess-2", "trackName": "p2-video"}])

    assert "sessionDescription" not in calls["json"]


def test_renegotiate_puts_the_answer(configured, monkeypatch):
    calls = capture(monkeypatch, FakeResponse({}))

    sfu.renegotiate("sess-1", {"type": "answer", "sdp": "v=0"})

    assert calls["method"] == "PUT"
    assert calls["url"].endswith("/sessions/sess-1/renegotiate")
    assert calls["json"] == {"sessionDescription": {"type": "answer", "sdp": "v=0"}}


def test_close_tracks_carries_the_force_flag(configured, monkeypatch):
    calls = capture(monkeypatch, FakeResponse({}))

    sfu.close_tracks("sess-1", [{"mid": "0"}], force=True)

    assert calls["url"].endswith("/sessions/sess-1/tracks/close")
    assert calls["json"] == {"tracks": [{"mid": "0"}], "force": True}


def test_network_failure_maps_to_503(configured, monkeypatch):
    def explode(method, url, **kwargs):
        raise httpx.ConnectTimeout("edge unreachable")

    monkeypatch.setattr(sfu.httpx, "request", explode)

    with pytest.raises(sfu.SfuError) as excinfo:
        sfu.create_session()

    assert excinfo.value.status_code == 503


def test_http_error_maps_to_502_with_a_stable_message(configured, monkeypatch):
    capture(monkeypatch, FakeResponse({}, status_code=401, text="bad app secret"))

    with pytest.raises(sfu.SfuError) as excinfo:
        sfu.create_session()

    assert excinfo.value.status_code == 502
    # Cloudflare's own wording must not leak to clients.
    assert "bad app secret" not in excinfo.value.detail


def test_error_code_inside_a_200_body_is_still_an_error(configured, monkeypatch):
    capture(monkeypatch, FakeResponse({"errorCode": "invalid_sdp", "errorDescription": "nope"}))

    with pytest.raises(sfu.SfuError) as excinfo:
        sfu.new_tracks("sess-1", [])

    assert excinfo.value.status_code == 502


def test_unparseable_body_is_a_502(configured, monkeypatch):
    capture(monkeypatch, FakeResponse(ValueError("not json")))

    with pytest.raises(sfu.SfuError) as excinfo:
        sfu.create_session()

    assert excinfo.value.status_code == 502
