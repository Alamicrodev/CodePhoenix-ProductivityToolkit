import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockUseData } = vi.hoisted(() => ({ mockUseData: vi.fn() }));
vi.mock("../context/DataContext", () => ({ useData: mockUseData }));

import { HabitCard } from "./HabitCard";
import type { Habit } from "../context/DataContext";

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "h1",
    createdAt: "2026-07-01T09:00:00Z",
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

function boxTitles(container: HTMLElement) {
  return [...container.querySelectorAll("[title]")]
    .map(el => el.getAttribute("title") ?? "")
    .filter(title => / - (completed|skipped|missed|pending)$/.test(title));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-03T12:00:00Z"));
  mockUseData.mockReturnValue({
    completeHabit: vi.fn(),
    undoCompleteHabit: vi.fn(),
    deleteHabit: vi.fn(),
    updateHabit: vi.fn(),
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("HabitCard heatmap", () => {
  it("does not render days from before the habit was created", () => {
    // habit created two days ago -> creation day, yesterday, today; NOT a
    // 30-day wall of "missed" boxes predating the habit's existence
    const { container } = render(<HabitCard habit={makeHabit()} />);
    const titles = boxTitles(container);
    expect(titles).toHaveLength(3);
    expect(titles.filter(title => title.endsWith("missed"))).toHaveLength(2);
    expect(titles.filter(title => title.endsWith("pending"))).toHaveLength(1);
  });

  it("shows today as pending, not missed, while the day is still running", () => {
    const { container } = render(<HabitCard habit={makeHabit()} />);
    const titles = boxTitles(container);
    expect(titles[titles.length - 1].endsWith("pending")).toBe(true);
  });

  it("renders the full 30-day window for habits older than the window", () => {
    const { container } = render(
      <HabitCard habit={makeHabit({ createdAt: "2026-05-01T00:00:00Z" })} />,
    );
    expect(boxTitles(container)).toHaveLength(30);
  });
});
