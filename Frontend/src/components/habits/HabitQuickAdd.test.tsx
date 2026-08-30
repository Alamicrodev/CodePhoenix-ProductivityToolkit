import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockUseData } = vi.hoisted(() => ({ mockUseData: vi.fn() }));
vi.mock("../../context/DataContext", () => ({ useData: mockUseData }));

import { HabitQuickAdd } from "./HabitQuickAdd";

const addHabit = vi.fn().mockResolvedValue(true);

beforeEach(() => {
  vi.clearAllMocks();
  addHabit.mockResolvedValue(true);
  mockUseData.mockReturnValue({ addHabit });
});

/**
 * These three cases are the create-mode conditions made executable.
 * The create-mode HabitModal is only legal while they hold, so
 * a failure here is a design-system violation, not a cosmetic regression.
 */
describe("HabitQuickAdd — the create-mode conditions", () => {
  it("(b) plain Enter creates inline, clears, and keeps focus", async () => {
    const user = userEvent.setup();
    render(<HabitQuickAdd onOpenFull={vi.fn()} />);

    const input = screen.getByLabelText("Quick add habit");
    await user.type(input, "Evening walk{Enter}");

    expect(addHabit).toHaveBeenCalledTimes(1);
    expect(addHabit.mock.calls[0][0]).toMatchObject({ title: "Evening walk", frequency: "daily" });
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
  });

  it("(c) the hint reads the exact required string", () => {
    render(<HabitQuickAdd onOpenFull={vi.fn()} />);
    // CMD_LABEL resolves per platform, so match around it.
    expect(screen.getByText(/↵ add ·.*↵ full editor/)).toBeInTheDocument();
  });

  it("(a) ⌘↵ hands the parsed draft to the full editor without creating", async () => {
    const user = userEvent.setup();
    const onOpenFull = vi.fn();
    render(<HabitQuickAdd onOpenFull={onOpenFull} />);

    const input = screen.getByLabelText("Quick add habit");
    await user.type(input, "meditate 10m every weekday");
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(onOpenFull).toHaveBeenCalledWith({
      title: "Meditate 10m",
      frequency: "daily",
      activeDays: [1, 2, 3, 4, 5],
    });
    expect(addHabit).not.toHaveBeenCalled();
    expect(input).toHaveValue("");
  });
});

describe("HabitQuickAdd — other behaviour", () => {
  it("ignores an empty or whitespace-only draft", async () => {
    const user = userEvent.setup();
    render(<HabitQuickAdd onOpenFull={vi.fn()} />);

    await user.type(screen.getByLabelText("Quick add habit"), "   {Enter}");
    expect(addHabit).not.toHaveBeenCalled();
  });

  it("Escape blurs the field", async () => {
    const user = userEvent.setup();
    render(<HabitQuickAdd onOpenFull={vi.fn()} />);

    const input = screen.getByLabelText("Quick add habit");
    await user.click(input);
    expect(input).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(input).not.toHaveFocus();
  });
});
