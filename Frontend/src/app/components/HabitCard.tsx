import { Habit } from "../contexts/DataContext";
import { useData } from "../contexts/DataContext";
import { Button } from "./ui/button";
import { Check, Flame, Calendar, MoreVertical, Trash2, Clock, X } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { useState } from "react";

interface HabitCardProps {
  habit: Habit;
}

export function HabitCard({ habit }: HabitCardProps) {
  const { completeHabit, undoCompleteHabit, deleteHabit, updateHabit } = useData();
  const [open, setOpen] = useState(false);

  // Helper to check if a day is active
  const isDayActive = (date: Date) => {
    if (!habit.activeDays || habit.activeDays.length === 0) return true;
    const dayOfWeek = date.getDay();
    return habit.activeDays.includes(dayOfWeek);
  };

  // Helper to check if current time is within active hours
  const isWithinActiveHours = (date: Date) => {
    if (habit.frequency !== "hourly" || !habit.activeHours) return true;
    
    const currentHour = date.getHours();
    const currentMinute = date.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = habit.activeHours.start.split(":").map(Number);
    const startTimeInMinutes = startHour * 60 + startMinute;

    const [endHour, endMinute] = habit.activeHours.end.split(":").map(Number);
    const endTimeInMinutes = endHour * 60 + endMinute;

    return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes;
  };

  // Calculate next occurrence based on frequency and active hours/days
  const getNextOccurrence = () => {
    const now = new Date();
    
    if (habit.frequency === "hourly") {
      const interval = habit.hourlyInterval || 1;
      const intervalMs = interval * 60 * 60 * 1000;

      // If currently inactive, find next active period
      if (!isDayActive(now) || !isWithinActiveHours(now)) {
        // Find next active time
        let checkDate = new Date(now);
        
        // Check next hour
        for (let i = 0; i < 24 * 7; i++) { // Check up to 7 days
          checkDate.setHours(checkDate.getHours() + 1);
          checkDate.setMinutes(0);
          checkDate.setSeconds(0);
          
          if (isDayActive(checkDate) && isWithinActiveHours(checkDate)) {
            const endTime = new Date(checkDate.getTime() + intervalMs);
            return { start: checkDate, end: endTime };
          }
        }
      }

      // If active now, calculate based on last completion or current interval
      const lastCompletion = habit.completedDates.length > 0 
        ? new Date(habit.completedDates[habit.completedDates.length - 1])
        : null;

      let nextStart: Date;
      if (lastCompletion) {
        nextStart = new Date(lastCompletion.getTime() + intervalMs);
      } else {
        // First occurrence - start from beginning of current active period
        nextStart = new Date(now);
        nextStart.setMinutes(0);
        nextStart.setSeconds(0);
      }

      const nextEnd = new Date(nextStart.getTime() + intervalMs);
      return { start: nextStart, end: nextEnd };
    } else if (habit.frequency === "daily") {
      // Find next active day
      let nextDay = new Date(now);
      nextDay.setHours(23, 59, 59, 999);

      // If today is not active, find next active day
      if (!isDayActive(now)) {
        for (let i = 1; i <= 7; i++) {
          const checkDate = new Date(now);
          checkDate.setDate(checkDate.getDate() + i);
          if (isDayActive(checkDate)) {
            nextDay = new Date(checkDate);
            nextDay.setHours(23, 59, 59, 999);
            break;
          }
        }
      }

      return { start: now, end: nextDay };
    } else if (habit.frequency === "weekly") {
      const endOfWeek = new Date(now);
      const daysUntilSunday = 7 - now.getDay();
      endOfWeek.setDate(endOfWeek.getDate() + daysUntilSunday);
      endOfWeek.setHours(23, 59, 59, 999);
      return { start: now, end: endOfWeek };
    }

    return { start: now, end: now };
  };

  const nextOccurrence = getNextOccurrence();

  // Check if habit can be completed now
  const canComplete = () => {
    const now = new Date();
    if (!isDayActive(now)) return false;
    if (habit.frequency === "hourly" && !isWithinActiveHours(now)) return false;

    // Check if already completed for current period
    if (habit.frequency === "hourly") {
      const interval = habit.hourlyInterval || 1;
      const intervalMs = interval * 60 * 60 * 1000;
      
      // Check if there's a completion within the current interval
      const lastCompletion = habit.completedDates.length > 0 
        ? new Date(habit.completedDates[habit.completedDates.length - 1])
        : null;

      if (lastCompletion) {
        const timeSinceLastCompletion = now.getTime() - lastCompletion.getTime();
        if (timeSinceLastCompletion < intervalMs) {
          return false;
        }
      }

      return true;
    } else if (habit.frequency === "daily") {
      const today = now.toISOString().split("T")[0];
      return !habit.completedDates.includes(today);
    } else if (habit.frequency === "weekly") {
      const thisWeekStart = new Date(now);
      thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
      thisWeekStart.setHours(0, 0, 0, 0);
      
      return !habit.completedDates.some(date => {
        const completionDate = new Date(date);
        return completionDate >= thisWeekStart;
      });
    }

    return true;
  };

  const isCompleted = !canComplete() && isDayActive(new Date()) && (habit.frequency !== "hourly" || isWithinActiveHours(new Date()));
  const isInactive = !isDayActive(new Date()) || (habit.frequency === "hourly" && !isWithinActiveHours(new Date()));

  const handleComplete = () => {
    if (!canComplete()) return;

    const completionTimestamp = completeHabit(habit.id);
    
    if (completionTimestamp) {
      toast.success(`Habit "${habit.title}" marked as complete!`, {
        action: {
          label: "Undo",
          onClick: () => {
            undoCompleteHabit(habit.id, completionTimestamp);
            toast.info("Habit completion undone");
          },
        },
        duration: 5000,
      });
    }
  };

  const handleSkip = () => {
    // Add skip occurrence
    const timestamp = new Date().toISOString();
    const newOccurrences = [
      ...(habit.occurrences || []),
      { timestamp, status: "skipped" as const }
    ];
    updateHabit(habit.id, { occurrences: newOccurrences });
    toast.info(`Habit "${habit.title}" skipped for this occurrence`);
  };

  // Generate GitHub-style contribution boxes (last 30 occurrences)
  const generateOccurrenceBoxes = () => {
    const boxes: Array<{ date: string; status: "completed" | "skipped" | "missed" | "pending" }> = [];
    const now = new Date();

    if (habit.frequency === "hourly") {
      const interval = habit.hourlyInterval || 1;
      // Show last 30 intervals (or adjust based on interval)
      const numBoxes = Math.min(30, Math.floor((24 * 7) / interval)); // Up to a week or 30 boxes
      
      for (let i = numBoxes - 1; i >= 0; i--) {
        const occurrenceTime = new Date(now.getTime() - i * interval * 60 * 60 * 1000);
        const occurrenceTimeStr = occurrenceTime.toISOString();
        const occurrenceHour = occurrenceTime.toISOString().slice(0, 13);

        // Check if this time period is active
        if (!isDayActive(occurrenceTime) || !isWithinActiveHours(occurrenceTime)) {
          continue; // Skip inactive periods
        }

        // Check completion
        const completed = habit.completedDates.some(date => {
          const completionDate = new Date(date);
          return Math.abs(completionDate.getTime() - occurrenceTime.getTime()) < interval * 60 * 60 * 1000;
        });

        const skipped = habit.occurrences?.some(occ => 
          occ.status === "skipped" && 
          Math.abs(new Date(occ.timestamp).getTime() - occurrenceTime.getTime()) < interval * 60 * 60 * 1000
        );

        let status: "completed" | "skipped" | "missed" | "pending";
        if (completed) {
          status = "completed";
        } else if (skipped) {
          status = "skipped";
        } else if (occurrenceTime < now) {
          status = "missed";
        } else {
          status = "pending";
        }

        boxes.push({ date: occurrenceTimeStr, status });
      }
    } else if (habit.frequency === "daily") {
      // Show last 30 days (only active days)
      for (let i = 29; i >= 0; i--) {
        const dayDate = new Date(now);
        dayDate.setDate(dayDate.getDate() - i);
        dayDate.setHours(0, 0, 0, 0);

        // Skip if not an active day
        if (!isDayActive(dayDate)) continue;

        const dateStr = dayDate.toISOString().split("T")[0];
        const completed = habit.completedDates.includes(dateStr);
        const skipped = habit.occurrences?.some(occ => 
          occ.status === "skipped" && occ.timestamp.startsWith(dateStr)
        );

        let status: "completed" | "skipped" | "missed" | "pending";
        if (completed) {
          status = "completed";
        } else if (skipped) {
          status = "skipped";
        } else if (dayDate < now) {
          status = "missed";
        } else {
          status = "pending";
        }

        boxes.push({ date: dateStr, status });
      }
    } else if (habit.frequency === "weekly") {
      // Show last 12 weeks
      for (let i = 11; i >= 0; i--) {
        const weekDate = new Date(now);
        weekDate.setDate(weekDate.getDate() - i * 7);
        weekDate.setHours(0, 0, 0, 0);

        const weekStart = new Date(weekDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const completed = habit.completedDates.some(date => {
          const completionDate = new Date(date);
          return completionDate >= weekStart && completionDate <= weekEnd;
        });

        const skipped = habit.occurrences?.some(occ => {
          const occDate = new Date(occ.timestamp);
          return occ.status === "skipped" && occDate >= weekStart && occDate <= weekEnd;
        });

        let status: "completed" | "skipped" | "missed" | "pending";
        if (completed) {
          status = "completed";
        } else if (skipped) {
          status = "skipped";
        } else if (weekEnd < now) {
          status = "missed";
        } else {
          status = "pending";
        }

        boxes.push({ date: weekStart.toISOString(), status });
      }
    }

    return boxes;
  };

  const occurrenceBoxes = generateOccurrenceBoxes();

  const getBoxColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500 dark:bg-green-600";
      case "skipped":
        return "bg-yellow-500 dark:bg-yellow-600";
      case "missed":
        return "bg-red-500 dark:bg-red-600";
      case "pending":
        return "bg-gray-200 dark:bg-gray-700";
      default:
        return "bg-gray-100 dark:bg-gray-800";
    }
  };

  const formatNextOccurrence = () => {
    const end = nextOccurrence.end;
    const now = new Date();
    const diffMs = end.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (habit.frequency === "hourly") {
      if (diffHours < 1) {
        return `Next in ${diffMinutes} min`;
      }
      return `Next in ${diffHours}h ${diffMinutes}m`;
    } else if (habit.frequency === "daily") {
      const endDateStr = end.toLocaleDateString("en-US", { 
        month: "short", 
        day: "numeric" 
      });
      return `Due by ${endDateStr}`;
    } else if (habit.frequency === "weekly") {
      const endDateStr = end.toLocaleDateString("en-US", { 
        month: "short", 
        day: "numeric" 
      });
      return `Due by ${endDateStr}`;
    }

    return "";
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 hover:shadow-md transition-shadow relative">
      {/* Dropdown Menu - positioned in top right corner */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8"
          >
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
            onClick={() => setOpen(true)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Habit
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex items-start justify-between mb-4 pr-8">
        <div className="flex-1 pr-4">
          <h3 className="font-semibold mb-1">{habit.title}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {habit.description}
          </p>
        </div>
        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900 capitalize shrink-0">
          {habit.frequency}
          {habit.frequency === "hourly" && habit.hourlyInterval && habit.hourlyInterval > 1 && (
            <span className="ml-1">({habit.hourlyInterval}h)</span>
          )}
        </span>
      </div>

      <div className="space-y-4">
        {/* Streak */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <span className="text-sm font-medium">Current Streak</span>
          </div>
          <span className="text-2xl font-semibold text-orange-600 dark:text-orange-400">
            {habit.streak}
          </span>
        </div>

        {/* GitHub-style Occurrence Boxes */}
        {occurrenceBoxes.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground font-medium">History</div>
            <div className="flex gap-1 flex-wrap">
              {occurrenceBoxes.map((box, idx) => (
                <div
                  key={idx}
                  className={`w-3 h-3 rounded-sm ${getBoxColor(box.status)}`}
                  title={`${box.date} - ${box.status}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-green-500" />
                <span>Completed</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-yellow-500" />
                <span>Skipped</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-red-500" />
                <span>Missed</span>
              </div>
            </div>
          </div>
        )}

        {/* Next Occurrence */}
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
          <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-400 mb-2">
            <Clock className="w-4 h-4" />
            <span className="font-medium">{formatNextOccurrence()}</span>
          </div>
          {isInactive && (
            <p className="text-xs text-muted-foreground">
              {!isDayActive(new Date()) 
                ? "Inactive day - not available today" 
                : "Outside active hours"}
            </p>
          )}
        </div>

        {/* Complete and Skip Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleComplete}
            disabled={isCompleted || isInactive || !canComplete()}
            className={`flex-1 gap-2 ${
              isCompleted
                ? "bg-green-600 dark:bg-green-600 hover:bg-green-700 dark:hover:bg-green-700"
                : ""
            }`}
          >
            <Check className="w-4 h-4" />
            {isCompleted 
              ? "Completed"
              : isInactive
              ? "Inactive"
              : "Mark Complete"
            }
          </Button>
          {!isCompleted && !isInactive && (
            <Button
              onClick={handleSkip}
              variant="outline"
              size="icon"
              className="shrink-0"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Active Days Display (for daily/hourly) */}
        {(habit.frequency === "daily" || habit.frequency === "hourly") && habit.activeDays && habit.activeDays.length > 0 && habit.activeDays.length < 7 && (
          <div className="text-xs text-muted-foreground">
            Active: {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
              .filter((_, idx) => habit.activeDays?.includes(idx))
              .join(", ")}
          </div>
        )}

        {/* Active Hours Display (for hourly) */}
        {habit.frequency === "hourly" && habit.activeHours && (
          <div className="text-xs text-muted-foreground">
            Active hours: {habit.activeHours.start} - {habit.activeHours.end}
          </div>
        )}
      </div>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the habit
              from your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteHabit(habit.id);
                toast.success(`Habit "${habit.title}" has been deleted`);
                setOpen(false);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
