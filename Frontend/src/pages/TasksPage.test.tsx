import { render, screen } from "@testing-library/react";
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
  it("shows the empty state when there are no tasks", () => {
    mockUseData.mockReturnValue(dataValue([]));
    renderTasksPage();
    expect(screen.getByText("0 active tasks")).toBeInTheDocument();
    expect(screen.getByText("No active tasks found")).toBeInTheDocument();
  });

  it("lists active tasks with their count", () => {
    mockUseData.mockReturnValue(dataValue([BASE_TASK]));
    renderTasksPage();
    expect(screen.getByText("1 active task")).toBeInTheDocument();
    expect(screen.getByText("Write report")).toBeInTheDocument();
  });

  it("moves completed tasks into the collapsed completed section", () => {
    mockUseData.mockReturnValue(
      dataValue([{ ...BASE_TASK, id: "t2", completed: true, title: "Done task" }]),
    );
    renderTasksPage();
    expect(screen.getByText(/0 active tasks/)).toBeInTheDocument();
    expect(screen.getByText("Completed Tasks (1)")).toBeInTheDocument();
    // collapsed by default: the task itself is not visible
    expect(screen.queryByText("Done task")).not.toBeInTheDocument();
  });
});
