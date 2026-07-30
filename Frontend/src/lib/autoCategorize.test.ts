import { describe, expect, it, vi } from "vitest";

import { autoCategorizeTasks, suggestQuadrant } from "./autoCategorize";
import { Task } from "../context/DataContext";

// Wednesday, July 29 2026.
const NOW = new Date(2026, 6, 29, 12, 0);

function task(overrides: Partial<Task>): Task {
  return {
    id: Math.random().toString(36).slice(2),
    title: "t",
    description: "",
    completed: false,
    completedAt: null,
    priority: "medium",
    dueDate: null,
    dueTime: null,
    subtasks: [],
    tags: [],
    ...overrides,
  };
}

describe("suggestQuadrant", () => {
  it("urgent (≤2 days) + important (high/medium) → Do first", () => {
    expect(suggestQuadrant({ dueDate: "2026-07-29", priority: "high" }, NOW)).toBe("urgent-important");
    expect(suggestQuadrant({ dueDate: "2026-07-31", priority: "medium" }, NOW)).toBe("urgent-important");
  });

  it("not urgent + important → Schedule", () => {
    expect(suggestQuadrant({ dueDate: "2026-08-15", priority: "high" }, NOW)).toBe("not-urgent-important");
    expect(suggestQuadrant({ dueDate: null, priority: "medium" }, NOW)).toBe("not-urgent-important");
  });

  it("urgent + not important → Delegate", () => {
    expect(suggestQuadrant({ dueDate: "2026-07-30", priority: "low" }, NOW)).toBe("urgent-not-important");
  });

  it("not urgent + not important → Eliminate", () => {
    expect(suggestQuadrant({ dueDate: null, priority: "low" }, NOW)).toBe("not-urgent-not-important");
  });
});

describe("autoCategorizeTasks", () => {
  it("fills in only tasks without a quadrant by default", async () => {
    const updateTask = vi.fn().mockResolvedValue(true);
    const tasks = [
      task({ id: "a", priority: "high", dueDate: null }),
      task({ id: "b", quadrant: "urgent-important" }),
      task({ id: "c", completed: true }),
    ];

    const count = await autoCategorizeTasks(tasks, updateTask);

    expect(count).toBe(1);
    expect(updateTask).toHaveBeenCalledTimes(1);
    expect(updateTask).toHaveBeenCalledWith("a", { quadrant: "not-urgent-important" });
  });

  it("re-evaluates every active task with recategorizeAll", async () => {
    const updateTask = vi.fn().mockResolvedValue(true);
    const tasks = [
      task({ id: "a", quadrant: "urgent-important", priority: "low", dueDate: null }),
      task({ id: "b", completed: true, quadrant: "urgent-important" }),
    ];

    const count = await autoCategorizeTasks(tasks, updateTask, { recategorizeAll: true });

    expect(count).toBe(1);
    expect(updateTask).toHaveBeenCalledWith("a", { quadrant: "not-urgent-not-important" });
  });
});
