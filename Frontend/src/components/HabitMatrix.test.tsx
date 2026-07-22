import { fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockUseData } = vi.hoisted(() => ({ mockUseData: vi.fn() }));
vi.mock("../context/DataContext", () => ({ useData: mockUseData }));

import { HabitMatrix } from "./HabitMatrix";
import type { Habit } from "../context/DataContext";
import { addDays, localDateKey, startOfLocalDay } from "../lib/habitSchedule";
import { backfillTimestampForDay } from "../lib/habitStats";

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "h1",
    createdAt: "2026-06-20T00:00:00Z",
    title: "Evening walk",
    description: "",
    frequency: "daily",
    activeDays: [],
    streak: 0,
    lastCompleted: null,
    completedDates: [],
    occurrences: [],
    ...overrides,
  };
}

function renderMatrix(habits: Habit[]) {
  return render(
    <MemoryRouter>
      <HabitMatrix habits={habits} />
    </MemoryRouter>,
  );
}

function findCell(container: HTMLElement, key: string): HTMLElement {
  const cell = container.querySelector(`[title^="${key} - "]`);
  if (!cell) {
    throw new Error(`No cell found for ${key}`);
  }
  return cell as HTMLElement;
}

const completeHabit = vi.fn().mockResolvedValue("marker");
const undoCompleteHabit = vi.fn().mockResolvedValue(undefined);
const updateHabit = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-03T12:00:00Z"));
  vi.clearAllMocks();
  completeHabit.mockResolvedValue("marker");
  mockUseData.mockReturnValue({
    completeHabit,
    undoCompleteHabit,
    updateHabit,
    deleteHabit: vi.fn(),
    currentTime: Date.now(),
    isSyncing: false,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("HabitMatrix", () => {
  it("renders the last seven days as columns", () => {
    const { container } = renderMatrix([makeHabit()]);
    const today = startOfLocalDay(new Date());

    for (let offset = 0; offset > -7; offset -= 1) {
      expect(findCell(container, localDateKey(addDays(today, offset)))).toBeTruthy();
    }
  });

  it("backfills a missed past day with a noon-UTC timestamp", () => {
    const { container } = renderMatrix([makeHabit()]);
    const yesterday = addDays(startOfLocalDay(new Date()), -1);

    const cell = findCell(container, localDateKey(yesterday));
    expect(cell.getAttribute("title")).toContain("missed");
    fireEvent.click(cell);

    expect(completeHabit).toHaveBeenCalledWith("h1", backfillTimestampForDay(yesterday));
  });

  it("undoes a completed day using its stored marker", () => {
    const yesterday = addDays(startOfLocalDay(new Date()), -1);
    const marker = localDateKey(yesterday);
    const { container } = renderMatrix([makeHabit({ completedDates: [marker] })]);

    const cell = findCell(container, marker);
    expect(cell.getAttribute("title")).toContain("completed");
    fireEvent.click(cell);

    expect(undoCompleteHabit).toHaveBeenCalledWith("h1", marker);
  });

  it("removes the skip occurrence when a skipped day is tapped", () => {
    const yesterday = addDays(startOfLocalDay(new Date()), -1);
    const skipTimestamp = localDateKey(yesterday);
    const { container } = renderMatrix([
      makeHabit({ occurrences: [{ timestamp: skipTimestamp, status: "skipped" }] }),
    ]);

    const cell = findCell(container, skipTimestamp);
    expect(cell.getAttribute("title")).toContain("skipped");
    fireEvent.click(cell);

    expect(updateHabit).toHaveBeenCalledWith("h1", { occurrences: [] });
  });

  it("disables days from before the habit existed", () => {
    const today = startOfLocalDay(new Date());
    const createdAt = addDays(today, -2);
    const beforeStart = addDays(today, -4);
    const { container } = renderMatrix([makeHabit({ createdAt: createdAt.toISOString() })]);

    const cell = findCell(container, localDateKey(beforeStart));
    expect(cell.getAttribute("title")).toContain("before-start");
    expect((cell as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(cell);

    expect(completeHabit).not.toHaveBeenCalled();
  });

  it("opens a slot popover for hourly habits instead of toggling directly", () => {
    const habit = makeHabit({
      frequency: "hourly",
      hourlyInterval: 6,
      activeHours: { start: "00:00", end: "23:59" },
    });
    const yesterday = addDays(startOfLocalDay(new Date()), -1);
    const { container, baseElement } = renderMatrix([habit]);

    const cell = findCell(container, localDateKey(yesterday));
    fireEvent.click(cell);

    expect(completeHabit).not.toHaveBeenCalled();
    expect(baseElement.textContent).toContain("Mark");
  });
});
