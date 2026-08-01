import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search } from "lucide-react";

import { Habit, Task } from "../../context/DataContext";
import { canCompleteHabitNow } from "../../lib/habitSchedule";
import {
  PlanSegment,
  buildPlan,
  describePlan,
  formatMinutes,
  parseDurationInput,
  sessionTitle,
} from "../../lib/focusPlan";
import { CMD_LABEL } from "../../lib/platform";
import { DueLabel } from "../tasks/DueLabel";
import { Kbd } from "../tasks/Kbd";
import { PriorityBars } from "../tasks/PriorityBars";
import { PlanStrip } from "./PlanStrip";

interface FocusSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  habits: Habit[];
  /** Preselected task ids, e.g. arriving from a task row's focus action. */
  seedTaskIds?: string[];
  onStart: (input: {
    totalDurationMinutes: number;
    focusLengthMinutes: number;
    breakLengthMinutes: number;
    taskIds: string[];
    habitIds: string[];
  }) => void;
}

type PickerFilter = "all" | "task" | "habit";

type PickerItem =
  | { kind: "task"; id: string; task: Task }
  | { kind: "habit"; id: string; habit: Habit };

const DURATION_PRESETS = [25, 50, 60, 120, 180, 300];
const RHYTHM_PRESETS: Array<{ label: string; focus: number; break: number }> = [
  { label: "25/5", focus: 25, break: 5 },
  { label: "50/10", focus: 50, break: 10 },
  { label: "90/15", focus: 90, break: 15 },
  { label: "No breaks", focus: 0, break: 0 },
];

const DEFAULT_TOTAL = 120;
const DEFAULT_FOCUS = 50;
const DEFAULT_BREAK = 10;

const CHIP = "rounded-full border px-2.5 py-0.5 text-[11.5px] transition-colors";
const CHIP_ON = "border-primary bg-primary/10 text-primary";
const CHIP_OFF = "border-border bg-card text-muted-foreground hover:text-foreground";
const CAPS = "text-[10.5px] font-semibold uppercase tracking-[0.08em] text-tertiary";

