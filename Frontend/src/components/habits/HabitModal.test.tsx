import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockUseData } = vi.hoisted(() => ({ mockUseData: vi.fn() }));
vi.mock("../../context/DataContext", () => ({ useData: mockUseData }));

import { HabitModal } from "./HabitModal";
import type { Habit } from "../../context/DataContext";

const addHabit = vi.fn();
const updateHabit = vi.fn();

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "h1",
    title: "Drink water",
    description: "Two litres",
    frequency: "hourly",
    hourlyInterval: 2,
    activeHours: { start: "07:00", end: "22:00" },
    activeDays: [],
    streak: 3,
    lastCompleted: null,
    completedDates: [],
    occurrences: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // The modal only closes on a truthy save — a bare vi.fn() would look like failure.
  addHabit.mockResolvedValue(true);
  updateHabit.mockResolvedValue(true);
  mockUseData.mockReturnValue({ addHabit, updateHabit });
});

const days = () => within(screen.getByRole("group", { name: "Active days" })).getAllByRole("button");
const pressedDays = () => days().filter(d => d.getAttribute("aria-pressed") === "true");
const frequency = (label: string) =>
  within(screen.getByRole("group", { name: "Habit frequency" })).getByRole("button", { name: label });

describe("HabitModal — create", () => {
  it("cannot save without a title, then creates with the daily defaults", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<HabitModal isOpen onClose={onClose} />);

    const save = screen.getByRole("button", { name: /Create habit/ });
    expect(save).toBeDisabled();

    await user.type(screen.getByLabelText("Habit title"), "Morning stretch");
    expect(save).toBeEnabled();
    await user.click(save);

    await waitFor(() => expect(addHabit).toHaveBeenCalledTimes(1));
    expect(addHabit.mock.calls[0][0]).toMatchObject({
      title: "Morning stretch",
      description: "",
      frequency: "daily",
      // All seven days canonicalise to the wire's "every day".
      activeDays: [],
      streak: 0,
      lastCompleted: null,
      completedDates: [],
      occurrences: [],
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("prefills from a quick-add seed", () => {
    render(
      <HabitModal
        isOpen
        onClose={vi.fn()}
        seed={{ title: "Meditate 10m", frequency: "daily", activeDays: [1, 2, 3, 4, 5] }}
      />,
    );

    expect(screen.getByLabelText("Habit title")).toHaveValue("Meditate 10m");
    expect(pressedDays().map(d => d.getAttribute("aria-label"))).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
    ]);
  });

  it("always sends the schedule keys, so switching off hourly clears the stale ones", async () => {
    const user = userEvent.setup();
    render(<HabitModal isOpen onClose={vi.fn()} />);

    await user.type(screen.getByLabelText("Habit title"), "Read");
    await user.click(screen.getByRole("button", { name: /Create habit/ }));

    await waitFor(() => expect(addHabit).toHaveBeenCalled());
    const payload = addHabit.mock.calls[0][0];
    // Presence is what makes buildHabitUpdatePayload emit a clearing null.
    expect("hourlyInterval" in payload).toBe(true);
    expect("activeHours" in payload).toBe(true);
    expect(payload.hourlyInterval).toBeUndefined();
    expect(payload.activeHours).toBeUndefined();
  });

  it("refuses to deselect the last remaining day", async () => {
    const user = userEvent.setup();
    render(<HabitModal isOpen onClose={vi.fn()} />);

    expect(pressedDays()).toHaveLength(7);
    for (const day of days()) {
      await user.click(day);
    }
    // [] would mean "every day" to both schedule engines — the opposite of an
    // empty row, so the last click has to be inert.
    expect(pressedDays()).toHaveLength(1);
  });

  it("exposes the interval chip only for hourly, and sends what it picks", async () => {
    const user = userEvent.setup();
    render(<HabitModal isOpen onClose={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /every \d+h/ })).not.toBeInTheDocument();
    await user.click(frequency("Hourly"));

    await user.click(screen.getByRole("button", { name: /every 1h/ }));
    await user.click(screen.getByRole("menuitem", { name: "every 4h" }));

    await user.type(screen.getByLabelText("Habit title"), "Drink water");
    await user.click(screen.getByRole("button", { name: /Create habit/ }));

    await waitFor(() => expect(addHabit).toHaveBeenCalled());
    expect(addHabit.mock.calls[0][0].hourlyInterval).toBe(4);
  });

  it("labels hourly windows and daily schedule times distinctly", async () => {
    const user = userEvent.setup();
    render(<HabitModal isOpen onClose={vi.fn()} />);

    expect(screen.getByText("Schedule Time")).toBeInTheDocument();
    expect(screen.queryByText("Active Window")).not.toBeInTheDocument();

    await user.click(frequency("Hourly"));

    expect(screen.getByText("Active Window")).toBeInTheDocument();
    expect(screen.queryByText("Schedule Time")).not.toBeInTheDocument();
  });

  it("lets non-hourly habits save a schedule start and end", async () => {
    const user = userEvent.setup();
    render(<HabitModal isOpen onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Any time" }));
    await user.clear(screen.getByLabelText("Schedule start"));
    await user.type(screen.getByLabelText("Schedule start"), "09:00");
    await user.clear(screen.getByLabelText("Schedule end"));
    await user.type(screen.getByLabelText("Schedule end"), "10:15");
    await user.type(screen.getByLabelText("Habit title"), "Read");
    await user.click(screen.getByRole("button", { name: /Create habit/ }));

    await waitFor(() => expect(addHabit).toHaveBeenCalled());
    expect(addHabit.mock.calls[0][0].activeHours).toEqual({ start: "09:00", end: "10:15" });
  });

  it("summarises the schedule live in the footer", async () => {
    const user = userEvent.setup();
    render(<HabitModal isOpen onClose={vi.fn()} />);

    expect(screen.getByText(/Once a day · every day/)).toBeInTheDocument();
    await user.click(frequency("Weekly"));
    expect(screen.getByText("Once a week · check in any day")).toBeInTheDocument();
  });

  it("warns that a restricted weekly habit can only be checked in on those days", async () => {
    const user = userEvent.setup();
    render(<HabitModal isOpen onClose={vi.fn()} />);

    await user.click(frequency("Weekly"));
    await user.click(days()[0]);
    expect(
      screen.getByText("Weekly habits can only be checked in on the days you pick."),
    ).toBeInTheDocument();
  });
});

