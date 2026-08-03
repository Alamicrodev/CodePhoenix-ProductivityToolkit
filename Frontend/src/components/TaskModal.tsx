import { useEffect, useRef, useState } from "react";
import { Calendar, Check, Clock, Timer, X } from "lucide-react";
import { Task, useData } from "../context/DataContext";
import { parseDurationInput } from "../lib/focusPlan";
import { parseDateFieldInput } from "../lib/naturalDate";
import { CMD_LABEL } from "../lib/platform";
import { QUADRANT_BY_PRIORITY } from "../lib/quickAdd";
import { formatBlockDuration } from "../lib/schedulePlan";
import { formatDueLabel, isOverdue, TaskPriority } from "../lib/taskDates";
import { formatClockTime12, formatDateKeyLocal, parseTimeInput } from "../lib/timeFormat";
import { CircleCheckbox } from "./tasks/CircleCheckbox";
import { Kbd } from "./tasks/Kbd";
import { PriorityBars } from "./tasks/PriorityBars";

/** Prefill for create mode (e.g. a parsed quick-add draft). Ignored when editing. */
export interface TaskModalSeed {
  title?: string;
  priority?: TaskPriority;
  dueDate?: string | null;
  dueTime?: string | null;
  tags?: string[];
}

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task?: Task;
  seed?: TaskModalSeed;
}

type Subtask = Task["subtasks"][number];
type PopoverKey = "priority" | "due" | "time" | "duration" | "tag";

interface Draft {
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string | null;
  dueTime: string | null;
  durationMinutes: number | null;
  tags: string[];
  subtasks: Subtask[];
}

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const TIME_OPTIONS: Array<{ label: string; value: string | null }> = [
  { label: "9:00 AM", value: "09:00" },
  { label: "12:00 PM", value: "12:00" },
  { label: "3:00 PM", value: "15:00" },
  { label: "6:00 PM", value: "18:00" },
  { label: "No time", value: null },
];

const DURATION_OPTIONS: Array<{ label: string; value: number | null }> = [
  { label: "15m", value: 15 },
  { label: "30m", value: 30 },
  { label: "45m", value: 45 },
  { label: "1h", value: 60 },
  { label: "1h 30m", value: 90 },
  { label: "2h", value: 120 },
  { label: "3h", value: 180 },
  { label: "No estimate", value: null },
];

function buildDueOptions(now = new Date()): Array<{ label: string; value: string | null }> {
  const inDays = (days: number) => {
    const date = new Date(now.getTime());
    date.setDate(date.getDate() + days);
    return formatDateKeyLocal(date);
  };
  return [
    { label: "Today", value: inDays(0) },
    { label: "Tomorrow", value: inDays(1) },
    { label: "Next week", value: inDays(7) },
    { label: "No due date", value: null },
  ];
}

function emptyDraft(seed?: TaskModalSeed): Draft {
  return {
    title: seed?.title ?? "",
    description: "",
    priority: seed?.priority ?? "medium",
    dueDate: seed?.dueDate ?? null,
    dueTime: seed?.dueTime ?? null,
    durationMinutes: null,
    tags: seed?.tags ? [...seed.tags] : [],
    subtasks: [],
  };
}

function draftFromTask(task: Task): Draft {
  return {
    title: task.title,
    description: task.description,
    priority: task.priority,
    dueDate: task.dueDate,
    dueTime: task.dueTime,
    durationMinutes: task.durationMinutes,
    tags: [...task.tags],
    subtasks: task.subtasks.map(subtask => ({ ...subtask })),
  };
}

/** Subtasks are title + done only in the editor; priority/due stay at their defaults. */
function newSubtask(title: string): Subtask {
  return {
    id: Date.now().toString(),
    title,
    completed: false,
    priority: "medium",
    dueDate: null,
    dueTime: null,
  };
}

const CHIP_CLASS =
  "flex items-center gap-[7px] rounded-md border border-border bg-card px-2.5 py-[3px] text-xs text-muted-foreground transition-colors hover:bg-hover hover:text-foreground";
const POPOVER_CLASS =
  "absolute left-0 top-[calc(100%+5px)] z-10 rounded-lg border border-border bg-popover p-1 shadow-lg";
const POPOVER_ROW_CLASS =
  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-hover";

