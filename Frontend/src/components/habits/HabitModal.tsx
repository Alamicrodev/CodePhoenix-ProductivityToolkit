import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock, Repeat } from "lucide-react";

import type { Habit } from "../../context/DataContext";
import { useData } from "../../context/DataContext";
import { CMD_LABEL } from "../../lib/platform";
import {
  DAY_NAME,
  DAY_SHORT,
  describeHabitSchedule,
  type HabitScheduleDraft,
} from "../../lib/habitScheduleSummary";
import { formatClockTime12 } from "../../lib/timeFormat";
import { PendingLabel } from "../PendingLabel";
import { Kbd } from "../tasks/Kbd";
import { Segmented } from "../ui/segmented";

/** Fields a ⌘↵ hand-off from the quick-add can pre-fill. */
export interface HabitModalSeed {
  title?: string;
  frequency?: Habit["frequency"];
  activeDays?: number[];
}

interface HabitModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Present = edit mode. */
  habit?: Habit;
  /** Create mode only — the parsed quick-add draft this was opened from. */
  seed?: HabitModalSeed;
}

const CAPS = "text-[10.5px] font-semibold uppercase tracking-[0.08em] text-tertiary";
const CHIP_CLASS =
  "flex items-center gap-[7px] rounded-md border border-border bg-card px-2.5 py-[3px] text-xs text-muted-foreground transition-colors hover:bg-hover hover:text-foreground";
const POPOVER_CLASS =
  "absolute left-0 top-[calc(100%+5px)] z-10 rounded-lg border border-border bg-popover p-1 shadow-xl";
const POPOVER_UP_CLASS =
  "absolute left-0 bottom-[calc(100%+5px)] z-10 rounded-lg border border-border bg-popover p-1 shadow-xl";
const POPOVER_ROW_CLASS =
  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-hover disabled:pointer-events-none disabled:opacity-40";
const MONO_INPUT =
  "h-[26px] rounded-md border bg-transparent px-2 font-mono text-[11.5px] outline-none placeholder:text-tertiary";
const DAY_ON = "border-primary bg-primary/10 text-primary";
const DAY_OFF = "border-border bg-card text-muted-foreground hover:bg-hover hover:text-foreground";

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const INTERVAL_PRESETS = [1, 2, 3, 4, 6, 8, 12];
const CLOCK_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const HOURLY_WINDOWS = [
  { label: "Waking hours · 7:00 AM–10:00 PM", window: { start: "07:00", end: "22:00" } },
  { label: "Work hours · 9:00 AM–5:00 PM", window: { start: "09:00", end: "17:00" } },
  { label: "Evening · 6:00 PM–10:00 PM", window: { start: "18:00", end: "22:00" } },
];
const TIMES_OF_DAY = [
  { label: "Morning · 8:00 AM", window: { start: "08:00", end: "08:00" } },
  { label: "Midday · 12:00 PM", window: { start: "12:00", end: "12:00" } },
  { label: "Evening · 7:00 PM", window: { start: "19:00", end: "19:00" } },
];

type Popover = "interval" | "time" | null;

interface Draft extends HabitScheduleDraft {
  title: string;
  description: string;
}

/** [] means "every day" on the wire; the draft always carries the real seven. */
function expandDays(days: number[] | undefined): number[] {
  return days && days.length > 0 ? [...days].sort((a, b) => a - b) : ALL_DAYS;
}

function emptyDraft(seed?: HabitModalSeed): Draft {
  return {
    title: seed?.title ?? "",
    description: "",
    frequency: seed?.frequency ?? "daily",
    hourlyInterval: 1,
    activeDays: expandDays(seed?.activeDays),
    activeHours: null,
  };
}

function draftFromHabit(habit: Habit): Draft {
  return {
    title: habit.title,
    description: habit.description,
    frequency: habit.frequency,
    hourlyInterval: habit.hourlyInterval ?? 1,
    activeDays: expandDays(habit.activeDays),
    activeHours: habit.activeHours ?? null,
  };
}

function timeChipLabel(draft: Draft) {
  if (!draft.activeHours) {
    return draft.frequency === "hourly" ? "All day" : "Any time";
  }
  return draft.frequency === "hourly"
    ? `${formatClockTime12(draft.activeHours.start)}–${formatClockTime12(draft.activeHours.end)}`
    : formatClockTime12(draft.activeHours.start);
}

/**
 * The full habit editor — create and edit.
 *
 * STYLE_GUIDE_AUDIT.md Appendix B-3 permits a create-mode modal only while the
 * inline quick-add still exists, plain ↵ still creates inline and refocuses,
 * and the quick-add hint reads "↵ add · ⌘↵ full editor". HabitQuickAdd.tsx
 * holds all three; do not change either file without re-reading B-3.
 *
 * Layout follows FocusSetupModal rather than TaskModal: pinned header and
 * footer around an inner scroller, because the footer carries the live
 * schedule summary and the body's height changes with frequency.
 */
