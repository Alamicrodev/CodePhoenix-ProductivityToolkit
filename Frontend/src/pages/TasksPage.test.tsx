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

function dataValue(tasks: unknown[], focusSessions: unknown[] = []) {
  return {
    tasks,
    habits: [],
    focusSessions,
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
  const router = createMemoryRouter(
    [
      { path: "/tasks", element: <TasksPage /> },
      { path: "/focus", element: <div>Focus page stub</div> },
    ],
    { initialEntries: ["/tasks"] },
  );
  // The shell owns ⌘K and the palette, so pages need the provider around them.
  return render(
    <PaletteProvider>
      <RouterProvider router={router} />
    </PaletteProvider>,
  );
}

beforeEach(() => {
  // view/filter state persists to localStorage; isolate tests from each other
  window.localStorage.clear();
  // cmdk scrolls the selected item into view; jsdom has no implementation
  Element.prototype.scrollIntoView = vi.fn();
  // Radix Select uses the pointer-capture API, which jsdom lacks
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
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
    // Empty states are one muted line naming the shortcut — no card, no icon,
    // no second primary button.
    expect(screen.getByText("Press C to add your first task.")).toBeInTheDocument();
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

  it("focuses quick-add on C and toggles the view on V", async () => {
    const user = userEvent.setup();
    mockUseData.mockReturnValue(dataValue([BASE_TASK]));
    renderTasksPage();

    await user.keyboard("c");
    await vi.waitFor(() => {
      expect(screen.getByLabelText("Quick add task")).toHaveFocus();
    });

    // typing in the input must not trigger shortcuts
    await user.keyboard("v");
    expect(screen.getByLabelText("Quick add task")).toHaveValue("v");

    await user.keyboard("{Escape}");
    await user.keyboard("v");
    expect(screen.getByText("Do first")).toBeInTheDocument();

    await user.keyboard("v");
    expect(screen.getByLabelText("Quick add task")).toBeInTheDocument();
  });

  it("opens the command palette with Ctrl+K and switches views from it", async () => {
    const user = userEvent.setup();
    mockUseData.mockReturnValue(dataValue([BASE_TASK]));
    renderTasksPage();

    await user.keyboard("{Control>}k{/Control}");
    expect(screen.getByPlaceholderText("Type a command or search tasks…")).toBeInTheDocument();

    await user.click(screen.getByText("Switch to matrix view"));
    expect(screen.getByText("Do first")).toBeInTheDocument();
  });

  it("groups tasks into their matrix quadrants with inline add rows", async () => {
    const user = userEvent.setup();
    const data = dataValue([
      { ...BASE_TASK, id: "q1", title: "Urgent thing", quadrant: "urgent-important" },
      { ...BASE_TASK, id: "q2", title: "Someday thing", quadrant: "not-urgent-not-important" },
      { ...BASE_TASK, id: "q3", title: "Unfiled thing", quadrant: null },
    ]);
    mockUseData.mockReturnValue(data);
    renderTasksPage();

    await user.keyboard("v");
    expect(screen.getByText("Urgent thing")).toBeInTheDocument();
    expect(screen.getByText("Someday thing")).toBeInTheDocument();
    expect(screen.getByText("Uncategorized · 1")).toBeInTheDocument();

    // inline add pre-files the task into the quadrant
    await user.click(screen.getByRole("button", { name: /Add to Schedule/ }));
    await user.type(screen.getByLabelText("Add task to Schedule"), "book flights !low{Enter}");
    expect(data.addTask).toHaveBeenCalledTimes(1);
    const created = data.addTask.mock.calls[0][0];
    expect(created.title).toBe("Book flights");
    expect(created.priority).toBe("low");
    expect(created.quadrant).toBe("not-urgent-important");
  });

  it("jumps to a task from the palette search", async () => {
    const user = userEvent.setup();
    mockUseData.mockReturnValue(dataValue([BASE_TASK]));
    renderTasksPage();

    await user.keyboard("{Control>}k{/Control}");
    await user.type(screen.getByPlaceholderText("Type a command or search tasks…"), "Write rep");
    await user.click(screen.getByText("Write report", { selector: "[cmdk-item] span" }));

    expect(screen.getByRole("heading", { name: /edit task/i })).toBeInTheDocument();
  });

  it("creates tagged tasks from quick-add and filters by tag", async () => {
    const user = userEvent.setup();
    const data = dataValue([
      { ...BASE_TASK, id: "t1", title: "Pay rent", tags: ["bills"] },
      { ...BASE_TASK, id: "t2", title: "Walk the dog", tags: [] },
    ]);
    mockUseData.mockReturnValue(data);
    renderTasksPage();

    // chips render on the row
    expect(screen.getByText("#bills")).toBeInTheDocument();

    // quick-add parses the tag token
    await user.type(screen.getByLabelText("Quick add task"), "file taxes #bills{Enter}");
    expect(data.addTask.mock.calls[0][0].tags).toEqual(["bills"]);

    // tag select filters the list
    const tagTrigger = screen.getAllByRole("combobox")[0];
    await user.click(tagTrigger);
    await user.click(screen.getByRole("option", { name: "#bills" }));
    expect(screen.getByText("Pay rent")).toBeInTheDocument();
    expect(screen.queryByText("Walk the dog")).not.toBeInTheDocument();
  });

  it("navigates to the focus page from the row action", async () => {
    const user = userEvent.setup();
    mockUseData.mockReturnValue(dataValue([BASE_TASK]));
    renderTasksPage();

    await user.click(
      screen.getByRole("button", { name: "Start focus session with: Write report" }),
    );
    expect(screen.getByText("Focus page stub")).toBeInTheDocument();
  });

  it("starts a focus session from the palette's pick-a-task page", async () => {
    const user = userEvent.setup();
    mockUseData.mockReturnValue(dataValue([BASE_TASK]));
    renderTasksPage();

    await user.keyboard("{Control>}k{/Control}");
    await user.click(screen.getByText("Start focus session with…"));
    await user.click(screen.getByText("Write report", { selector: "[cmdk-item] span" }));
    expect(screen.getByText("Focus page stub")).toBeInTheDocument();
  });

  it("marks tasks held by an active focus session", () => {
    const activeSession = {
      id: "s1",
      status: "active",
      items: [
        {
          id: "i1",
          sourceId: "t1",
          sourceType: "task",
          title: "Write report",
          addedAt: "2026-07-31T10:00:00Z",
          completedInSessionAt: null,
        },
      ],
    };
    mockUseData.mockReturnValue(dataValue([BASE_TASK], [activeSession]));
    renderTasksPage();

    expect(screen.getByText("In a focus session")).toBeInTheDocument();
    // the row action is hidden for tasks already in focus
    expect(
      screen.queryByRole("button", { name: "Start focus session with: Write report" }),
    ).not.toBeInTheDocument();
  });

  it("persists the selected view across remounts", async () => {
    const user = userEvent.setup();
    mockUseData.mockReturnValue(dataValue([BASE_TASK]));
    const { unmount } = renderTasksPage();

    await user.keyboard("v");
    expect(screen.getByText("Do first")).toBeInTheDocument();
    unmount();

    renderTasksPage();
    expect(screen.getByText("Do first")).toBeInTheDocument();
    expect(screen.queryByLabelText("Quick add task")).not.toBeInTheDocument();
  });

  it("filters by priority chips and offers Clear filters in the empty state", async () => {
    const user = userEvent.setup();
    mockUseData.mockReturnValue(dataValue([{ ...BASE_TASK, priority: "medium" as const }]));
    renderTasksPage();

    await user.click(screen.getByRole("button", { name: /High/ }));
    expect(screen.getByText(/No tasks match the high priority filter/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("Write report")).toBeInTheDocument();
  });
});
