import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router";
import { PaletteProvider } from "../context/PaletteContext";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockUseAuth, mockUseData } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseData: vi.fn(),
}));
vi.mock("../context/AuthContext", () => ({ useAuth: mockUseAuth }));
vi.mock("../context/DataContext", () => ({ useData: mockUseData }));

import HabitsPage from "./HabitsPage";
import type { Habit } from "../context/DataContext";

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

const completeHabit = vi.fn().mockResolvedValue("marker");
const undoCompleteHabit = vi.fn().mockResolvedValue(undefined);

function dataValue(habits: Habit[]) {
  return {
    tasks: [],
    habits,
    focusSessions: [],
    currentTime: new Date("2026-07-03T12:00:00Z").getTime(),
    addHabit: vi.fn().mockResolvedValue(true),
    updateHabit: vi.fn().mockResolvedValue(true),
    deleteHabit: vi.fn(),
    completeHabit,
    undoCompleteHabit,
  };
}

function renderHabitsPage(habits: Habit[]) {
  mockUseData.mockReturnValue(dataValue(habits));
  const router = createMemoryRouter(
    [
      { path: "/habits", element: <HabitsPage /> },
      { path: "/habits/:habitId", element: <div>Habit detail stub</div> },
    ],
    { initialEntries: ["/habits"] },
  );
  return render(
    <PaletteProvider>
      <RouterProvider router={router} />
    </PaletteProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  vi.clearAllMocks();
  completeHabit.mockResolvedValue("marker");
  mockUseAuth.mockReturnValue({
    user: { id: "u1", email: "user@example.com", name: "Test User" },
    accessToken: "tok-1",
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  });
});

describe("HabitsPage — the list view is gone", () => {
  it("renders the matrix with no view switcher", () => {
    const { container } = renderHabitsPage([makeHabit()]);

    expect(container.querySelector('[title$=" - pending"]')).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Habits view" })).not.toBeInTheDocument();
  });

  it("shows the one-line empty state, hoisted out of the deleted list arm", () => {
    renderHabitsPage([]);
    expect(screen.getByText("Press C to add your first habit.")).toBeInTheDocument();
  });

  it("ignores a stale habits.viewMode key left by the old segmented control", () => {
    window.localStorage.setItem("habits.viewMode", '"list"');
    const { container } = renderHabitsPage([makeHabit()]);
    expect(container.querySelector('[title$=" - pending"]')).toBeInTheDocument();
  });

  it("no longer advertises or binds the view switch", async () => {
    const user = userEvent.setup();
    const { container } = renderHabitsPage([makeHabit()]);

    expect(screen.queryByText("switch view")).not.toBeInTheDocument();
    await user.keyboard("v");
    // V is inert now — the matrix is still the only thing rendered.
    expect(container.querySelector('[title$=" - pending"]')).toBeInTheDocument();
  });
});

describe("HabitsPage — creation paths", () => {
  it("C focuses the quick-add, and typing there does not fire page shortcuts", async () => {
    const user = userEvent.setup();
    renderHabitsPage([makeHabit()]);

    await user.keyboard("c");
    const quickAdd = screen.getByLabelText("Quick add habit");
    expect(quickAdd).toHaveFocus();

    await user.keyboard("v");
    expect(quickAdd).toHaveValue("v");
  });

  it("⌘↵ in the quick-add opens the full editor seeded from the draft", async () => {
    const user = userEvent.setup();
    renderHabitsPage([]);

    await user.type(screen.getByLabelText("Quick add habit"), "meditate 10m every weekday");
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "New habit" })).toBeInTheDocument();
    expect(screen.getByLabelText("Habit title")).toHaveValue("Meditate 10m");
    expect(screen.getByLabelText("Quick add habit")).toHaveValue("");
  });

  it("offers both creation entries in the palette and no view switch", async () => {
    const user = userEvent.setup();
    renderHabitsPage([makeHabit()]);

    await user.keyboard("{Control>}k{/Control}");
    expect(await screen.findByText("New habit")).toBeInTheDocument();
    expect(screen.getByText("New habit in full editor")).toBeInTheDocument();
    expect(screen.queryByText(/Switch to (matrix|list)/)).not.toBeInTheDocument();
  });
});

describe("HabitsPage — check-in shortcut", () => {
  it("1-9 checks in against matrix order", async () => {
    const user = userEvent.setup();
    renderHabitsPage([
      makeHabit({ id: "h1", title: "Evening walk" }),
      makeHabit({ id: "h2", title: "Read" }),
    ]);

    await user.keyboard("2");
    expect(completeHabit).toHaveBeenCalledWith("h2");
  });

  it("does not fire while the full editor owns the keyboard", async () => {
    const user = userEvent.setup();
    renderHabitsPage([makeHabit({ id: "h1" })]);

    await user.type(screen.getByLabelText("Quick add habit"), "Stretch");
    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("1");
    expect(completeHabit).not.toHaveBeenCalled();
  });
});
