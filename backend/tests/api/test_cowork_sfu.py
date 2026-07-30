"""API tests for the SFU proxy routes.

Cloudflare itself is monkeypatched — these tests pin the proxy's own contract:
auth, live-membership gating, error mapping, and body passthrough.
"""

import pytest

from app.api.routes import cowork_sfu
from app.services.cowork_rooms import Peer, room_registry
from app.services.sfu import SfuError
from tests.factories import API


@pytest.fixture(autouse=True)
def clear_room_registry():
    room_registry._rooms.clear()
    yield
    room_registry._rooms.clear()


def create_room(client, headers):
    response = client.post(f"{API}/cowork-sessions", json={}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def join_registry(client, slug, headers):
    """Plant the caller in the room's in-memory registry, as if their socket were open."""
    me = client.get(f"{API}/auth/me", headers=headers).json()
    room_registry._rooms.setdefault(slug, {})["peer-test"] = Peer(
        peer_id="peer-test",
        user_id=me["id"],
        display_name=me["full_name"],
        websocket=None,  # never touched by the REST layer
    )


class TestSfuProxyGating:
    def test_requires_authentication(self, client, auth_headers):
        room = create_room(client, auth_headers)
        response = client.post(f"{API}/cowork-sessions/{room['slug']}/sfu/session")
        assert response.status_code == 401

    def test_requires_live_room_membership(self, client, monkeypatch, auth_headers):
        # Authenticated but not connected to the room: refused. This is what
        # stops arbitrary accounts pumping media through our Cloudflare app.
        room = create_room(client, auth_headers)
        monkeypatch.setattr(
            cowork_sfu.sfu,
            "create_session",
            lambda session_description=None: {"session_id": "sess-1", "session_description": None},
        )

        response = client.post(f"{API}/cowork-sessions/{room['slug']}/sfu/session", headers=auth_headers)

        assert response.status_code == 403

    def test_unknown_room_is_404(self, client, auth_headers):
        response = client.post(f"{API}/cowork-sessions/nope/sfu/session", headers=auth_headers)
        assert response.status_code == 404

    def test_ended_room_refuses_sfu_calls(self, client, auth_headers):
        room = create_room(client, auth_headers)
        join_registry(client, room["slug"], auth_headers)
        client.post(f"{API}/cowork-sessions/{room['slug']}/end", headers=auth_headers)

        response = client.post(f"{API}/cowork-sessions/{room['slug']}/sfu/session", headers=auth_headers)

        assert response.status_code == 404


class TestSfuProxyCalls:
    def test_create_session_returns_the_cloudflare_id(self, client, monkeypatch, auth_headers):
        room = create_room(client, auth_headers)
        join_registry(client, room["slug"], auth_headers)
        monkeypatch.setattr(
            cowork_sfu.sfu,
            "create_session",
            lambda session_description=None: {"session_id": "sess-cf-1", "session_description": None},
        )

        response = client.post(f"{API}/cowork-sessions/{room['slug']}/sfu/session", headers=auth_headers)

        assert response.status_code == 200
        assert response.json() == {"session_id": "sess-cf-1", "session_description": None}

    def test_create_session_forwards_a_bootstrap_offer_and_returns_the_answer(
        self, client, monkeypatch, auth_headers
    ):
        room = create_room(client, auth_headers)
        join_registry(client, room["slug"], auth_headers)
        seen = {}

        def fake_create(session_description=None):
            seen["sdp"] = session_description
            return {"session_id": "sess-cf-1", "session_description": {"type": "answer", "sdp": "v=0"}}

        monkeypatch.setattr(cowork_sfu.sfu, "create_session", fake_create)

        response = client.post(
            f"{API}/cowork-sessions/{room['slug']}/sfu/session",
            headers=auth_headers,
            json={"session_description": {"type": "offer", "sdp": "v=0 bootstrap"}},
        )

        assert response.status_code == 200
        assert seen["sdp"] == {"type": "offer", "sdp": "v=0 bootstrap"}
        assert response.json()["session_description"]["type"] == "answer"

    def test_publish_passes_offer_and_tracks_through(self, client, monkeypatch, auth_headers):
        room = create_room(client, auth_headers)
        join_registry(client, room["slug"], auth_headers)
        seen = {}

        def fake_new_tracks(session_id, tracks, session_description=None):
            seen.update(session_id=session_id, tracks=tracks, sdp=session_description)
            return {"sessionDescription": {"type": "answer", "sdp": "v=0"}, "tracks": tracks}

        monkeypatch.setattr(cowork_sfu.sfu, "new_tracks", fake_new_tracks)

        response = client.post(
            f"{API}/cowork-sessions/{room['slug']}/sfu/publish",
            headers=auth_headers,
            json={
                "session_id": "sess-cf-1",
                "session_description": {"type": "offer", "sdp": "v=0"},
                "tracks": [{"location": "local", "mid": "0", "trackName": "p1-video"}],
            },
        )

        assert response.status_code == 200
        assert seen["session_id"] == "sess-cf-1"
        assert seen["sdp"] == {"type": "offer", "sdp": "v=0"}
        assert response.json()["sessionDescription"]["type"] == "answer"

    def test_subscribe_builds_remote_track_descriptors(self, client, monkeypatch, auth_headers):
        room = create_room(client, auth_headers)
        join_registry(client, room["slug"], auth_headers)
        seen = {}

        def fake_new_tracks(session_id, tracks, session_description=None):
            seen.update(tracks=tracks, sdp=session_description)
            return {"requiresImmediateRenegotiation": True, "sessionDescription": {"type": "offer", "sdp": "v=0"}}

        monkeypatch.setattr(cowork_sfu.sfu, "new_tracks", fake_new_tracks)

        response = client.post(
            f"{API}/cowork-sessions/{room['slug']}/sfu/subscribe",
            headers=auth_headers,
            json={
                "session_id": "sess-cf-1",
                "remote_session_id": "sess-cf-2",
                "track_names": ["p2-video", "p2-audio"],
            },
        )

        assert response.status_code == 200
        # The proxy owns the remote-descriptor shape so clients cannot claim
        # location "local" on someone else's session.
        assert seen["tracks"] == [
            {"location": "remote", "sessionId": "sess-cf-2", "trackName": "p2-video"},
            {"location": "remote", "sessionId": "sess-cf-2", "trackName": "p2-audio"},
        ]
        assert seen["sdp"] is None

    def test_renegotiate_forwards_the_answer(self, client, monkeypatch, auth_headers):
        room = create_room(client, auth_headers)
        join_registry(client, room["slug"], auth_headers)
        seen = {}
        monkeypatch.setattr(
            cowork_sfu.sfu,
            "renegotiate",
            lambda session_id, sdp: seen.update(session_id=session_id, sdp=sdp) or {},
        )

        response = client.put(
            f"{API}/cowork-sessions/{room['slug']}/sfu/renegotiate",
            headers=auth_headers,
            json={"session_id": "sess-cf-1", "session_description": {"type": "answer", "sdp": "v=0"}},
        )

        assert response.status_code == 200
        assert seen["sdp"]["type"] == "answer"

    def test_sfu_unconfigured_maps_to_503(self, client, monkeypatch, auth_headers):
        room = create_room(client, auth_headers)
        join_registry(client, room["slug"], auth_headers)

        def unavailable(session_description=None):
            raise SfuError("Video service is not configured", 503)

        monkeypatch.setattr(cowork_sfu.sfu, "create_session", unavailable)

        response = client.post(f"{API}/cowork-sessions/{room['slug']}/sfu/session", headers=auth_headers)

        assert response.status_code == 503
        assert "not configured" in response.json()["detail"]

    def test_cloudflare_rejection_maps_to_502(self, client, monkeypatch, auth_headers):
        room = create_room(client, auth_headers)
        join_registry(client, room["slug"], auth_headers)

        def rejected(session_id, tracks, session_description=None):
            raise SfuError("Video service rejected the request", 502)

        monkeypatch.setattr(cowork_sfu.sfu, "new_tracks", rejected)

        response = client.post(
            f"{API}/cowork-sessions/{room['slug']}/sfu/publish",
            headers=auth_headers,
            json={
                "session_id": "s",
                "session_description": {"type": "offer", "sdp": "v=0"},
                "tracks": [{"location": "local", "mid": "0", "trackName": "t"}],
            },
        )

        assert response.status_code == 502
