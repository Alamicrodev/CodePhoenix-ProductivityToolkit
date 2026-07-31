import { describe, expect, it } from "vitest";

import { getTaskIdsInFocus } from "./focusStatus";
import { FocusSession } from "../context/DataContext";

function session(overrides: Partial<FocusSession>): FocusSession {
  return {
    id: "s1",
    title: "Session",
    totalDurationMinutes: 60,
    focusLengthMinutes: 25,
    breakLengthMinutes: 5,
    elapsedSeconds: 0,
    phaseType: "focus",
    phaseRemainingSeconds: 1500,
    status: "active",
    completionResult: null,
    completed: false,
    completedFocusBlocks: 0,
    createdAt: "2026-07-31T10:00:00Z",
    startedAt: "2026-07-31T10:00:00Z",
    updatedAt: "2026-07-31T10:00:00Z",
    pausedAt: null,
    endedAt: null,
    items: [],
    ...overrides,
  };
}

const taskItem = (id: string, sourceId: string) => ({
  id,
  sourceId,
  sourceType: "task" as const,
  title: "t",
  addedAt: "2026-07-31T10:00:00Z",
  completedInSessionAt: null,
});

describe("getTaskIdsInFocus", () => {
  it("collects task ids from sessions matching the given statuses", () => {
    const sessions = [
      session({ id: "a", status: "active", items: [taskItem("i1", "t1")] }),
      session({ id: "b", status: "paused", items: [taskItem("i2", "t2")] }),
      session({ id: "c", status: "completed", items: [taskItem("i3", "t3")] }),
    ];

    expect(getTaskIdsInFocus(sessions)).toEqual(new Set(["t1"]));
    expect(getTaskIdsInFocus(sessions, ["active", "paused"])).toEqual(new Set(["t1", "t2"]));
  });

  it("ignores habit items", () => {
    const sessions = [
      session({
        items: [
          { ...taskItem("i1", "h1"), sourceType: "habit" as const },
          taskItem("i2", "t1"),
        ],
      }),
    ];
    expect(getTaskIdsInFocus(sessions)).toEqual(new Set(["t1"]));
  });
});