describe("HabitModal — edit", () => {
  it("prefills from the habit and saves through updateHabit", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<HabitModal isOpen onClose={onClose} habit={makeHabit()} />);

    expect(screen.getByRole("heading", { name: "Edit habit" })).toBeInTheDocument();
    expect(screen.getByLabelText("Habit title")).toHaveValue("Drink water");
    // activeDays [] expands back to the real seven for editing.
    expect(pressedDays()).toHaveLength(7);

    await user.click(screen.getByRole("button", { name: /Save changes/ }));
    await waitFor(() => expect(updateHabit).toHaveBeenCalledTimes(1));
    expect(updateHabit.mock.calls[0][0]).toBe("h1");
    expect(addHabit).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("cautions about rewriting history only when check-ins exist", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <HabitModal isOpen onClose={vi.fn()} habit={makeHabit({ completedDates: ["2026-07-01"] })} />,
    );

    await user.click(frequency("Daily"));
    expect(screen.getByText(/re-reads 1 past check-in/)).toBeInTheDocument();
    unmount();

    render(<HabitModal isOpen onClose={vi.fn()} habit={makeHabit({ completedDates: [] })} />);
    await user.click(frequency("Daily"));
    expect(screen.queryByText(/re-reads/)).not.toBeInTheDocument();
  });

  it("says plainly that a saved time window cannot be cleared yet", async () => {
    const user = userEvent.setup();
    render(<HabitModal isOpen onClose={vi.fn()} habit={makeHabit()} />);

    await user.click(screen.getByRole("button", { name: /AM-|PM/ }));
    const clear = screen.getByRole("menuitem", { name: "All day" });
    expect(clear).toBeDisabled();
    expect(clear).toHaveAttribute("title", "Clearing a saved time window needs a backend change");
  });
});

describe("HabitModal — keyboard and failure", () => {
  it("⌘↵ saves from anywhere in the modal", async () => {
    const user = userEvent.setup();
    render(<HabitModal isOpen onClose={vi.fn()} />);

    await user.type(screen.getByLabelText("Habit title"), "Stretch");
    await user.keyboard("{Control>}{Enter}{/Control}");
    await waitFor(() => expect(addHabit).toHaveBeenCalledTimes(1));
  });

  it("Escape closes the popover first, then the modal", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<HabitModal isOpen onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Any time" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the modal open and the draft intact when the save fails", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    addHabit.mockResolvedValue(false);
    render(<HabitModal isOpen onClose={onClose} />);

    await user.type(screen.getByLabelText("Habit title"), "Stretch");
    await user.click(screen.getByRole("button", { name: /Create habit/ }));

    await waitFor(() => expect(addHabit).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Habit title")).toHaveValue("Stretch");
    expect(screen.getByRole("button", { name: /Create habit/ })).toBeEnabled();
  });

  it("shows progress on the submit button while the save is in flight", async () => {
    const user = userEvent.setup();
    let resolve: (value: boolean) => void = () => {};
    addHabit.mockReturnValue(new Promise<boolean>(r => (resolve = r)));
    render(<HabitModal isOpen onClose={vi.fn()} />);

    await user.type(screen.getByLabelText("Habit title"), "Stretch");
    const button = screen.getByRole("button", { name: /Create habit/ });
    await user.click(button);

    await waitFor(() => expect(button).toHaveAttribute("aria-busy", "true"));
    expect(button).toBeDisabled();
    expect(screen.getByText("Creating…")).toBeInTheDocument();

    resolve(true);
    await waitFor(() => expect(button).toHaveAttribute("aria-busy", "false"));
  });

  it("renders nothing while closed", () => {
    render(<HabitModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
