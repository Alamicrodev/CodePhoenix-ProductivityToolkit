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
    addTask: vi.fn().mockResolvedValue(true),
    updateTask: vi.fn().mockResolvedValue(true),
    deleteTask: vi.fn().mockResolvedValue(true),
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
    expect(screen.getByText("0 active · 0 done")).toBeInTheDocument();
    expect(screen.getByText("No active tasks found")).toBeInTheDocument();
  });

  it("lists active tasks with their count", () => {
    mockUseData.mockReturnValue(dataValue([BASE_TASK]));
    renderTasksPage();
    expect(screen.getByText("1 active · 0 done")).toBeInTheDocument();
    expect(screen.getByText("Active · 1")).toBeInTheDocument();
    expect(screen.getByText("Write report")).toBeInTheDocument();
  });

  it("moves completed tasks into the collapsed completed section", () => {
    mockUseData.mockReturnValue(
      dataValue([{ ...BASE_TASK, id: "t2", completed: true, title: "Done task" }]),
    );
    renderTasksPage();
    expect(screen.getByText("0 active · 1 done")).toBeInTheDocument();
    expect(screen.getByText("Completed · 1")).toBeInTheDocument();
    // collapsed by default: the task itself is not visible
    expect(screen.queryByText("Done task")).not.toBeInTheDocument();
  });

  it("expands the completed section on click", async () => {
    const user = userEvent.setup();
    mockUseData.mockReturnValue(
      dataValue([{ ...BASE_TASK, id: "t2", completed: true, title: "Done task" }]),
    );
    renderTasksPage();
    await user.click(screen.getByText("Completed · 1"));
    expect(screen.getByText("Done task")).toBeInTheDocument();
  });

  it("creates a task from the quick-add row with parsed tokens", async () => {
    const user = userEvent.setup();
    const data = dataValue([]);
    mockUseData.mockReturnValue(data);
    renderTasksPage();

    const input = screen.getByLabelText("Quick add task");
    await user.type(input, "pay rent tomorrow !high{Enter}");

    expect(data.addTask).toHaveBeenCalledTimes(1);
    const created = data.addTask.mock.calls[0][0];
    expect(created.title).toBe("Pay rent");
    expect(created.priority).toBe("high");
    expect(created.quadrant).toBe("urgent-important");
    expect(created.dueDate).not.toBeNull();
    // field cleared for the next entry
    expect(input).toHaveValue("");
  });

  it("shows subtask progress and expands subtasks on toggle", async () => {
    const user = userEvent.setup();
    const withSubtasks = {
      ...BASE_TASK,
      subtasks: [
        { id: "s1", title: "Draft outline", completed: true, priority: "medium" as const, dueDate: null, dueTime: null },
        { id: "s2", title: "Polish intro", completed: false, priority: "low" as const, dueDate: null, dueTime: null },
      ],
    };
    mockUseData.mockReturnValue(dataValue([withSubtasks]));
    renderTasksPage();

    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.queryByText("Draft outline")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Toggle subtasks for Write report" }));
    expect(screen.getByText("Draft outline")).toBeInTheDocument();
    expect(screen.getByText("Polish intro")).toBeInTheDocument();
  });

  it("filters by priority chips and offers Clear Filters in the empty state", async () => {
    const user = userEvent.setup();
    mockUseData.mockReturnValue(dataValue([{ ...BASE_TASK, priority: "medium" as const }]));
    renderTasksPage();

    await user.click(screen.getByRole("button", { name: /High/ }));
    expect(screen.getByText("No tasks match the high priority filter")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear Filters" }));
    expect(screen.getByText("Write report")).toBeInTheDocument();
  });
});
