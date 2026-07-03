import { describe, expect, it } from "vitest";

import { FocusSession, tickFocusSession } from "./DataContext";

// 2-minute session split into 1-minute focus / 1-minute break blocks keeps
// the boundary math easy to follow: [0-60s focus][60-120s break] -> done.
function makeSession(overrides: Partial<FocusSession> = {}): FocusSession {
  return {
    id: "f1",
    title: "Deep work",
    totalDurationMinutes: 2,
    focusLengthMinutes: 1,
    breakLengthMinutes: 1,
    elapsedSeconds: 0,
    phaseType: "focus",
    phaseRemainingSeconds: 60,
    status: "active",
    completionResult: null,
    completed: false,
    completedFocusBlocks: 0,
    createdAt: "2026-07-02T08:00:00Z",
    startedAt: "2026-07-02T08:00:00Z",
    updatedAt: "2026-07-02T08:00:00Z",
    pausedAt: null,
    endedAt: null,
    items: [],
    ...overrides,
  };
}

describe("tickFocusSession", () => {
  it("advances one second by default", () => {
    const next = tickFocusSession(makeSession());
    expect(next.elapsedSeconds).toBe(1);
    expect(next.phaseRemainingSeconds).toBe(59);
    expect(next.phaseType).toBe("focus");
    expect(next.status).toBe("active");
  });

  it("leaves non-active sessions untouched", () => {
    const paused = makeSession({ status: "paused" });
    expect(tickFocusSession(paused, 45)).toBe(paused);
  });

  it("crosses a focus/break boundary when the delta spans it (background-tab catch-up)", () => {
    const next = tickFocusSession(makeSession(), 60);
    expect(next.elapsedSeconds).toBe(60);
    expect(next.phaseType).toBe("break");
    expect(next.completedFocusBlocks).toBe(1);
    expect(next.phaseRemainingSeconds).toBe(60);
    expect(next.status).toBe("active");
  });

  it("completes the session when the delta reaches the total duration", () => {
    const next = tickFocusSession(makeSession(), 120);
    expect(next.status).toBe("completed");
    expect(next.completed).toBe(true);
    expect(next.elapsedSeconds).toBe(120);
    expect(next.phaseRemainingSeconds).toBe(0);
    expect(next.completionResult).toBe("successful");
    expect(next.endedAt).not.toBeNull();
  });

  it("clamps deltas that overshoot the total duration", () => {
    const next = tickFocusSession(makeSession(), 100_000);
    expect(next.status).toBe("completed");
    expect(next.elapsedSeconds).toBe(120);
  });
});
