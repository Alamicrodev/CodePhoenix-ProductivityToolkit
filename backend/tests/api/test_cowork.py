from datetime import datetime, timedelta, timezone

import pytest
from fastapi.websockets import WebSocketDisconnect

from app.models.cowork import CoworkSession
from app.services import cowork_rooms
from app.services.cowork_rooms import room_registry
from tests.factories import API


@pytest.fixture(autouse=True)
def clear_room_registry():
    """The registry is a process global — never let one test leak peers into the next."""
    room_registry._rooms.clear()
    yield
    room_registry._rooms.clear()


def token_of(headers):
    return headers["Authorization"].split(" ", 1)[1]


def create_room(client, headers, **payload):
    response = client.post(f"{API}/cowork-sessions", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def socket_url(slug, headers):
    return f"{API}/ws/cowork/{slug}?token={token_of(headers)}"


class TestCoworkRoomsApi:
    def test_create_returns_an_unguessable_slug_and_host_flag(self, client, auth_headers):
        room = create_room(client, auth_headers, title="Morning sprint")

        assert room["title"] == "Morning sprint"
        assert room["status"] == "open"
        assert room["is_host"] is True
        assert room["participant_count"] == 0
        assert len(room["slug"]) >= 10

    def test_slugs_are_unique_per_room(self, client, auth_headers):
        first = create_room(client, auth_headers)
        second = create_room(client, auth_headers)
        assert first["slug"] != second["slug"]

    def test_title_defaults_when_omitted(self, client, auth_headers):
        assert create_room(client, auth_headers)["title"] == "Cowork session"

    def test_invited_guest_can_read_the_room_but_is_not_host(self, client, auth_headers, other_auth_headers):
        room = create_room(client, auth_headers)

        response = client.get(f"{API}/cowork-sessions/{room['slug']}", headers=other_auth_headers)

        assert response.status_code == 200
        assert response.json()["is_host"] is False
        assert response.json()["host_name"] == "Test User"

    def test_unknown_slug_is_not_found(self, client, auth_headers):
        assert client.get(f"{API}/cowork-sessions/nope", headers=auth_headers).status_code == 404

    def test_room_requires_authentication(self, client, auth_headers):
        room = create_room(client, auth_headers)
        assert client.get(f"{API}/cowork-sessions/{room['slug']}").status_code == 401

    def test_host_can_end_the_room_and_it_stops_resolving(self, client, auth_headers):
        room = create_room(client, auth_headers)

        ended = client.post(f"{API}/cowork-sessions/{room['slug']}/end", headers=auth_headers)
        assert ended.status_code == 200
        assert ended.json()["status"] == "ended"

        assert client.get(f"{API}/cowork-sessions/{room['slug']}", headers=auth_headers).status_code == 404

    def test_ending_twice_is_idempotent(self, client, auth_headers):
        room = create_room(client, auth_headers)
        client.post(f"{API}/cowork-sessions/{room['slug']}/end", headers=auth_headers)

        again = client.post(f"{API}/cowork-sessions/{room['slug']}/end", headers=auth_headers)
        assert again.status_code == 200
        assert again.json()["status"] == "ended"

    def test_guest_cannot_end_someone_elses_room(self, client, auth_headers, other_auth_headers):
        room = create_room(client, auth_headers)

        response = client.post(f"{API}/cowork-sessions/{room['slug']}/end", headers=other_auth_headers)

        assert response.status_code == 403
        assert client.get(f"{API}/cowork-sessions/{room['slug']}", headers=auth_headers).status_code == 200

    def test_expired_room_reads_as_gone(self, client, db, auth_headers):
        room = create_room(client, auth_headers)
        stored = db.get(CoworkSession, room["id"])
        stored.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.commit()

        assert client.get(f"{API}/cowork-sessions/{room['slug']}", headers=auth_headers).status_code == 404

    def test_listing_shows_my_open_rooms_only(self, client, db, auth_headers, other_auth_headers):
        mine = create_room(client, auth_headers, title="Mine")
        create_room(client, other_auth_headers, title="Theirs")
        ended = create_room(client, auth_headers, title="Ended")
        client.post(f"{API}/cowork-sessions/{ended['slug']}/end", headers=auth_headers)

        listed = client.get(f"{API}/cowork-sessions", headers=auth_headers).json()

        assert [entry["title"] for entry in listed] == ["Mine"]
        assert listed[0]["slug"] == mine["slug"]

    def test_listing_lazily_closes_expired_rooms(self, client, db, auth_headers):
        room = create_room(client, auth_headers)
        stored = db.get(CoworkSession, room["id"])
        stored.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.commit()

        assert client.get(f"{API}/cowork-sessions", headers=auth_headers).json() == []
        db.expire_all()
        assert db.get(CoworkSession, room["id"]).status == "ended"

    def test_ice_config_exposes_stun_and_reports_missing_turn(self, client, auth_headers):
        config = client.get(f"{API}/cowork-sessions/ice-config", headers=auth_headers).json()

        assert any("stun:" in url for server in config["ice_servers"] for url in server["urls"])
        # No TURN configured in the test environment, and the flag must say so
        # rather than pretending peers behind symmetric NAT will connect.
        assert config["has_turn"] is False


class TestCoworkSocket:
    def test_first_peer_receives_a_welcome_with_an_empty_roster(self, client, auth_headers):
        room = create_room(client, auth_headers)

        with client.websocket_connect(socket_url(room["slug"], auth_headers)) as socket:
            welcome = socket.receive_json()

        assert welcome["type"] == "welcome"
        assert welcome["payload"]["peers"] == []
        assert welcome["payload"]["room"]["slug"] == room["slug"]
        assert welcome["payload"]["peer_id"]

    def test_second_peer_sees_the_first_and_the_first_is_notified(self, client, auth_headers, other_auth_headers):
        room = create_room(client, auth_headers)

        with client.websocket_connect(socket_url(room["slug"], auth_headers)) as host_socket:
            host_welcome = host_socket.receive_json()

            with client.websocket_connect(socket_url(room["slug"], other_auth_headers)) as guest_socket:
                guest_welcome = guest_socket.receive_json()
                joined = host_socket.receive_json()

        # The joiner gets the existing roster so it can dial each person already inside.
        assert [peer["display_name"] for peer in guest_welcome["payload"]["peers"]] == ["Test User"]
        assert joined["type"] == "peer-joined"
        assert joined["payload"]["display_name"] == "Other User"
        assert joined["payload"]["peer_id"] == guest_welcome["payload"]["peer_id"]
        assert host_welcome["payload"]["peer_id"] != guest_welcome["payload"]["peer_id"]

    def test_leaving_notifies_the_room(self, client, auth_headers, other_auth_headers):
        room = create_room(client, auth_headers)

        with client.websocket_connect(socket_url(room["slug"], auth_headers)) as host_socket:
            host_socket.receive_json()
            with client.websocket_connect(socket_url(room["slug"], other_auth_headers)) as guest_socket:
                guest_welcome = guest_socket.receive_json()
                host_socket.receive_json()  # peer-joined
            left = host_socket.receive_json()

        assert left["type"] == "peer-left"
        assert left["payload"]["peer_id"] == guest_welcome["payload"]["peer_id"]

    def test_shared_task_list_is_broadcast_to_the_room(self, client, auth_headers, other_auth_headers):
        room = create_room(client, auth_headers)

        with client.websocket_connect(socket_url(room["slug"], auth_headers)) as host_socket:
            host_welcome = host_socket.receive_json()
            with client.websocket_connect(socket_url(room["slug"], other_auth_headers)) as guest_socket:
                guest_socket.receive_json()
                host_socket.receive_json()  # peer-joined

                host_socket.send_json(
                    {"type": "task-list", "payload": {"tasks": [{"id": "t1", "title": "Write report", "completed": False}]}}
                )
                broadcast = guest_socket.receive_json()

        assert broadcast["type"] == "task-list"
        assert broadcast["from"] == host_welcome["payload"]["peer_id"]
        assert broadcast["payload"]["tasks"] == [{"id": "t1", "title": "Write report", "completed": False}]

    def test_late_joiner_sees_task_lists_shared_before_it_arrived(self, client, auth_headers, other_auth_headers):
        room = create_room(client, auth_headers)

        with client.websocket_connect(socket_url(room["slug"], auth_headers)) as host_socket:
            host_socket.receive_json()
            host_socket.send_json({"type": "task-list", "payload": {"tasks": [{"id": "t1", "title": "Earlier"}]}})
            host_socket.receive_json()  # own broadcast echo

            with client.websocket_connect(socket_url(room["slug"], other_auth_headers)) as guest_socket:
                guest_welcome = guest_socket.receive_json()

        assert guest_welcome["payload"]["peers"][0]["shared_tasks"] == [
            {"id": "t1", "title": "Earlier", "completed": False}
        ]

    def test_signals_reach_only_the_targeted_peer_and_carry_a_trusted_sender(
        self, client, auth_headers, other_auth_headers
    ):
        room = create_room(client, auth_headers)

        with client.websocket_connect(socket_url(room["slug"], auth_headers)) as host_socket:
            host_welcome = host_socket.receive_json()
            with client.websocket_connect(socket_url(room["slug"], other_auth_headers)) as guest_socket:
                guest_welcome = guest_socket.receive_json()
                host_socket.receive_json()  # peer-joined

                host_socket.send_json(
                    {
                        "type": "offer",
                        "to": guest_welcome["payload"]["peer_id"],
                        # A spoofed `from` must be ignored — the server stamps its own.
                        "from": "somebody-else",
                        "payload": {"sdp": "v=0", "type": "offer"},
                    }
                )
                relayed = guest_socket.receive_json()

        assert relayed["type"] == "offer"
        assert relayed["from"] == host_welcome["payload"]["peer_id"]
        assert relayed["payload"] == {"sdp": "v=0", "type": "offer"}

    def test_signal_to_an_unknown_peer_reports_an_error(self, client, auth_headers):
        room = create_room(client, auth_headers)

        with client.websocket_connect(socket_url(room["slug"], auth_headers)) as socket:
            socket.receive_json()
            socket.send_json({"type": "offer", "to": "ghost", "payload": {}})
            error = socket.receive_json()

        assert error["type"] == "error"

    def test_ping_is_answered_with_pong(self, client, auth_headers):
        room = create_room(client, auth_headers)

        with client.websocket_connect(socket_url(room["slug"], auth_headers)) as socket:
            socket.receive_json()
            socket.send_json({"type": "ping"})
            assert socket.receive_json()["type"] == "pong"

    def test_malformed_task_list_errors_without_dropping_the_socket(self, client, auth_headers):
        room = create_room(client, auth_headers)

        with client.websocket_connect(socket_url(room["slug"], auth_headers)) as socket:
            socket.receive_json()
            socket.send_json({"type": "task-list", "payload": {"tasks": [{"nope": 1}]}})
            assert socket.receive_json()["type"] == "error"

            # still usable afterwards
            socket.send_json({"type": "ping"})
            assert socket.receive_json()["type"] == "pong"

    def test_bad_token_is_rejected(self, client, auth_headers):
        room = create_room(client, auth_headers)

        with pytest.raises(WebSocketDisconnect) as excinfo:
            with client.websocket_connect(f"{API}/ws/cowork/{room['slug']}?token=garbage") as socket:
                socket.receive_json()

        assert excinfo.value.code == 4401

    def test_ended_room_rejects_connections(self, client, auth_headers):
        room = create_room(client, auth_headers)
        client.post(f"{API}/cowork-sessions/{room['slug']}/end", headers=auth_headers)

        with pytest.raises(WebSocketDisconnect) as excinfo:
            with client.websocket_connect(socket_url(room["slug"], auth_headers)) as socket:
                socket.receive_json()

        assert excinfo.value.code == 4404

    def test_same_user_cannot_occupy_two_tiles(self, client, auth_headers):
        room = create_room(client, auth_headers)

        with client.websocket_connect(socket_url(room["slug"], auth_headers)) as socket:
            socket.receive_json()

            with pytest.raises(WebSocketDisconnect) as excinfo:
                with client.websocket_connect(socket_url(room["slug"], auth_headers)) as duplicate:
                    duplicate.receive_json()

        assert excinfo.value.code == 4409

    def test_room_is_capped(self, client, monkeypatch, auth_headers, other_auth_headers):
        # The mesh cap is about participants' upload bandwidth, so verify the
        # server refuses rather than trusting the UI to stop at the limit.
        monkeypatch.setattr(cowork_rooms, "MAX_ROOM_PARTICIPANTS", 1)
        room = create_room(client, auth_headers)

        with client.websocket_connect(socket_url(room["slug"], auth_headers)) as socket:
            socket.receive_json()

            with pytest.raises(WebSocketDisconnect) as excinfo:
                with client.websocket_connect(socket_url(room["slug"], other_auth_headers)) as extra:
                    extra.receive_json()

        assert excinfo.value.code == 4403

    def test_participant_count_reflects_live_sockets(self, client, auth_headers, other_auth_headers):
        room = create_room(client, auth_headers)

        with client.websocket_connect(socket_url(room["slug"], auth_headers)) as socket:
            socket.receive_json()
            live = client.get(f"{API}/cowork-sessions/{room['slug']}", headers=other_auth_headers).json()

        assert live["participant_count"] == 1
