import { Habit } from "../context/DataContext";
import { useData } from "../context/DataContext";
import { Button } from "./ui/button";
import { Check, Flame, MoreVertical, Trash2, Clock, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import {
  buildHabitHistorySlots,
  canCompleteHabitNow,
  formatHabitNextOccurrence,
  isHabitCurrentlyActive,
} from "../lib/habitSchedule";
import { formatClockTime12 } from "../lib/timeFormat";
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

interface HabitCardProps {
  habit: Habit;
}

export function HabitCard({ habit }: HabitCardProps) {
  const { completeHabit, undoCompleteHabit, deleteHabit, updateHabit, isSyncing, currentTime } = useData();
  const [open, setOpen] = useState(false);
  const now = new Date(currentTime);
  const occurrenceBoxes = useMemo(() => buildHabitHistorySlots(habit, now, 30), [habit, currentTime]);
  const nextOccurrenceLabel = formatHabitNextOccurrence(habit, now);
  const canCompleteNow = canCompleteHabitNow(habit, now);
  const isActiveNow = isHabitCurrentlyActive(habit, now);
  const isTodayActive = (habit.activeDays ?? []).length === 0 || (habit.activeDays ?? []).includes(now.getDay());
  const isCompleted = isActiveNow && !canCompleteNow;
  const isInactive = !isActiveNow;

  const handleComplete = async () => {
    if (!canCompleteNow) return;

    const completionTimestamp = await completeHabit(habit.id);

    if (completionTimestamp) {
      toast.success(`Habit "${habit.title}" marked as complete!`, {
        action: {
          label: "Undo",
          onClick: () => {
            void undoCompleteHabit(habit.id, completionTimestamp);
            toast.info("Habit completion undone");
          },
        },
        duration: 5000,
      });
    }
  };

  const handleSkip = async () => {
    // Add skip occurrence
    const timestamp = new Date().toISOString();
    const newOccurrences = [
      ...(habit.occurrences || []),
      { timestamp, status: "skipped" as const }
    ];
    await updateHabit(habit.id, { occurrences: newOccurrences });
    toast.info(`Habit "${habit.title}" skipped for this occurrence`);
  };

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

  return (
    <div className={`bg-card border border-border rounded-xl p-6 hover:shadow-md transition-shadow relative ${isSyncing ? "opacity-80 animate-pulse" : ""}`}>
      {/* Dropdown Menu - positioned in top right corner */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8"
            disabled={isSyncing}
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
                  title={`${box.label} - ${box.status}`}
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
            <span className="font-medium">{nextOccurrenceLabel}</span>
          </div>
          {isInactive && (
            <p className="text-xs text-muted-foreground">
              {!isTodayActive 
                ? "Inactive day - not available today" 
                : "Outside active hours"}
            </p>
          )}
        </div>

        {/* Complete and Skip Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleComplete}
            disabled={isCompleted || isInactive || !canCompleteNow}
            className={`flex-1 gap-2 ${
              isCompleted
                ? "bg-green-600 dark:bg-green-600 hover:bg-green-700 dark:hover:bg-green-700"
                : ""
            }`}
          >
            {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
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
              disabled={isSyncing}
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
            Active hours: {formatClockTime12(habit.activeHours.start)} - {formatClockTime12(habit.activeHours.end)}
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
              onClick={async () => {
                await deleteHabit(habit.id);
                toast.success(`Habit "${habit.title}" has been deleted`);
                setOpen(false);
              }}
              disabled={isSyncing}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
