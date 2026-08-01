import { useMemo } from "react";
import { Check, Loader2, Minus, X } from "lucide-react";
import type { Habit } from "../context/DataContext";
import { useData } from "../context/DataContext";
import { buildHourlySlotsForDay, endOfLocalDay, startOfLocalDay } from "../lib/habitSchedule";
import type { HabitDayStatus } from "../lib/habitStats";
import type { useHabitDayToggle } from "./useHabitDayToggle";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

type HabitDayToggle = ReturnType<typeof useHabitDayToggle>;

interface HabitDayCellProps {
  habit: Habit;
  day: HabitDayStatus;
  toggle: HabitDayToggle;
  className?: string;
}

/**
 * Every state resolves through a design token, so the cell tracks the theme
 * automatically and no `dark:` twin is needed — "Never introduce new hues"
 * and "Green = done/live, red–amber–gray = priority and urgency".
 *
 * Today carries an accent outline on top of whatever state it is in, which is
 * the one thing `status` alone cannot express.
 */
function statusClasses(day: HabitDayStatus, busy: boolean): string {
  const base = "flex items-center justify-center rounded-md text-xs font-medium shrink-0";
  const today = day.isToday ? " ring-1 ring-inset ring-primary" : "";

  if (busy) {
    return `${base}${today} bg-muted`;
  }

  switch (day.status) {
    case "completed":
      return `${base}${today} bg-done text-white hover:bg-done/90`;
    case "partial":
      return `${base}${today} bg-done/40 text-foreground hover:bg-done/60`;
    case "skipped":
      return `${base}${today} bg-priority-medium text-white hover:bg-priority-medium/90`;
    case "missed":
      return `${base}${today} bg-priority-high/15 text-priority-high hover:bg-priority-high/25`;
    case "pending":
      return day.toggleable
        ? `${base}${today} bg-muted text-muted-foreground hover:bg-hover`
        : `${base}${today} bg-muted opacity-40`;
    default:
      // inactive / before-start
      return `${base}${today} bg-muted opacity-30`;
  }
}

function DayCellContent({ day, busy }: { day: HabitDayStatus; busy: boolean }) {
  if (busy) {
    return <Loader2 className="h-4 w-4 animate-spin" />;
  }

  switch (day.status) {
    case "completed":
      return <Check className="h-4 w-4" />;
    case "partial":
      return (
        <span>
          {day.completedSlots}/{day.dueSlots}
        </span>
      );
    case "skipped":
      return <Minus className="h-4 w-4" />;
    case "missed":
      return <X className="h-4 w-4" />;
    default:
      return null;
  }
}

function HourlySlotList({ habit, day, toggle }: { habit: Habit; day: HabitDayStatus; toggle: HabitDayToggle }) {
  const { currentTime } = useData();
  const now = new Date(currentTime);
  const isToday = day.date.getTime() === startOfLocalDay(now).getTime();

  const slots = useMemo(() => {
    const cutoff = isToday ? now : endOfLocalDay(day.date);
    const createdAt = habit.createdAt ? new Date(habit.createdAt) : null;
    return buildHourlySlotsForDay(habit, day.date, cutoff, createdAt);
  }, [habit, currentTime, day.key]);

  return (
    <div className="space-y-1">
      {slots.map(slot => {
        const slotBusy = toggle.busyKey === slot.start.toISOString();
        return (
          <div key={slot.start.toISOString()} className="flex items-center justify-between gap-2">
            <span className="text-xs">{slot.label}</span>
            <Button
              variant={slot.status === "completed" ? "primary" : "secondary"}
              size="sm"
              className={
                slot.status === "completed"
                  ? "h-7 bg-done text-white hover:bg-done/90"
                  : "h-7"
              }
              disabled={toggle.busyKey !== null && !slotBusy}
              onClick={() => void toggle.toggleHourlySlot(slot)}
            >
              {slotBusy ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : slot.status === "completed" ? (
                <Check className="h-3 w-3" />
              ) : slot.status === "skipped" ? (
                <Minus className="h-3 w-3" />
              ) : (
                <span className="text-xs">Mark</span>
              )}
            </Button>
          </div>
        );
      })}
      {slots.length === 0 && <p className="text-xs text-muted-foreground">No slots for this day.</p>}
    </div>
  );
}

export function HabitDayCell({ habit, day, toggle, className = "h-10 w-10" }: HabitDayCellProps) {
  const busy = toggle.busyKey === day.key;
  const classes = `${statusClasses(day, busy)} ${className}`;
  const title = `${day.key} - ${day.status}`;

  if (habit.frequency !== "hourly") {
    return (
      <button
        type="button"
        className={classes}
        disabled={!day.toggleable || toggle.busyKey !== null}
        title={title}
        onClick={() => void toggle.toggleDay(day)}
      >
        <DayCellContent day={day} busy={busy} />
      </button>
    );
  }

  if (!day.toggleable) {
    return (
      <div className={classes} title={title}>
        <DayCellContent day={day} busy={false} />
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={classes} title={title}>
          <DayCellContent day={day} busy={toggle.busyKey !== null} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="center">
        <div className="mb-2 text-xs font-medium text-muted-foreground">
          {day.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
        </div>
        <HourlySlotList habit={habit} day={day} toggle={toggle} />
      </PopoverContent>
    </Popover>
  );
}
