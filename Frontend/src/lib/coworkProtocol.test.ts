import { describe, expect, it } from "vitest";

import { CLOSE_CODES, describeCloseCode, isFatalCloseCode, reconnectDelayMs } from "./coworkProtocol";

describe("isFatalCloseCode", () => {
  it("treats server refusals as fatal so the client stops retrying", () => {
    expect(isFatalCloseCode(CLOSE_CODES.unauthorized)).toBe(true);
    expect(isFatalCloseCode(CLOSE_CODES.roomFull)).toBe(true);
    expect(isFatalCloseCode(CLOSE_CODES.roomNotFound)).toBe(true);
    expect(isFatalCloseCode(CLOSE_CODES.alreadyJoined)).toBe(true);
  });

  it("treats an ordinary drop as retryable — a Render restart closes with 1006", () => {
    expect(isFatalCloseCode(1006)).toBe(false);
    expect(isFatalCloseCode(1001)).toBe(false);
  });
});

describe("describeCloseCode", () => {
  it("explains each refusal in words a user can act on", () => {
    expect(describeCloseCode(CLOSE_CODES.roomFull)).toMatch(/full/i);
    expect(describeCloseCode(CLOSE_CODES.alreadyJoined)).toMatch(/another tab/i);
    expect(describeCloseCode(1006)).toMatch(/lost connection/i);
  });
});

describe("reconnectDelayMs", () => {
  it("backs off exponentially", () => {
    const noJitter = () => 1;
    expect(reconnectDelayMs(0, noJitter)).toBe(1000);
    expect(reconnectDelayMs(1, noJitter)).toBe(2000);
    expect(reconnectDelayMs(3, noJitter)).toBe(8000);
  });

  it("caps the delay so a long outage still reconnects promptly on recovery", () => {
    const noJitter = () => 1;
    expect(reconnectDelayMs(10, noJitter)).toBe(30000);
    expect(reconnectDelayMs(50, noJitter)).toBe(30000);
  });

  it("jitters within half the delay so a room full of clients does not stampede", () => {
    // One restart drops every socket at once; without jitter they would all
    // reconnect on the same tick and hammer the instance as it boots.
    expect(reconnectDelayMs(2, () => 0)).toBe(2000);
    expect(reconnectDelayMs(2, () => 1)).toBe(4000);
    expect(reconnectDelayMs(2, () => 0.5)).toBe(3000);
  });
});
