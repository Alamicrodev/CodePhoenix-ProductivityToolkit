import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { ArrowLeft, Flame, MoreVertical, Pencil, Target, Trash2 } from "lucide-react";
import { useData } from "../context/DataContext";
import DashboardLayout from "../components/DashboardLayout";
import { ViewHeader } from "../components/shell/ViewHeader";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { HabitModal } from "../components/habits/HabitModal";
import { HabitCalendarHeatmap } from "../components/HabitCalendarHeatmap";
import { HabitScoreChart } from "../components/HabitScoreChart";
import { HabitHistoryChart } from "../components/HabitHistoryChart";
import { HabitStreaksCard } from "../components/HabitStreaksCard";
import { HabitFrequencyCard } from "../components/HabitFrequencyCard";
import { getCurrentScore } from "../lib/habitStats";
import { useDelayedFlag } from "../lib/useDelayedFlag";
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
  const showSkeleton = useDelayedFlag(isWorkspaceLoading);
  const now = new Date(currentTime);
  const score = useMemo(() => (habit ? getCurrentScore(habit, now) : 0), [habit, currentTime]);

  if (!habit && isWorkspaceLoading) {
    return (
      <DashboardLayout>
        {/* Nothing renders for the first 300ms — "no skeletons under 300ms". */}
        {showSkeleton && (
          <div className="mx-auto w-full max-w-[840px] space-y-3 px-4 pt-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-20 w-full" />
            <div className="grid gap-4 lg:grid-cols-2">
              <Skeleton className="h-56 w-full" />
              <Skeleton className="h-56 w-full" />
            </div>
          </div>
        )}
      </DashboardLayout>
    );
  }

  if (!habit) {
    return (
      <DashboardLayout>
        <ViewHeader title="Habit" />
        {/* Empty states are one muted line — no illustration, no card. */}
        <div className="mx-auto w-full max-w-[840px] px-4 pt-4">
          <p className="px-2 py-6 text-xs text-tertiary">
            Habit not found — it may have been deleted.{" "}
            <Link to="/habits" className="underline underline-offset-2 hover:text-foreground">
              Back to Habits
            </Link>
            .
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const totalCompletions = habit.completedDates.length;

  return (
    <DashboardLayout>
      <ViewHeader
        leading={
          <Link
            to="/habits"
            aria-label="Back to habits"
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-tertiary hover:bg-hover hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
        }
        title={habit.title}
        meta={
          <>
            {habit.frequency}
            {habit.frequency === "hourly" && habit.hourlyInterval && habit.hourlyInterval > 1
              ? ` (${habit.hourlyInterval}h)`
              : ""}
            {habit.description ? ` · ${habit.description}` : ""}
          </>
        }
        actions={
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
                className="text-destructive focus:text-destructive"
                onClick={() => setIsDeleteOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Habit
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <div className="mx-auto w-full max-w-[840px] px-4 pb-10 pt-4">
        {/* Stat strip: flat bordered cards, 18px/600 number, 11px label. */}
        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-border px-2.5 py-2">
            <div className="text-[11px] text-tertiary">Habit Strength</div>
            <div className="mt-0.5 text-[18px] font-semibold">{Math.round(score * 100)}%</div>
          </div>
          <div className="rounded-lg border border-border px-2.5 py-2">
            <div className="flex items-center gap-1 text-[11px] text-tertiary">
              <Flame className="h-3 w-3" />
              Current Streak
            </div>
            <div className="mt-0.5 text-[18px] font-semibold">{habit.streak}</div>
          </div>
          <div className="rounded-lg border border-border px-2.5 py-2">
            <div className="text-[11px] text-tertiary">Total Completions</div>
            <div className="mt-0.5 text-[18px] font-semibold">{totalCompletions}</div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <HabitCalendarHeatmap habit={habit} />
          </div>
          <HabitScoreChart habit={habit} />
          <HabitHistoryChart habit={habit} />
          <HabitStreaksCard habit={habit} />
          <HabitFrequencyCard habit={habit} />
        </div>

        {/* No key remount hack: the new modal re-seeds its draft on open. */}
        <HabitModal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} habit={habit} />

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
