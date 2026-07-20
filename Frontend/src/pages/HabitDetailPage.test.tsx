import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockUseAuth, mockUseData } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseData: vi.fn(),
}));
vi.mock("../context/AuthContext", () => ({ useAuth: mockUseAuth }));
vi.mock("../context/DataContext", () => ({ useData: mockUseData }));

import HabitDetailPage from "./HabitDetailPage";
import type { Habit } from "../context/DataContext";

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "h1",
    createdAt: "2026-06-20T00:00:00Z",
    title: "Evening walk",
    description: "A calm stroll",
    frequency: "daily",
    activeDays: [],
    streak: 3,
    lastCompleted: null,
    completedDates: ["2026-06-25", "2026-06-26"],
    occurrences: [],
    ...overrides,
  };
}

const deleteHabit = vi.fn().mockResolvedValue(undefined);

function dataValue(habits: Habit[], overrides: Record<string, unknown> = {}) {
  return {
    habits,
    tasks: [],
    focusSessions: [],
    completeHabit: vi.fn().mockResolvedValue("marker"),
    undoCompleteHabit: vi.fn(),
    updateHabit: vi.fn(),
    deleteHabit,
    addHabit: vi.fn(),
    currentTime: Date.now(),
    isSyncing: false,
    isWorkspaceLoading: false,
    syncStatus: null,
    ...overrides,
  };
}

function renderDetailPage() {
  const router = createMemoryRouter(
    [
      { path: "/habits", element: <div>Habits list page</div> },
      { path: "/habits/:habitId", element: <HabitDetailPage /> },
    ],
    { initialEntries: ["/habits/h1"] },
  );
  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  deleteHabit.mockResolvedValue(undefined);
  mockUseAuth.mockReturnValue({
    user: { id: "u1", email: "user@example.com", name: "Test User" },
    accessToken: "tok-1",
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  });
});

describe("HabitDetailPage", () => {
  it("renders every analytics section for an existing habit", () => {
    mockUseData.mockReturnValue(dataValue([makeHabit()]));
    renderDetailPage();

    expect(screen.getByRole("heading", { name: "Evening walk" })).toBeInTheDocument();
    expect(screen.getAllByText("Habit Strength").length).toBeGreaterThan(0);
    expect(screen.getByText("Current Streak")).toBeInTheDocument();
    expect(screen.getByText("Total Completions")).toBeInTheDocument();
    expect(screen.getByText("Calendar")).toBeInTheDocument();
    expect(screen.getByText("History")).toBeInTheDocument();
    expect(screen.getByText("Best Streaks")).toBeInTheDocument();
    expect(screen.getByText("Frequency")).toBeInTheDocument();
  });

  it("shows a not-found state for unknown habit ids", () => {
    mockUseData.mockReturnValue(dataValue([]));
    renderDetailPage();

    expect(screen.getByText("Habit not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Habits" })).toBeInTheDocument();
  });

  it("shows skeletons while the workspace is still loading", () => {
    mockUseData.mockReturnValue(dataValue([], { isWorkspaceLoading: true }));
    const { container } = renderDetailPage();

    expect(screen.queryByText("Habit not found")).not.toBeInTheDocument();
    expect(container.querySelector('[data-slot="skeleton"], .animate-pulse')).toBeTruthy();
  });

  it("deletes the habit and navigates back to the list", async () => {
    const user = userEvent.setup();
    mockUseData.mockReturnValue(dataValue([makeHabit()]));
    renderDetailPage();

    const menuTriggers = screen.getAllByRole("button");
    const menuTrigger = menuTriggers.find(button => button.querySelector("svg.lucide-ellipsis-vertical"));
    expect(menuTrigger).toBeTruthy();
    await user.click(menuTrigger!);

    await user.click(await screen.findByText("Delete Habit"));
    await user.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteHabit).toHaveBeenCalledWith("h1"));
    expect(await screen.findByText("Habits list page")).toBeInTheDocument();
  });
});
