import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCoworkRoom } from "./useCoworkRoom";
import { CLOSE_CODES, CoworkPeer } from "../lib/coworkProtocol";

// Minimal stand-in for the browser WebSocket: records what the hook sent and
// lets a test play the server's side of the conversation.
class MockWebSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  url: string;
  readyState = 0;
  sent: string[] = [];
  closedWith: { code?: number } | null = null;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close(code?: number) {
    this.closedWith = { code };
    this.readyState = MockWebSocket.CLOSED;
  }

  // --- server-side helpers -------------------------------------------------
  serverAccept() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event("open"));
  }

  serverSend(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  serverClose(code: number) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code });
  }

  get sentMessages() {
    return this.sent.map(entry => JSON.parse(entry));
  }
}

const peer = (overrides: Partial<CoworkPeer> = {}): CoworkPeer => ({
  peer_id: "peer-2",
  user_id: "u2",
  display_name: "Other User",
  shared_tasks: [],
  ...overrides,
});

function welcome(peers: CoworkPeer[] = []) {
  return {
    type: "welcome",
    payload: {
      peer_id: "peer-1",
      room: { slug: "abc", title: "Morning sprint", host_user_id: "u1" },
      max_participants: 5,
      peers,
    },
  };
}

function latestSocket() {
  return MockWebSocket.instances[MockWebSocket.instances.length - 1];
}

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal("WebSocket", MockWebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function connectedRoom() {
  const view = renderHook(() => useCoworkRoom("abc", "tok-1"));
  await waitFor(() => expect(MockWebSocket.instances).toHaveLength(1));
  await act(async () => {
    latestSocket().serverAccept();
    latestSocket().serverSend(welcome());
  });
  return view;
}

describe("useCoworkRoom", () => {
  it("opens a socket carrying the auth token", async () => {
    await connectedRoom();

    // The browser cannot set headers on a WebSocket handshake, so the token
    // travels as a query param.
    expect(latestSocket().url).toContain("/ws/cowork/abc");
    expect(latestSocket().url).toContain("token=tok-1");
  });

  it("does not connect without a slug or a token", () => {
    renderHook(() => useCoworkRoom(undefined, "tok-1"));
    renderHook(() => useCoworkRoom("abc", null));
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it("adopts the roster from the welcome frame", async () => {
    const view = renderHook(() => useCoworkRoom("abc", "tok-1"));
    await waitFor(() => expect(MockWebSocket.instances).toHaveLength(1));

    await act(async () => {
      latestSocket().serverAccept();
      latestSocket().serverSend(welcome([peer()]));
    });

    expect(view.result.current.connectionState).toBe("connected");
    expect(view.result.current.selfPeerId).toBe("peer-1");
    expect(view.result.current.room?.title).toBe("Morning sprint");
    expect(view.result.current.peers.map(entry => entry.display_name)).toEqual(["Other User"]);
  });

  it("tracks people arriving and leaving", async () => {
    const view = await connectedRoom();

    await act(async () => latestSocket().serverSend({ type: "peer-joined", payload: peer() }));
    expect(view.result.current.peers).toHaveLength(1);

    // A duplicate join (possible if a frame is replayed) must not double the tile.
    await act(async () => latestSocket().serverSend({ type: "peer-joined", payload: peer() }));
    expect(view.result.current.peers).toHaveLength(1);

    await act(async () =>
      latestSocket().serverSend({ type: "peer-left", payload: { peer_id: "peer-2" } }),
    );
    expect(view.result.current.peers).toHaveLength(0);
  });

  it("applies a peer's task list to that peer only", async () => {
    const view = await connectedRoom();
    await act(async () => {
      latestSocket().serverSend({ type: "peer-joined", payload: peer() });
      latestSocket().serverSend({ type: "peer-joined", payload: peer({ peer_id: "peer-3" }) });
      latestSocket().serverSend({
        type: "task-list",
        from: "peer-2",
        payload: { tasks: [{ id: "t1", title: "Write report", completed: false }] },
      });
    });

    const [second, third] = view.result.current.peers;
    expect(second.shared_tasks).toHaveLength(1);
    expect(third.shared_tasks).toHaveLength(0);
  });

  it("stops retrying when the room refuses us", async () => {
    const view = await connectedRoom();

    await act(async () => latestSocket().serverClose(CLOSE_CODES.roomFull));

    expect(view.result.current.fatalError).toMatch(/full/i);
    expect(view.result.current.connectionState).toBe("closed");
    // Retrying a full room would just fail again on a timer forever.
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("reconnects after an ordinary drop", async () => {
    vi.useFakeTimers();
    const view = renderHook(() => useCoworkRoom("abc", "tok-1"));
    await act(async () => {
      latestSocket().serverAccept();
      latestSocket().serverSend(welcome());
    });

    await act(async () => latestSocket().serverClose(1006));
    expect(view.result.current.connectionState).toBe("reconnecting");

    await act(async () => {
      vi.advanceTimersByTime(31_000);
    });
    expect(MockWebSocket.instances).toHaveLength(2);
  });

  it("replays the shared task list after reconnecting", async () => {
    vi.useFakeTimers();
    const view = renderHook(() => useCoworkRoom("abc", "tok-1"));
    await act(async () => {
      latestSocket().serverAccept();
      latestSocket().serverSend(welcome());
    });

    const tasks = [{ id: "t1", title: "Write report", completed: false }];
    await act(async () => view.result.current.shareTasks(tasks));
    expect(latestSocket().sentMessages).toContainEqual({ type: "task-list", payload: { tasks } });

    await act(async () => latestSocket().serverClose(1006));
    await act(async () => {
      vi.advanceTimersByTime(31_000);
    });
    // The server holds presence in memory, so a reconnect starts from a blank
    // slate and the client has to re-announce what it was sharing.
    await act(async () => {
      latestSocket().serverAccept();
      latestSocket().serverSend(welcome());
    });

    expect(latestSocket().sentMessages).toContainEqual({ type: "task-list", payload: { tasks } });
  });

  it("sends heartbeats so idle sockets are not culled", async () => {
    vi.useFakeTimers();
    renderHook(() => useCoworkRoom("abc", "tok-1"));
    await act(async () => {
      latestSocket().serverAccept();
      latestSocket().serverSend(welcome());
    });

    await act(async () => {
      vi.advanceTimersByTime(31_000);
    });

    expect(latestSocket().sentMessages).toContainEqual({ type: "ping" });
  });

  it("stamps outgoing signals with the target peer", async () => {
    const view = await connectedRoom();

    await act(async () => view.result.current.sendSignal("offer", "peer-2", { sdp: "v=0" }));

    expect(latestSocket().sentMessages).toContainEqual({
      type: "offer",
      to: "peer-2",
      payload: { sdp: "v=0" },
    });
  });

  it("hands raw messages to subscribers so the WebRTC layer can share the socket", async () => {
    const view = await connectedRoom();
    const seen: unknown[] = [];
    act(() => {
      view.result.current.subscribe(message => seen.push(message));
    });

    await act(async () =>
      latestSocket().serverSend({ type: "offer", from: "peer-2", payload: { sdp: "v=0" } }),
    );

    expect(seen).toContainEqual({ type: "offer", from: "peer-2", payload: { sdp: "v=0" } });
  });

  it("closes cleanly on unmount without scheduling a reconnect", async () => {
    vi.useFakeTimers();
    const view = renderHook(() => useCoworkRoom("abc", "tok-1"));
    await act(async () => {
      latestSocket().serverAccept();
      latestSocket().serverSend(welcome());
    });

    const socket = latestSocket();
    act(() => view.unmount());

    expect(socket.closedWith?.code).toBe(1000);
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(MockWebSocket.instances).toHaveLength(1);
  });
});
