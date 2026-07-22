import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockUseAuth, mockUseData } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseData: vi.fn(),
}));
vi.mock("../context/AuthContext", () => ({ useAuth: mockUseAuth }));
vi.mock("../context/DataContext", () => ({ useData: mockUseData }));

import TasksPage from "./TasksPage";

const BASE_TASK = {
  id: "t1",
  title: "Write report",
  description: "",
  completed: false,
  completedAt: null,
  priority: "high" as const,
  dueDate: null,
  dueTime: null,
  tags: [],
  quadrant: null,
  subtasks: [],
};

function dataValue(tasks: unknown[]) {
  return {
    tasks,
    habits: [],
    focusSessions: [],
    isWorkspaceLoading: false,
    isSyncing: false,
    syncStatus: null,
    addTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    addHabit: vi.fn(),
    updateHabit: vi.fn(),
    deleteHabit: vi.fn(),
    completeHabit: vi.fn(),
    undoCompleteHabit: vi.fn(),
    createFocusSession: vi.fn(),
    pauseFocusSession: vi.fn(),
    resumeFocusSession: vi.fn(),
    completeFocusSession: vi.fn(),
    quitFocusSession: vi.fn(),
    markFocusSessionItemComplete: vi.fn(),
  };
}

function renderTasksPage() {
  const router = createMemoryRouter([{ path: "/tasks", element: <TasksPage /> }], {
    initialEntries: ["/tasks"],
  });
  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  window.localStorage.clear();
  mockUseAuth.mockReturnValue({
    user: { id: "u1", email: "user@example.com", name: "Test User" },
    accessToken: "tok-1",
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  });
});

describe("TasksPage", () => {
  it("shows zero counts and the always-visible quick-add when there are no tasks", () => {
    mockUseData.mockReturnValue(dataValue([]));
    renderTasksPage();
    expect(screen.getByText("0 active · 0 done")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Add a task/)).toBeInTheDocument();
    expect(screen.getByText(/No active tasks/)).toBeInTheDocument();
  });

  it("lists active tasks with header counts", () => {
    mockUseData.mockReturnValue(dataValue([BASE_TASK]));
    renderTasksPage();
    expect(screen.getByText("1 active · 0 done")).toBeInTheDocument();
    expect(screen.getByText("Write report")).toBeInTheDocument();
    expect(screen.getByText("Active · 1")).toBeInTheDocument();
  });

  it("shows completed tasks in the completed section and collapses it on toggle", async () => {
    const user = userEvent.setup();
    mockUseData.mockReturnValue(
      dataValue([
        {
          ...BASE_TASK,
          id: "t2",
          completed: true,
          completedAt: "2026-07-21T18:20:00Z",
          title: "Done task",
        },
      ]),
    );
    renderTasksPage();
    expect(screen.getByText("0 active · 1 done")).toBeInTheDocument();
    // open by default per the redesign prototype
    expect(screen.getByText("Done task")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Completed · 1/ }));
    expect(screen.queryByText("Done task")).not.toBeInTheDocument();
  });

  it("creates a task from quick-add with parsed priority, due date, and quadrant", async () => {
    const user = userEvent.setup();
    const data = dataValue([]);
    mockUseData.mockReturnValue(data);
    renderTasksPage();

    const input = screen.getByPlaceholderText(/Add a task/);
    await user.type(input, "pay rent tomorrow !high{Enter}");

    expect(data.addTask).toHaveBeenCalledTimes(1);
    expect(data.addTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Pay rent",
        priority: "high",
        quadrant: "urgent-important",
        dueDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      }),
    );
    // input clears and stays mounted for rapid consecutive entry
    expect(input).toHaveValue("");
  });

  it("filters the active list by priority chip", async () => {
    const user = userEvent.setup();
    mockUseData.mockReturnValue(
      dataValue([
        BASE_TASK,
        { ...BASE_TASK, id: "t3", title: "Low chore", priority: "low" as const },
      ]),
    );
    renderTasksPage();

    await user.click(screen.getByRole("button", { name: /^Low/ }));
    expect(screen.getByText("Low chore")).toBeInTheDocument();
    expect(screen.queryByText("Write report")).not.toBeInTheDocument();
  });

  it("marks a task done via its checkbox", async () => {
    const user = userEvent.setup();
    const data = dataValue([BASE_TASK]);
    mockUseData.mockReturnValue(data);
    renderTasksPage();

    await user.click(screen.getByRole("checkbox", { name: /Mark done "Write report"/ }));
    expect(data.updateTask).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({ completed: true }),
    );
  });

  it("opens the command palette with Ctrl+K and switches to matrix view", async () => {
    const user = userEvent.setup();
    mockUseData.mockReturnValue(dataValue([]));
    renderTasksPage();

    await user.keyboard("{Control>}k{/Control}");
    expect(screen.getByPlaceholderText(/Type a command/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Switch to matrix view/ }));
    expect(screen.queryByPlaceholderText(/Type a command/)).not.toBeInTheDocument();
    expect(screen.getByText("Do first")).toBeInTheDocument();
    expect(screen.getByText("Eliminate")).toBeInTheDocument();
  });

  it("toggles between list and matrix with the V shortcut", async () => {
    const user = userEvent.setup();
    mockUseData.mockReturnValue(dataValue([]));
    renderTasksPage();

    await user.keyboard("v");
    expect(screen.getByText("Urgent & important")).toBeInTheDocument();
    await user.keyboard("v");
    expect(screen.getByPlaceholderText(/Add a task/)).toBeInTheDocument();
  });
});