export function HabitModal({ isOpen, onClose, habit, seed }: HabitModalProps) {
  const { addHabit, updateHabit } = useData();
  const isEditing = Boolean(habit);

  const [draft, setDraft] = useState<Draft>(() => (habit ? draftFromHabit(habit) : emptyDraft(seed)));
  const [pop, setPop] = useState<Popover>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [customInterval, setCustomInterval] = useState("");

  const modalRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const habitId = habit?.id;

  // Keyed on the habit's id, not the object: the habits array gets a new
  // identity on every sync, and re-seeding from it would wipe what is being
  // typed. An open editor owns its draft.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setDraft(habit ? draftFromHabit(habit) : emptyDraft(seed));
    setPop(null);
    setIsSaving(false);
    setCustomInterval("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, habitId, seed]);

  const canSave = draft.title.trim().length > 0;

  const handleSave = useCallback(async () => {
    if (!canSave || isSaving) {
      return;
    }
    setIsSaving(true);
    try {
      const fields = {
        title: draft.title.trim(),
        description: draft.description.trim(),
        frequency: draft.frequency,
        // The key is present in every branch on purpose: buildHabitUpdatePayload
        // is key-presence based, so omitting it leaves an hourly→daily habit
        // carrying a stale interval and a stale window.
        hourlyInterval: draft.frequency === "hourly" ? draft.hourlyInterval : undefined,
        activeHours: draft.activeHours ?? undefined,
        // [] is the wire format for "every day".
        activeDays: draft.activeDays.length === 7 ? [] : draft.activeDays,
      };

      const saved = habit
        ? await updateHabit(habit.id, fields)
        : await addHabit({
            ...fields,
            streak: 0,
            lastCompleted: null,
            completedDates: [],
            occurrences: [],
          });

      // Only close on success — a failed save must not discard the draft.
      if (saved) {
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  }, [addHabit, canSave, draft, habit, isSaving, onClose, updateHabit]);

  /* --------------------------------- keyboard ------------------------------- */

  const keyContext = useRef({ pop, handleSave, onClose, isSaving });
  keyContext.current = { pop, handleSave, onClose, isSaving };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const containFocus = (event: KeyboardEvent) => {
      const root = modalRef.current;
      if (!root) {
        return;
      }
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button, input, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(element => !element.hasAttribute("disabled"));
      if (focusable.length === 0) {
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!active || !root.contains(active)) {
        event.preventDefault();
        first.focus();
        return;
      }
      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      // Stand down mid-save WITHOUT preventDefault, so Tab still works and a
      // second ⌘↵ cannot double-submit.
      if (keyContext.current.isSaving) {
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void keyContext.current.handleSave();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        // One layer at a time: the popover, then the modal.
        if (keyContext.current.pop) {
          setPop(null);
        } else {
          keyContext.current.onClose();
        }
        return;
      }
      if (event.key === "Tab") {
        containFocus(event);
      }
    };

    // Capture phase: the editor owns the keyboard while open, so the page's own
    // C / 1-9 shortcuts never fire underneath it.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isOpen]);

  // 30ms, not 0: the modal mounts inside the quick-add's own keydown, and a
  // 0ms focus gets clawed back by default focus handling.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const timer = window.setTimeout(() => {
      if (modalRef.current?.contains(document.activeElement)) {
        return;
      }
      const input = titleRef.current;
      if (!input) {
        return;
      }
      input.focus();
      // Caret at the end, never select-all — a ⌘↵ hand-off means the seeded
      // title is worth keeping, and the next keystroke must not wipe it.
      input.setSelectionRange(input.value.length, input.value.length);
    }, 30);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  /* --------------------------------- editing -------------------------------- */

  // stopPropagation is load-bearing: the panel's own onClick clears the
  // popover, so without this the chip closes what it just opened.
  const togglePop = (which: Exclude<Popover, null>) => (event: React.MouseEvent) => {
    event.stopPropagation();
    setPop(current => (current === which ? null : which));
  };

  const stop = (event: React.MouseEvent) => event.stopPropagation();

  const toggleDay = (day: number) => {
    setDraft(current => {
      const next = current.activeDays.includes(day)
        ? current.activeDays.filter(entry => entry !== day)
        : [...current.activeDays, day].sort((a, b) => a - b);
      // Refusing the last removal is not pedantry: [] means "every day" in both
      // schedule engines, so an empty row would mean the opposite of what it shows.
      return next.length === 0 ? current : { ...current, activeDays: next };
    });
  };

  const setFrequency = (frequency: Habit["frequency"]) =>
    setDraft(current => ({ ...current, frequency }));

  const setWindow = (window: { start: string; end: string } | null) => {
    setDraft(current => ({ ...current, activeHours: window }));
    setPop(null);
  };

  const selectInterval = (hours: number) => {
    setDraft(current => ({ ...current, hourlyInterval: hours }));
    setCustomInterval("");
    setPop(null);
  };

  const applyCustomInterval = (raw: string) => {
    setCustomInterval(raw);
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 1) {
      setDraft(current => ({ ...current, hourlyInterval: Math.max(1, Math.round(parsed)) }));
    }
  };

  const applyCustomTime = (edge: "start" | "end", raw: string) => {
    // The field holds partial input while typing; only a real HH:MM commits.
    if (!CLOCK_PATTERN.test(raw)) {
      return;
    }
    setDraft(current => {
      const base = current.activeHours ?? { start: raw, end: raw };
      if (current.frequency !== "hourly") {
        return { ...current, activeHours: { start: raw, end: raw } };
      }
      return { ...current, activeHours: { ...base, [edge]: raw } };
    });
  };

  const scheduleNote = useMemo(() => {
    if (draft.frequency === "weekly" && draft.activeDays.length < 7) {
      return "Weekly habits can only be checked in on the days you pick.";
    }
    if (draft.frequency !== "hourly" && draft.activeHours) {
      return "A time puts this habit on the schedule timeline.";
    }
    return "";
  }, [draft.activeDays.length, draft.activeHours, draft.frequency]);

  const frequencyCaution =
    isEditing && habit && draft.frequency !== habit.frequency && habit.completedDates.length > 0
      ? `Changing frequency re-reads ${habit.completedDates.length} past check-in${
          habit.completedDates.length === 1 ? "" : "s"
        } — your streak may change.`
      : "";

  if (!isOpen) {
    return null;
  }

  const timePresets = draft.frequency === "hourly" ? HOURLY_WINDOWS : TIMES_OF_DAY;
  // Phase 1: update_habit drops an explicit null, so a SAVED window cannot be
  // cleared over PATCH. Say so rather than offering a control that lies.
  const clearWindowBlocked = isEditing && Boolean(habit?.activeHours);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/35 px-4 pt-4 sm:pt-[10vh]"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="habit-modal-title"
        onClick={event => {
          event.stopPropagation();
          setPop(null);
        }}
        className="flex max-h-[92dvh] w-[560px] max-w-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border px-3.5 py-3">
          <h2 id="habit-modal-title" className="text-[13px] font-semibold">
            {isEditing ? "Edit habit" : "New habit"}
          </h2>
          <span className="flex-1" />
          <Kbd>esc</Kbd>
        </div>

        <div className="overflow-y-auto">
          {/* Identity */}
          <div className="px-3.5 pb-3.5 pt-3.5">
            <input
              ref={titleRef}
              value={draft.title}
              onChange={event => setDraft(current => ({ ...current, title: event.target.value }))}
              onKeyDown={event => {
                if (event.key === "Enter" && !event.metaKey && !event.ctrlKey) {
                  event.preventDefault();
                  descriptionRef.current?.focus();
                }
              }}
              placeholder="Habit name"
              aria-label="Habit title"
              className="w-full bg-transparent text-base font-semibold text-foreground outline-none placeholder:text-tertiary"
            />
            <textarea
              ref={descriptionRef}
              value={draft.description}
              onChange={event =>
                setDraft(current => ({ ...current, description: event.target.value }))
              }
              placeholder="Add a description…"
              aria-label="Habit description"
              rows={2}
              className="mt-1.5 w-full resize-none bg-transparent text-[13px] leading-relaxed text-muted-foreground outline-none placeholder:text-tertiary"
            />
          </div>

          {/* Schedule */}
          <div className="border-t border-border px-3.5 pb-3.5 pt-3">
            <h3 className={CAPS}>Schedule</h3>

            {/* min-h reserves the row, so the interval chip costs zero height. */}
            <div className="mt-2 flex min-h-[30px] flex-wrap items-center gap-2">
              <Segmented<Habit["frequency"]>
                ariaLabel="Habit frequency"
                value={draft.frequency}
                onChange={setFrequency}
                options={[
                  { value: "hourly", label: "Hourly" },
                  { value: "daily", label: "Daily" },
                  { value: "weekly", label: "Weekly" },
                ]}
              />
              {draft.frequency === "hourly" && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={togglePop("interval")}
                    aria-haspopup="menu"
                    aria-expanded={pop === "interval"}
                    className={CHIP_CLASS}
                  >
                    <Repeat className="h-3.5 w-3.5 text-tertiary" />
                    <span>every {draft.hourlyInterval}h</span>
                  </button>
                  {pop === "interval" && (
                    <div className={`${POPOVER_CLASS} w-[164px]`} role="menu" onClick={stop}>
                      {INTERVAL_PRESETS.map(hours => (
                        <button
                          key={hours}
                          type="button"
                          role="menuitem"
                          onClick={() => selectInterval(hours)}
                          className={POPOVER_ROW_CLASS}
                        >
                          every {hours}h
                        </button>
                      ))}
                      <div className="px-1 pb-1 pt-1">
                        <input
                          value={customInterval}
                          onChange={event => applyCustomInterval(event.target.value)}
                          placeholder="custom — 5"
                          aria-label="Custom interval in hours"
                          className={`${MONO_INPUT} w-full ${
                            customInterval ? "border-primary" : "border-border"
                          }`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Both rows exist for every frequency: switching changes their
                contents, never the row count, so nothing jumps. */}
            <div className="mt-2.5 grid grid-cols-[46px_1fr] items-center gap-x-3 gap-y-2">
              <span className="text-[11.5px] text-tertiary">Days</span>
              <div role="group" aria-label="Active days" className="flex gap-1">
                {ALL_DAYS.map(day => {
                  const on = draft.activeDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={on}
                      aria-label={DAY_NAME[day]}
                      onClick={() => toggleDay(day)}
                      className={`h-[26px] w-[30px] rounded-md border text-[11px] transition-colors ${
                        on ? DAY_ON : DAY_OFF
                      }`}
                    >
                      {DAY_SHORT[day].charAt(0)}
                    </button>
                  );
                })}
              </div>

              <span className="text-[11.5px] text-tertiary">Time</span>
              <div className="relative">
                <button
                  type="button"
                  onClick={togglePop("time")}
                  aria-haspopup="menu"
                  aria-expanded={pop === "time"}
                  className={CHIP_CLASS}
                >
                  <Clock className="h-3.5 w-3.5 text-tertiary" />
                  <span className={draft.activeHours ? "text-foreground" : "text-tertiary"}>
                    {timeChipLabel(draft)}
                  </span>
                </button>
                {/* Opens upward — last row of the last section, and the panel
                    clips at overflow-hidden. */}
                {pop === "time" && (
                  <div className={`${POPOVER_UP_CLASS} w-[232px]`} role="menu" onClick={stop}>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={clearWindowBlocked}
                      title={
                        clearWindowBlocked
                          ? "Clearing a saved time window needs a backend change"
                          : undefined
                      }
                      onClick={() => setWindow(null)}
                      className={POPOVER_ROW_CLASS}
                    >
                      {draft.frequency === "hourly" ? "All day" : "Any time"}
                    </button>
                    {timePresets.map(preset => (
                      <button
                        key={preset.label}
                        type="button"
                        role="menuitem"
                        onClick={() => setWindow(preset.window)}
                        className={POPOVER_ROW_CLASS}
                      >
                        {preset.label}
                      </button>
                    ))}
                    <div className="flex items-center gap-1.5 px-1 pb-1 pt-1">
                      <input
                        defaultValue={draft.activeHours?.start ?? ""}
                        onChange={event => applyCustomTime("start", event.target.value)}
                        placeholder="07:00"
                        aria-label={draft.frequency === "hourly" ? "Window start" : "Time of day"}
                        className={`${MONO_INPUT} w-[68px] border-border focus:border-primary`}
                      />
                      {draft.frequency === "hourly" && (
                        <>
                          <span className="text-[11px] text-tertiary">–</span>
                          <input
                            defaultValue={draft.activeHours?.end ?? ""}
                            onChange={event => applyCustomTime("end", event.target.value)}
                            placeholder="22:00"
                            aria-label="Window end"
                            className={`${MONO_INPUT} w-[68px] border-border focus:border-primary`}
                          />
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Reserved height — these lines arriving moves nothing. The floor
                includes pt-2, because min-height is on the border box: 8px
                padding + a 15.75px line rounds to 24. */}
            <p className="min-h-[24px] pt-2 text-[10.5px] text-tertiary">{scheduleNote}</p>
            {isEditing && (
              <p className="min-h-[16px] text-[10.5px] text-priority-medium">{frequencyCaution}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-border px-3.5 py-2.5">
          <span aria-live="polite" className="min-w-0 flex-1 truncate text-[11.5px] text-tertiary">
            {describeHabitSchedule(draft)}
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!canSave || isSaving}
            aria-busy={isSaving}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-70"
          >
            <PendingLabel pending={isSaving} pendingLabel={isEditing ? "Saving…" : "Creating…"}>
              {isEditing ? "Save changes" : "Create habit"}
              <Kbd tone="onPrimary">{CMD_LABEL}↵</Kbd>
            </PendingLabel>
          </button>
        </div>
      </div>
    </div>
  );
}
