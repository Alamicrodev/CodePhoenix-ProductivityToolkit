"""QA tool: join a cowork room and publish synthetic video through the SFU.

Acts as a complete fake participant — logs in, joins the room socket (which the
SFU proxy's membership gate requires), creates a Cloudflare session, publishes a
moving color pattern as a real WebRTC video track, and announces it to the room.
Anyone in the room should then see a "Sam Partner" tile with live video.

Exercises the entire production path: proxy routes -> Cloudflare Sessions/
Tracks API -> SFU media routing -> subscribers. Useful whenever a change to the
SFU stack needs a second participant with a camera and none is at hand.

Requires (not in requirements.txt — QA-only, keep the image lean):
    pip install aiortc numpy

Usage (inside the backend container):
    python scripts/sfu_fake_publisher.py <room-slug> [seconds=60]
        [email=qa.partner.20260720@codephoenix-qa.dev] [password=CpQaTest!2026x9]
"""

import asyncio
import json
import sys
import time
import urllib.request

import numpy as np
from aiortc import RTCPeerConnection, RTCSessionDescription, VideoStreamTrack
from av import VideoFrame

import websockets

API = "http://localhost:8000/api/v1"
WS = "ws://localhost:8000/api/v1"


class ColorBarsTrack(VideoStreamTrack):
    """640x360@15 moving gradient — visibly alive, trivially cheap to produce."""

    async def recv(self):
        pts, time_base = await self.next_timestamp()
        height, width = 360, 640
        shift = int(time.time() * 60) % width
        column = (np.arange(width) + shift) % width
        frame_data = np.zeros((height, width, 3), dtype=np.uint8)
        frame_data[:, :, 0] = (column * 255 // width)[None, :]
        frame_data[:, :, 1] = np.linspace(0, 255, height, dtype=np.uint8)[:, None]
        frame_data[:, :, 2] = 128
        frame = VideoFrame.from_ndarray(frame_data, format="rgb24")
        frame.pts = pts
        frame.time_base = time_base
        return frame


def http_json(method: str, path: str, token: str | None = None, body: dict | None = None) -> dict:
    request = urllib.request.Request(
        f"{API}{path}",
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "Content-Type": "application/json",
            **({"Authorization": f"Bearer {token}"} if token else {}),
        },
    )
    with urllib.request.urlopen(request) as response:
        return json.load(response)


async def main() -> None:
    slug = sys.argv[1]
    duration = int(sys.argv[2]) if len(sys.argv) > 2 else 60
    email = sys.argv[3] if len(sys.argv) > 3 else "qa.partner.20260720@codephoenix-qa.dev"
    password = sys.argv[4] if len(sys.argv) > 4 else "CpQaTest!2026x9"

    token = http_json("POST", "/auth/login", body={"email": email, "password": password})["access_token"]

    async with websockets.connect(f"{WS}/ws/cowork/{slug}?token={token}") as socket:
        welcome = json.loads(await socket.recv())
        peer_id = welcome["payload"]["peer_id"]
        print("JOINED as peer", peer_id, flush=True)

        # --- build and publish the WebRTC track -------------------------------
        pc = RTCPeerConnection()
        transceiver = pc.addTransceiver(ColorBarsTrack(), direction="sendonly")

        offer = await pc.createOffer()
        # aiortc completes ICE gathering inside setLocalDescription, so the SDP
        # we send afterwards contains the candidates Cloudflare needs (this API
        # has no trickle channel).
        await pc.setLocalDescription(offer)

        track_name = f"{peer_id}-video"
        session_id = http_json("POST", f"/cowork-sessions/{slug}/sfu/session", token)["session_id"]
        print("SFU session", session_id, flush=True)

        publish_response = http_json(
            "POST",
            f"/cowork-sessions/{slug}/sfu/publish",
            token,
            {
                "session_id": session_id,
                "session_description": {
                    "type": pc.localDescription.type,
                    "sdp": pc.localDescription.sdp,
                },
                "tracks": [{"location": "local", "mid": transceiver.mid, "trackName": track_name}],
            },
        )
        answer = publish_response["sessionDescription"]
        await pc.setRemoteDescription(RTCSessionDescription(sdp=answer["sdp"], type=answer["type"]))
        print("PUBLISHED", track_name, "| track results:", publish_response.get("tracks"), flush=True)

        @pc.on("connectionstatechange")
        def on_state() -> None:
            print("PC STATE", pc.connectionState, flush=True)

        await socket.send(
            json.dumps(
                {
                    "type": "media-published",
                    "payload": {"session_id": session_id, "track_names": [track_name]},
                }
            )
        )
        print("ANNOUNCED — the room should now show this tile with video", flush=True)

        # --- stay alive so subscribers can watch ------------------------------
        deadline = asyncio.get_event_loop().time() + duration

        async def pump_socket() -> None:
            async for raw in socket:
                message = json.loads(raw)
                if message.get("type") != "pong":
                    print("WS", message.get("type"), flush=True)

        pump = asyncio.create_task(pump_socket())
        try:
            while asyncio.get_event_loop().time() < deadline:
                await socket.send(json.dumps({"type": "ping"}))
                await asyncio.sleep(20)
        finally:
            pump.cancel()
            await pc.close()
            print("DONE", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
