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

function statusClasses(day: HabitDayStatus, busy: boolean): string {
  const base =
    "flex items-center justify-center rounded-md text-xs font-medium transition-colors shrink-0";

  if (busy) {
    return `${base} bg-gray-200 dark:bg-gray-700`;
  }

  switch (day.status) {
    case "completed":
      return `${base} bg-green-500 dark:bg-green-600 text-white hover:bg-green-600 dark:hover:bg-green-500`;
    case "partial":
      return `${base} bg-green-500/40 dark:bg-green-600/40 text-green-800 dark:text-green-200 hover:bg-green-500/60`;
    case "skipped":
      return `${base} bg-yellow-500 dark:bg-yellow-600 text-white hover:bg-yellow-600 dark:hover:bg-yellow-500`;
    case "missed":
      return `${base} bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/60`;
    case "pending":
      return day.toggleable
        ? `${base} bg-gray-200 dark:bg-gray-700 text-muted-foreground hover:bg-gray-300 dark:hover:bg-gray-600`
        : `${base} bg-gray-100 dark:bg-gray-800 opacity-40`;
    default:
      // inactive / before-start
      return `${base} bg-gray-100 dark:bg-gray-800 opacity-30`;
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
            <span className="text-sm">{slot.label}</span>
            <Button
              variant={slot.status === "completed" ? "default" : "outline"}
              size="sm"
              className={
                slot.status === "completed"
                  ? "h-7 bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700"
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
