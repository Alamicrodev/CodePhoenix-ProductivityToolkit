import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { ArrowLeft, Flame, MoreVertical, Pencil, Target, Trash2 } from "lucide-react";
import { useData } from "../context/DataContext";
import DashboardLayout from "../components/DashboardLayout";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { HabitModal } from "../components/HabitModal";
import { HabitCalendarHeatmap } from "../components/HabitCalendarHeatmap";
import { HabitScoreChart } from "../components/HabitScoreChart";
import { HabitHistoryChart } from "../components/HabitHistoryChart";
import { HabitStreaksCard } from "../components/HabitStreaksCard";
import { HabitFrequencyCard } from "../components/HabitFrequencyCard";
import { getCurrentScore } from "../lib/habitStats";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";

export default function HabitDetailPage() {
  const { habitId } = useParams<{ habitId: string }>();
  const { habits, deleteHabit, isSyncing, isWorkspaceLoading, currentTime } = useData();
  const navigate = useNavigate();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const habit = habits.find(item => item.id === habitId);
  const now = new Date(currentTime);
  const score = useMemo(() => (habit ? getCurrentScore(habit, now) : 0), [habit, currentTime]);

  if (!habit && isWorkspaceLoading) {
    return (
      <DashboardLayout>
        <div className="p-8 space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-32 w-full" />
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!habit) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-8 text-center">
            <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Target className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="mb-2 font-semibold">Habit not found</h2>
            <p className="mb-6 text-muted-foreground">
              This habit may have been deleted or the link is incorrect.
            </p>
            <Button asChild>
              <Link to="/habits">Back to Habits</Link>
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const totalCompletions = habit.completedDates.length;

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" asChild className="mt-1 shrink-0">
              <Link to="/habits" aria-label="Back to habits">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold">{habit.title}</h1>
                <span className="inline-flex items-center rounded-md border border-blue-200 bg-blue-100 px-2 py-1 text-xs font-medium capitalize text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400">
                  {habit.frequency}
                  {habit.frequency === "hourly" && habit.hourlyInterval && habit.hourlyInterval > 1 && (
                    <span className="ml-1">({habit.hourlyInterval}h)</span>
                  )}
                </span>
              </div>
              {habit.description && <p className="mt-1 text-muted-foreground">{habit.description}</p>}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" disabled={isSyncing}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit Habit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                onClick={() => setIsDeleteOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Habit
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Overview strip */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs font-medium text-muted-foreground">Habit Strength</div>
            <div className="mt-1 text-2xl font-semibold">{Math.round(score * 100)}%</div>
          </div>
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-900 dark:bg-orange-950/30">
            <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Flame className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
              Current Streak
            </div>
            <div className="mt-1 text-2xl font-semibold text-orange-600 dark:text-orange-400">
              {habit.streak}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs font-medium text-muted-foreground">Total Completions</div>
            <div className="mt-1 text-2xl font-semibold">{totalCompletions}</div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <HabitCalendarHeatmap habit={habit} />
          </div>
          <HabitScoreChart habit={habit} />
          <HabitHistoryChart habit={habit} />
          <HabitStreaksCard habit={habit} />
          <HabitFrequencyCard habit={habit} />
        </div>

        <HabitModal
          key={`${habit.id}-${isEditOpen}`}
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          habit={habit}
        />

        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the habit from your
                account.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  await deleteHabit(habit.id);
                  toast.success(`Habit "${habit.title}" has been deleted`);
                  navigate("/habits");
                }}
                disabled={isSyncing}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
