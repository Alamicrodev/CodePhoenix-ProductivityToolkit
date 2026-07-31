import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockUseData } = vi.hoisted(() => ({ mockUseData: vi.fn() }));
vi.mock("../context/DataContext", () => ({ useData: mockUseData }));

import { TaskModal } from "./TaskModal";

const TASK = {
  id: "t1",
  title: "Review roadmap",
  description: "Q3 draft",
  completed: false,
  completedAt: null,
  priority: "high" as const,
  dueDate: null,
  dueTime: null,
  tags: ["project"],
  quadrant: "urgent-important" as const,
  subtasks: [
    {
      id: "s1",
      title: "Collect feedback",
      completed: true,
      priority: "medium" as const,
      dueDate: null,
      dueTime: null,
    },
  ],
};

function dataValue() {
  return {
    addTask: vi.fn().mockResolvedValue(true),
    updateTask: vi.fn().mockResolvedValue(true),
    deleteTask: vi.fn().mockResolvedValue(true),
    isSyncing: false,
  };
}

let data: ReturnType<typeof dataValue>;

beforeEach(() => {
  data = dataValue();
  mockUseData.mockReturnValue(data);
});

describe("TaskModal", () => {
  it("creates a task with the quadrant derived from the chosen priority", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<TaskModal isOpen onClose={onClose} />);

    expect(screen.getByRole("heading", { name: /new task/i })).toBeInTheDocument();
    // save is a no-op until a title exists
    expect(screen.getByRole("button", { name: /create task/i })).toBeDisabled();

    await user.type(screen.getByPlaceholderText("Task title"), "Ship the editor");
    await user.click(screen.getByRole("button", { name: /medium/i }));
    await user.click(screen.getByRole("menuitem", { name: /high/i }));
    await user.click(screen.getByRole("button", { name: /create task/i }));

    expect(data.addTask).toHaveBeenCalledTimes(1);
    const created = data.addTask.mock.calls[0][0];
    expect(created.title).toBe("Ship the editor");
    expect(created.priority).toBe("high");
    expect(created.quadrant).toBe("urgent-important");
    expect(created.completed).toBe(false);
    expect(onClose).toHaveBeenCalled();
  });

  it("prefills create mode from a quick-add seed", () => {
    render(
      <TaskModal
        isOpen
        onClose={vi.fn()}
        seed={{ title: "Pay rent", priority: "high", dueDate: null, tags: ["bills"] }}
      />,
    );

    expect(screen.getByPlaceholderText("Task title")).toHaveValue("Pay rent");
    expect(screen.getByRole("button", { name: /high/i })).toBeInTheDocument();
    expect(screen.getByText("#bills")).toBeInTheDocument();
  });

  it("edits on a draft: adds a subtask, drops empty titles, saves via the primary button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<TaskModal isOpen onClose={onClose} task={TASK} />);

    expect(screen.getByRole("heading", { name: /edit task/i })).toBeInTheDocument();
    expect(screen.getByText("1/1")).toBeInTheDocument();

    const addSubtask = screen.getByPlaceholderText(/Add a subtask/);
    await user.type(addSubtask, "Annotate questions{Enter}");
    // input clears and stays available for the next entry
    expect(addSubtask).toHaveValue("");
    expect(screen.getByText("1/2")).toBeInTheDocument();

    // blank out the first subtask's title: it must be dropped on save
    await user.clear(screen.getAllByLabelText("Subtask title")[0]);
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(data.updateTask).toHaveBeenCalledTimes(1);
    const [id, fields] = data.updateTask.mock.calls[0];
    expect(id).toBe("t1");
    expect(fields.subtasks).toHaveLength(1);
    expect(fields.subtasks[0].title).toBe("Annotate questions");
    expect(onClose).toHaveBeenCalled();
  });

  it("sets a due date from the chip popover", async () => {
    const user = userEvent.setup();
    render(<TaskModal isOpen onClose={vi.fn()} task={TASK} />);

    await user.click(screen.getByRole("button", { name: /due date/i }));
    await user.click(screen.getByRole("menuitem", { name: "Tomorrow" }));

    expect(screen.getByText("Tomorrow")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(data.updateTask.mock.calls[0][1].dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("adds tags from the tag popover, normalized and deduped, staying open", async () => {
    const user = userEvent.setup();
    render(<TaskModal isOpen onClose={vi.fn()} task={TASK} />);

    await user.click(screen.getByRole("button", { name: "+ Tag" }));
    const input = screen.getByLabelText("Add tag");
    await user.type(input, "#Design{Enter}");
    expect(screen.getByText("#design")).toBeInTheDocument();
    // stays open for the next tag; duplicate is a no-op
    await user.type(input, "project{Enter}");

    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(data.updateTask.mock.calls[0][1].tags).toEqual(["project", "design"]);
  });

  it("Escape closes an open popover first, then the modal; ⌘↵ saves", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<TaskModal isOpen onClose={onClose} task={TASK} />);

    await user.click(screen.getByRole("button", { name: /due date/i }));
    expect(screen.getByRole("menuitem", { name: "Today" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menuitem", { name: "Today" })).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(data.updateTask).toHaveBeenCalledTimes(1);
  });

  it("deletes immediately from the footer in edit mode", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<TaskModal isOpen onClose={onClose} task={TASK} />);

    await user.click(screen.getByRole("button", { name: "Delete task" }));
    expect(data.deleteTask).toHaveBeenCalledWith("t1");
    expect(onClose).toHaveBeenCalled();
  });

  it("hides the delete button in create mode", () => {
    render(<TaskModal isOpen onClose={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Delete task" })).not.toBeInTheDocument();
  });
});
