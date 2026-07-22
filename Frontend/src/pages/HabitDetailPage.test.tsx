import { render, screen, waitFor, within } from "@testing-library/react";
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

const NOW = new Date(2026, 6, 22, 12, 0).getTime(); // Jul 22, 2026

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
    currentTime: NOW,
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
  it("renders the stat strip, calendar, and check-ins for an existing habit", () => {
    mockUseData.mockReturnValue(dataValue([makeHabit()]));
    renderDetailPage();

    expect(screen.getByText("Evening walk")).toBeInTheDocument();
    expect(screen.getByText("Habit strength")).toBeInTheDocument();
    expect(screen.getByText("Current streak")).toBeInTheDocument();
    expect(screen.getByText("Total check-ins")).toBeInTheDocument();
    expect(screen.getByText("July 2026")).toBeInTheDocument();
    expect(screen.getByText(/Recent check-ins/i)).toBeInTheDocument();
  });

  it("navigates months with the calendar arrows", async () => {
    const user = userEvent.setup();
    mockUseData.mockReturnValue(dataValue([makeHabit()]));
    renderDetailPage();

    await user.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByText("June 2026")).toBeInTheDocument();
  });

  it("shows a not-found state for unknown habit ids", () => {
    mockUseData.mockReturnValue(dataValue([]));
    renderDetailPage();

    expect(screen.getByText(/Habit not found/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Habits" })).toBeInTheDocument();
  });

  it("shows a loading line while the workspace is still loading", () => {
    mockUseData.mockReturnValue(dataValue([], { isWorkspaceLoading: true }));
    renderDetailPage();

    expect(screen.queryByText(/Habit not found/)).not.toBeInTheDocument();
    expect(screen.getByText("Loading habit…")).toBeInTheDocument();
  });

  it("deletes the habit and navigates back to the list", async () => {
    const user = userEvent.setup();
    mockUseData.mockReturnValue(dataValue([makeHabit()]));
    renderDetailPage();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteHabit).toHaveBeenCalledWith("h1"));
    expect(await screen.findByText("Habits list page")).toBeInTheDocument();
  });
});