/** Blue selection circle — deliberately not the green completion check. */
function SelectCircle({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors ${
        selected ? "border-primary bg-primary text-white" : "border-tertiary"
      }`}
    >
      {selected && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
    </span>
  );
}

/**
 * The whole session setup in one panel: how long, what rhythm, what to carry in.
 * Replaces the full-page form and its four drag-and-drop zones — searching and
 * ticking is faster than dragging, and it fits on one screen.
 */
export function FocusSetupModal({
  isOpen,
  onClose,
  tasks,
  habits,
  seedTaskIds,
  onStart,
}: FocusSetupModalProps) {
  const [totalMinutes, setTotalMinutes] = useState(DEFAULT_TOTAL);
  const [customDuration, setCustomDuration] = useState("");
  const [focusLength, setFocusLength] = useState(DEFAULT_FOCUS);
  const [breakLength, setBreakLength] = useState(DEFAULT_BREAK);
  const [isCustomRhythm, setIsCustomRhythm] = useState(false);
  const [customFocus, setCustomFocus] = useState("50");
  const [customBreak, setCustomBreak] = useState("10");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PickerFilter>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [cursor, setCursor] = useState(0);

  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Every open starts from the defaults, carrying in whatever the caller seeded.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setTotalMinutes(DEFAULT_TOTAL);
    setCustomDuration("");
    setFocusLength(DEFAULT_FOCUS);
    setBreakLength(DEFAULT_BREAK);
    setIsCustomRhythm(false);
    setCustomFocus("50");
    setCustomBreak("10");
    setQuery("");
    setFilter("all");
    setCursor(0);
    setSelected((seedTaskIds ?? []).map(id => `task:${id}`));
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }, [isOpen, seedTaskIds]);

  const allItems = useMemo<PickerItem[]>(() => {
    const now = new Date();
    return [
      // Anything already finished elsewhere would start the session pre-done.
      ...tasks.filter(task => !task.completed).map(task => ({ kind: "task" as const, id: `task:${task.id}`, task })),
      ...habits
        .filter(habit => canCompleteHabitNow(habit, now))
        .map(habit => ({ kind: "habit" as const, id: `habit:${habit.id}`, habit })),
    ];
  }, [habits, tasks]);

  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return allItems.filter(item => {
      if (filter !== "all" && item.kind !== filter) {
        return false;
      }
      if (!needle) {
        return true;
      }
      const title = item.kind === "task" ? item.task.title : item.habit.title;
      return title.toLowerCase().includes(needle);
    });
  }, [allItems, filter, query]);

  // A shrinking list must not leave the cursor pointing past the end.
  useEffect(() => {
    setCursor(current => Math.min(current, Math.max(0, visibleItems.length - 1)));
  }, [visibleItems.length]);

  const plan = useMemo(
    () => buildPlan(totalMinutes, focusLength || totalMinutes, breakLength),
    [breakLength, focusLength, totalMinutes],
  );
  const endsAt = useMemo(() => new Date(Date.now() + totalMinutes * 60_000), [totalMinutes]);

  const counts = useMemo(
    () => ({
      all: allItems.length,
      task: allItems.filter(item => item.kind === "task").length,
      habit: allItems.filter(item => item.kind === "habit").length,
    }),
    [allItems],
  );

  const selectedTaskIds = selected.filter(id => id.startsWith("task:")).map(id => id.slice(5));
  const selectedHabitIds = selected.filter(id => id.startsWith("habit:")).map(id => id.slice(6));

  const toggle = (id: string) =>
    setSelected(current => (current.includes(id) ? current.filter(entry => entry !== id) : [...current, id]));

  const start = () => {
    if (totalMinutes <= 0) {
      return;
    }
    onStart({
      totalDurationMinutes: totalMinutes,
      // "No breaks" is one unbroken block, which the API models as a focus
      // period the length of the session.
      focusLengthMinutes: Math.min(focusLength || totalMinutes, totalMinutes),
      breakLengthMinutes: Math.max(breakLength, 1),
      taskIds: selectedTaskIds,
      habitIds: selectedHabitIds,
    });
  };

  const applyCustomDuration = (raw: string) => {
    setCustomDuration(raw);
    const parsed = parseDurationInput(raw);
    if (parsed !== null) {
      setTotalMinutes(parsed);
    }
  };

  const applyCustomRhythm = (nextFocus: string, nextBreak: string) => {
    setCustomFocus(nextFocus);
    setCustomBreak(nextBreak);
    const focusValue = Number(nextFocus);
    const breakValue = Number(nextBreak);
    if (Number.isFinite(focusValue) && focusValue > 0) {
      setFocusLength(Math.round(focusValue));
    }
    if (Number.isFinite(breakValue) && breakValue >= 0) {
      setBreakLength(Math.round(breakValue));
    }
  };

  // Capture phase: the modal owns the keyboard while it is open, so the page's
  // own N / space / E shortcuts never fire underneath it.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        start();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setCursor(current => {
          const next = event.key === "ArrowDown" ? current + 1 : current - 1;
          return Math.max(0, Math.min(next, visibleItems.length - 1));
        });
        return;
      }
      const item = visibleItems[cursor];
      if (!item) {
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        toggle(item.id);
        return;
      }
      // Space toggles as a shortcut, but only while the search box is empty —
      // once you are typing a query it has to stay a space.
      if (event.key === " " && query === "") {
        event.preventDefault();
        toggle(item.id);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  });

  // Keep the cursor row inside the scroll box as it moves.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-cursor="true"]')?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!isOpen) {
    return null;
  }

  const attachedLabel = () => {
    if (selected.length === 0) {
      return "No items attached — runs as a pure timer";
    }
    const parts: string[] = [];
    if (selectedTaskIds.length > 0) {
      parts.push(`${selectedTaskIds.length} task${selectedTaskIds.length === 1 ? "" : "s"}`);
    }
    if (selectedHabitIds.length > 0) {
      parts.push(`${selectedHabitIds.length} habit${selectedHabitIds.length === 1 ? "" : "s"}`);
    }
    return `${parts.join(" · ")} attached`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/35 px-4 pt-4 sm:pt-[10vh]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="focus-setup-title"
        onClick={event => event.stopPropagation()}
        className="flex max-h-[92vh] w-[560px] max-w-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border px-3.5 py-3">
          <h2 id="focus-setup-title" className="text-[13px] font-semibold">
            New focus session
          </h2>
          <span className="font-mono text-[11.5px] text-tertiary">
            {sessionTitle(totalMinutes, focusLength || totalMinutes, breakLength)}
          </span>
          <span className="flex-1" />
          <Kbd>esc</Kbd>
        </div>

        <div className="overflow-y-auto">
          {/* Duration */}
          <div className="px-3.5 pt-3.5">
            <h3 className={CAPS}>Duration</h3>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {DURATION_PRESETS.map(preset => (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={totalMinutes === preset && customDuration === ""}
                  onClick={() => {
                    setTotalMinutes(preset);
                    setCustomDuration("");
                  }}
                  className={`${CHIP} ${
                    totalMinutes === preset && customDuration === "" ? CHIP_ON : CHIP_OFF
                  }`}
                >
                  {formatMinutes(preset)}
                </button>
              ))}
              <input
                value={customDuration}
                onChange={event => applyCustomDuration(event.target.value)}
                placeholder="custom — 1h 45m"
                aria-label="Custom session length"
                className={`h-[26px] w-[124px] rounded-md border bg-transparent px-2 font-mono text-[11.5px] outline-none placeholder:text-tertiary ${
                  customDuration ? "border-primary" : "border-border"
                }`}
              />
            </div>
          </div>

          {/* Rhythm */}
          <div className="px-3.5 pt-4">
            <h3 className={CAPS}>Rhythm — focus / break</h3>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {RHYTHM_PRESETS.map(preset => {
                const on = !isCustomRhythm && focusLength === preset.focus && breakLength === preset.break;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setIsCustomRhythm(false);
                      // "No breaks" is one block: the focus period is the session.
                      setFocusLength(preset.focus === 0 ? 0 : preset.focus);
                      setBreakLength(preset.break);
                    }}
                    className={`${CHIP} ${on ? CHIP_ON : CHIP_OFF}`}
                  >
                    {preset.label}
                  </button>
                );
              })}
              <button
                type="button"
                aria-pressed={isCustomRhythm}
                onClick={() => {
                  setIsCustomRhythm(true);
                  applyCustomRhythm(customFocus, customBreak);
                }}
                className={`${CHIP} ${isCustomRhythm ? CHIP_ON : CHIP_OFF}`}
              >
                Custom
              </button>
              {isCustomRhythm && (
                <span className="flex items-center gap-1.5 text-[11px] text-tertiary">
                  <input
                    value={customFocus}
                    onChange={event => applyCustomRhythm(event.target.value, customBreak)}
                    aria-label="Focus period length in minutes"
                    className="h-[26px] w-[34px] rounded-md border border-border bg-transparent text-center font-mono text-[11.5px] outline-none focus:border-primary"
                  />
                  /
                  <input
                    value={customBreak}
                    onChange={event => applyCustomRhythm(customFocus, event.target.value)}
                    aria-label="Break length in minutes"
                    className="h-[26px] w-[34px] rounded-md border border-border bg-transparent text-center font-mono text-[11.5px] outline-none focus:border-primary"
                  />
                  min
                </span>
              )}
            </div>
          </div>

          {/* Plan preview */}
          <div className="px-3.5 pb-4 pt-3.5">
            <PlanPreview
              segments={plan.segments}
              caption={describePlan(plan, breakLength, endsAt)}
            />
          </div>

          {/* Item picker */}
          <div className="border-t border-border">
            <div className="flex items-center gap-2 px-3.5 py-2.5">
              <Search className="h-3.5 w-3.5 shrink-0 text-tertiary" />
              <input
                ref={searchRef}
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search tasks and habits to attach…"
                aria-label="Search tasks and habits"
                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-tertiary"
              />
              <span className="hidden shrink-0 items-center gap-1 text-[10.5px] text-tertiary sm:flex">
                <Kbd>↑↓</Kbd>
                <Kbd>space</Kbd> toggle
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-3.5 pb-2">
              {(
                [
                  { value: "all", label: "All" },
                  { value: "task", label: "Tasks" },
                  { value: "habit", label: "Habits" },
                ] as Array<{ value: PickerFilter; label: string }>
              ).map(chip => (
                <button
                  key={chip.value}
                  type="button"
                  aria-pressed={filter === chip.value}
                  onClick={() => setFilter(chip.value)}
                  className={`${CHIP} ${filter === chip.value ? CHIP_ON : CHIP_OFF}`}
                >
                  {chip.label}
                  <span className="ml-1 opacity-60">{counts[chip.value]}</span>
                </button>
              ))}
            </div>

            <div ref={listRef} className="max-h-[236px] overflow-y-auto px-2 pb-2">
              {visibleItems.length === 0 ? (
                <p className="px-1.5 py-3 text-center text-[12.5px] text-tertiary">
                  {allItems.length === 0
                    ? "Nothing open to attach — the session runs as a pure timer."
                    : "Nothing matches that search."}
                </p>
              ) : (
                visibleItems.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    data-cursor={index === cursor ? "true" : undefined}
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => toggle(item.id)}
                    aria-pressed={selected.includes(item.id)}
                    className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors ${
                      index === cursor ? "bg-accent" : ""
                    }`}
                  >
                    <SelectCircle selected={selected.includes(item.id)} />
                    {item.kind === "task" ? (
                      <>
                        <PriorityBars priority={item.task.priority} />
                        <span className="flex min-w-0 flex-1 items-baseline gap-2">
                          <span className="truncate text-[13px] font-medium">{item.task.title}</span>
                          {item.task.description && (
                            <span className="hidden truncate text-xs text-tertiary sm:inline">
                              {item.task.description}
                            </span>
                          )}
                        </span>
                        <DueLabel dueDate={item.task.dueDate} dueTime={item.task.dueTime} />
                      </>
                    ) : (
                      <>
                        <span className="shrink-0 text-[13px] leading-none text-done" aria-hidden="true">
                          ◎
                        </span>
                        <span className="flex min-w-0 flex-1 items-baseline gap-2">
                          <span className="truncate text-[13px] font-medium">{item.habit.title}</span>
                          <span className="hidden text-xs capitalize text-tertiary sm:inline">
                            {item.habit.frequency}
                          </span>
                        </span>
                        {item.habit.streak > 0 && (
                          <span className="shrink-0 whitespace-nowrap text-xs text-done">
                            {item.habit.streak}-day streak
                          </span>
                        )}
                      </>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-border px-3.5 py-2.5">
          <span className="min-w-0 flex-1 truncate text-[11.5px] text-tertiary">{attachedLabel()}</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={start}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Start session
            <Kbd tone="onPrimary">{CMD_LABEL}↵</Kbd>
          </button>
        </div>
      </div>
    </div>
  );
}

/** Preview of the sequence about to run, with its shape spelled out underneath. */
function PlanPreview({ segments, caption }: { segments: PlanSegment[]; caption: string }) {
  return (
    <div>
      <PlanStrip segments={segments} />
      <p className="mt-1.5 font-mono text-[10.5px] text-tertiary">{caption}</p>
    </div>
  );
}