export function TaskModal({ isOpen, onClose, task, seed }: TaskModalProps) {
  const { addTask, updateTask, deleteTask, isSyncing } = useData();
  const [draft, setDraft] = useState<Draft>(() => emptyDraft());
  const [pop, setPop] = useState<PopoverKey | null>(null);
  const [subDraft, setSubDraft] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [timeDraft, setTimeDraft] = useState("");
  const [dateDraft, setDateDraft] = useState("");
  const [durationDraft, setDurationDraft] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setDraft(task ? draftFromTask(task) : emptyDraft(seed));
    setPop(null);
    setSubDraft("");
    setTagDraft("");
    setTimeDraft("");
    setDateDraft("");
    setDurationDraft("");
    const timer = window.setTimeout(() => {
      // Don't steal focus if the user already started interacting with the modal.
      if (modalRef.current?.contains(document.activeElement)) {
        return;
      }
      titleRef.current?.focus();
    }, 30);
    return () => window.clearTimeout(timer);
  }, [isOpen, task, seed]);

  // The page behind must not scroll while the editor is open.
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

  const canSave = draft.title.trim().length > 0;

  const handleSave = async () => {
    const title = draft.title.trim();
    if (!title || isSyncing) {
      return;
    }
    const fields = {
      title,
      description: draft.description.trim(),
      priority: draft.priority,
      dueDate: draft.dueDate,
      dueTime: draft.dueTime,
      durationMinutes: draft.durationMinutes,
      tags: draft.tags,
      subtasks: draft.subtasks
        .map(subtask => ({ ...subtask, title: subtask.title.trim() }))
        .filter(subtask => subtask.title.length > 0),
    };
    const ok = task
      ? await updateTask(task.id, fields)
      : await addTask({
          ...fields,
          completed: false,
          completedAt: null,
          quadrant: QUADRANT_BY_PRIORITY[draft.priority],
        });
    if (ok) {
      onClose();
    }
  };

  const handleDelete = async () => {
    if (!task || isSyncing) {
      return;
    }
    await deleteTask(task.id);
    onClose();
  };

  // Kept fresh each render so the window listener below never sees stale state.
  const keyContext = useRef({ pop, handleSave, onClose });
  keyContext.current = { pop, handleSave, onClose };

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const containFocus = (event: KeyboardEvent) => {
      const root = modalRef.current;
      if (!root) {
        return;
      }
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button, input, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(el => !el.hasAttribute("disabled"));
      if (focusables.length === 0) {
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const outside = !root.contains(active);
      if (event.shiftKey && (active === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void keyContext.current.handleSave();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
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
    // Capture phase: the editor owns the keyboard while open; page shortcuts never fire.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const isEditing = Boolean(task);
  const dueOptions = buildDueOptions();
  const subDone = draft.subtasks.filter(subtask => subtask.completed).length;
  const subTotal = draft.subtasks.length;
  const dueLabel = draft.dueDate ? formatDueLabel(draft.dueDate) : "Due date";
  const dueUrgent = draft.dueDate !== null && (isOverdue(draft.dueDate) || dueLabel === "Today");

  const togglePop = (key: PopoverKey) => (event: React.MouseEvent) => {
    event.stopPropagation();
    setPop(current => (current === key ? null : key));
  };
  const stop = (event: React.MouseEvent) => event.stopPropagation();

  /** Keeps every keystroke, but only commits once the draft reads as a time. */
  const applyCustomTime = (raw: string) => {
    setTimeDraft(raw);
    const parsed = parseTimeInput(raw);
    if (parsed) {
      setDraft(d => ({ ...d, dueTime: parsed }));
    }
  };

  const parsedCustomDate = dateDraft ? parseDateFieldInput(dateDraft) : null;
  const applyCustomDate = (raw: string) => {
    setDateDraft(raw);
    const parsed = parseDateFieldInput(raw);
    if (parsed) {
      setDraft(d => ({
        ...d,
        dueDate: parsed.date,
        // "friday at 3pm" sets both; a plain date leaves any existing time be.
        dueTime: parsed.time ?? d.dueTime,
      }));
    }
  };

  const parsedCustomDuration = durationDraft ? parseDurationInput(durationDraft) : null;
  const applyCustomDuration = (raw: string) => {
    setDurationDraft(raw);
    const parsed = parseDurationInput(raw);
    if (parsed !== null && parsed > 0) {
      setDraft(d => ({ ...d, durationMinutes: parsed }));
    }
  };

  const addTag = () => {
    const tag = tagDraft.trim().replace(/^#/, "").toLowerCase();
    if (!tag) {
      return;
    }
    setDraft(d => (d.tags.includes(tag) ? d : { ...d, tags: [...d.tags, tag] }));
    setTagDraft("");
  };

  const addSubtask = () => {
    const title = subDraft.trim();
    if (!title) {
      return;
    }
    setDraft(d => ({ ...d, subtasks: [...d.subtasks, newSubtask(title)] }));
    setSubDraft("");
  };

  const updateSubtask = (id: string, patch: Partial<Subtask>) => {
    setDraft(d => ({
      ...d,
      subtasks: d.subtasks.map(subtask =>
        subtask.id === id ? { ...subtask, ...patch } : subtask,
      ),
    }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/35 pt-[9vh]"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
        onClick={event => {
          event.stopPropagation();
          setPop(null);
        }}
        className="flex max-h-[82vh] w-[620px] max-w-[calc(100vw-32px)] flex-col overflow-y-auto rounded-2xl border border-border bg-card shadow-xl"
      >
        {/* Header strip */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          <h2
            id="task-modal-title"
            className="text-[11px] font-semibold uppercase tracking-[0.06em] text-tertiary"
          >
            {isEditing ? "Edit task" : "New task"}
          </h2>
          <span className="flex-1" />
          <Kbd>esc</Kbd>
        </div>

        {/* Title, description, property chips */}
        <div className="px-[18px] pt-3.5">
          <input
            ref={titleRef}
            value={draft.title}
            onChange={event => setDraft(d => ({ ...d, title: event.target.value }))}
            placeholder="Task title"
            aria-label="Task title"
            className="w-full bg-transparent text-base font-semibold text-foreground outline-none placeholder:text-tertiary"
          />
          <textarea
            value={draft.description}
            onChange={event => setDraft(d => ({ ...d, description: event.target.value }))}
            placeholder="Add a description…"
            aria-label="Task description"
            rows={2}
            className="mt-1.5 w-full resize-none bg-transparent text-[13px] leading-relaxed text-muted-foreground outline-none placeholder:text-tertiary"
          />

          <div className="flex flex-wrap items-center gap-1.5 pb-3.5 pt-2.5">
            {/* Priority chip */}
            <div className="relative">
              <button
                type="button"
                onClick={togglePop("priority")}
                aria-haspopup="menu"
                aria-expanded={pop === "priority"}
                className={CHIP_CLASS}
              >
                <PriorityBars priority={draft.priority} />
                <span>{PRIORITY_LABELS[draft.priority]}</span>
              </button>
              {pop === "priority" && (
                <div className={`${POPOVER_CLASS} w-[170px]`} role="menu" onClick={stop}>
                  {(["high", "medium", "low"] as const).map(level => (
                    <button
                      key={level}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setDraft(d => ({ ...d, priority: level }));
                        setPop(null);
                      }}
                      className={POPOVER_ROW_CLASS}
                    >
                      <PriorityBars priority={level} />
                      <span className="flex-1">{PRIORITY_LABELS[level]}</span>
                      {draft.priority === level && <Check className="h-3 w-3 text-primary" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Due date chip */}
            <div className="relative">
              <button
                type="button"
                onClick={togglePop("due")}
                aria-haspopup="menu"
                aria-expanded={pop === "due"}
                className={CHIP_CLASS}
              >
                <Calendar className="h-3.5 w-3.5 text-tertiary" />
                <span
                  className={
                    draft.dueDate
                      ? dueUrgent
                        ? "text-priority-high"
                        : "text-foreground"
                      : "text-tertiary"
                  }
                >
                  {dueLabel}
                </span>
              </button>
              {pop === "due" && (
                <div className={`${POPOVER_CLASS} w-[188px]`} role="menu" onClick={stop}>
                  {dueOptions.map(option => (
                    <button
                      key={option.label}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setDraft(d => ({ ...d, dueDate: option.value }));
                        setPop(null);
                      }}
                      className={POPOVER_ROW_CLASS}
                    >
                      <span className="flex-1">{option.label}</span>
                      {draft.dueDate === option.value && (
                        <Check className="h-3 w-3 text-primary" />
                      )}
                    </button>
                  ))}
                  <div className="px-1 pb-1 pt-1">
                    <input
                      value={dateDraft}
                      onChange={event => applyCustomDate(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          if (parseDateFieldInput(dateDraft)) {
                            setPop(null);
                          }
                        }
                      }}
                      placeholder="custom — next friday"
                      aria-label="Custom due date"
                      className={`h-[26px] w-full rounded-md border bg-transparent px-2 font-mono text-[11.5px] outline-none placeholder:text-tertiary ${
                        dateDraft && !parsedCustomDate
                          ? "border-priority-medium"
                          : dateDraft
                            ? "border-primary"
                            : "border-border"
                      }`}
                    />
                    {/* An eager parser must never file a task silently — show
                        what it resolved to, in the same words the chip uses. */}
                    <p className="min-h-[15px] px-0.5 pt-1 text-[10.5px] text-tertiary">
                      {parsedCustomDate ? formatDueLabel(parsedCustomDate.date) : ""}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Time chip */}
            <div className="relative">
              <button
                type="button"
                onClick={togglePop("time")}
                aria-haspopup="menu"
                aria-expanded={pop === "time"}
                className={CHIP_CLASS}
              >
                <Clock className="h-3.5 w-3.5 text-tertiary" />
                <span className={draft.dueTime ? "text-foreground" : "text-tertiary"}>
                  {draft.dueTime ? formatClockTime12(draft.dueTime) : "Time"}
                </span>
              </button>
              {pop === "time" && (
                <div className={`${POPOVER_CLASS} w-[164px]`} role="menu" onClick={stop}>
                  {TIME_OPTIONS.map(option => (
                    <button
                      key={option.label}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setDraft(d => ({ ...d, dueTime: option.value }));
                        setPop(null);
                      }}
                      className={POPOVER_ROW_CLASS}
                    >
                      <span className="flex-1">{option.label}</span>
                      {draft.dueTime === option.value && (
                        <Check className="h-3 w-3 text-primary" />
                      )}
                    </button>
                  ))}
                  {/* Four presets cannot cover a day. Enter commits and closes,
                      like the preset rows; a partial draft simply does nothing. */}
                  <div className="px-1 pb-1 pt-1">
                    <input
                      value={timeDraft}
                      onChange={event => applyCustomTime(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          if (parseTimeInput(timeDraft)) {
                            setPop(null);
                          }
                        }
                      }}
                      placeholder="custom — 9:30pm"
                      aria-label="Custom time"
                      className={`h-[26px] w-full rounded-md border bg-transparent px-2 font-mono text-[11.5px] outline-none placeholder:text-tertiary ${
                        timeDraft && !parseTimeInput(timeDraft)
                          ? "border-priority-medium"
                          : timeDraft
                            ? "border-primary"
                            : "border-border"
                      }`}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Duration chip */}
            <div className="relative">
              <button
                type="button"
                onClick={togglePop("duration")}
                aria-haspopup="menu"
                aria-expanded={pop === "duration"}
                className={CHIP_CLASS}
              >
                <Timer className="h-3.5 w-3.5 text-tertiary" />
                <span className={draft.durationMinutes ? "text-foreground" : "text-tertiary"}>
                  {draft.durationMinutes
                    ? formatBlockDuration(draft.durationMinutes)
                    : "Duration"}
                </span>
              </button>
              {pop === "duration" && (
                <div className={`${POPOVER_CLASS} w-[164px]`} role="menu" onClick={stop}>
                  {DURATION_OPTIONS.map(option => (
                    <button
                      key={option.label}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setDraft(d => ({ ...d, durationMinutes: option.value }));
                        setPop(null);
                      }}
                      className={POPOVER_ROW_CLASS}
                    >
                      <span className="flex-1">{option.label}</span>
                      {draft.durationMinutes === option.value && (
                        <Check className="h-3 w-3 text-primary" />
                      )}
                    </button>
                  ))}
                  {/* Same vocabulary the Focus setup modal teaches. */}
                  <div className="px-1 pb-1 pt-1">
                    <input
                      value={durationDraft}
                      onChange={event => applyCustomDuration(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          if (parseDurationInput(durationDraft) !== null) {
                            setPop(null);
                          }
                        }
                      }}
                      placeholder="custom — 1h 45m"
                      aria-label="Custom duration"
                      className={`h-[26px] w-full rounded-md border bg-transparent px-2 font-mono text-[11.5px] outline-none placeholder:text-tertiary ${
                        durationDraft && parsedCustomDuration === null
                          ? "border-priority-medium"
                          : durationDraft
                            ? "border-primary"
                            : "border-border"
                      }`}
                    />
                  </div>
                </div>
              )}
            </div>

            <span className="h-4 w-px bg-border" aria-hidden="true" />

            {/* Tag pills */}
            {draft.tags.map(tag => (
              <span
                key={tag}
                className="flex items-center gap-[5px] rounded-full border border-border bg-card py-[2px] pl-2 pr-1.5 text-[11px] text-primary"
              >
                #{tag}
                <button
                  type="button"
                  aria-label={`Remove tag: ${tag}`}
                  onClick={() => setDraft(d => ({ ...d, tags: d.tags.filter(t => t !== tag) }))}
                  className="text-tertiary transition-colors hover:text-priority-high"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <div className="relative">
              <button
                type="button"
                onClick={togglePop("tag")}
                aria-haspopup="true"
                aria-expanded={pop === "tag"}
                className="rounded-full border border-border px-2.5 py-[2px] text-[11px] text-tertiary transition-colors hover:bg-hover hover:text-foreground"
              >
                + Tag
              </button>
              {pop === "tag" && (
                <div className={`${POPOVER_CLASS} w-[170px] px-2.5 py-2`} onClick={stop}>
                  <input
                    autoFocus
                    value={tagDraft}
                    onChange={event => setTagDraft(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder="#tag · ↵ to add"
                    aria-label="Add tag"
                    className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-tertiary"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Subtasks */}
        <div className="border-t border-border px-[18px] pb-3 pt-2.5">
          <div className="flex items-center gap-2 pb-1">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-tertiary">
              Subtasks
            </h3>
            {subTotal > 0 && (
              <>
                <span className="font-mono text-[11px] text-tertiary">
                  {subDone}/{subTotal}
                </span>
                <div
                  className="h-[3px] w-[72px] overflow-hidden rounded-full bg-border"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={subTotal}
                  aria-valuenow={subDone}
                  aria-label="Subtask progress"
                >
                  <div
                    className="h-full bg-done"
                    style={{ width: `${Math.round((subDone / subTotal) * 100)}%` }}
                  />
                </div>
              </>
            )}
          </div>
          {draft.subtasks.map(subtask => (
            <div key={subtask.id} className="flex items-center gap-2.5 py-[3px]">
              <CircleCheckbox
                checked={subtask.completed}
                onToggle={() => updateSubtask(subtask.id, { completed: !subtask.completed })}
                label={
                  subtask.completed
                    ? `Reopen subtask: ${subtask.title}`
                    : `Complete subtask: ${subtask.title}`
                }
                size="sm"
              />
              <input
                value={subtask.title}
                onChange={event => updateSubtask(subtask.id, { title: event.target.value })}
                aria-label="Subtask title"
                className={`min-w-0 flex-1 bg-transparent text-[12.5px] outline-none ${
                  subtask.completed ? "text-foreground/55 line-through" : "text-foreground"
                }`}
              />
              <button
                type="button"
                aria-label={`Remove subtask: ${subtask.title}`}
                onClick={() =>
                  setDraft(d => ({
                    ...d,
                    subtasks: d.subtasks.filter(st => st.id !== subtask.id),
                  }))
                }
                className="rounded p-1 text-tertiary transition-colors hover:bg-hover hover:text-priority-high"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2.5 pt-[3px]">
            <span
              className="w-[13px] shrink-0 text-center text-xs leading-none text-primary"
              aria-hidden="true"
            >
              +
            </span>
            <input
              value={subDraft}
              onChange={event => setSubDraft(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addSubtask();
                }
              }}
              placeholder="Add a subtask…  ↵ to add, stays open"
              aria-label="Add a subtask"
              className="min-w-0 flex-1 bg-transparent text-[12.5px] text-foreground outline-none placeholder:text-tertiary"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-border px-4 py-2.5">
          {isEditing && (
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={isSyncing}
              className="rounded-md px-2 py-1 text-xs text-tertiary transition-colors hover:bg-hover hover:text-priority-high disabled:opacity-50"
            >
              Delete task
            </button>
          )}
          <span className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            disabled={isSyncing}
            className="rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-hover hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!canSave || isSyncing}
            className={`flex items-center gap-[7px] rounded-md bg-primary px-3 py-[5px] text-xs font-medium text-primary-foreground transition-opacity ${
              canSave ? "" : "opacity-45"
            }`}
          >
            {isEditing ? "Save changes" : "Create task"}
            <span className="rounded bg-white/[0.18] px-[5px] py-px font-mono text-[10px]">
              {CMD_LABEL}↵
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
