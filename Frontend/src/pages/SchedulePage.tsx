import { useEffect, useState } from "react";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import DashboardLayout from "../components/DashboardLayout";
import { Calendar, Clock, RefreshCw, Sparkles, Loader2 } from "lucide-react";
import { apiRequest } from "../lib/api";
import {
  formatClockTime12,
  formatDateKeyLocal,
  formatRelativeDueLabel,
  parseDateOnlyLocal,
} from "../lib/timeFormat";
import { formatHabitNextOccurrence } from "../lib/habitSchedule";
import { formatDueDate } from "../lib/taskDates";

interface AiScheduleItem {
  time: string;
  type: string;
  title: string;
  priority: string;
  duration: string;
  detail?: string | null;
  source_id?: string | null;
  source_type?: "task" | "habit" | "system" | null;
}

interface AiScheduleResponse {
  generated_at: string;
  model: string | null;
  fallback_used: boolean;
  items: AiScheduleItem[];
  summary: string | null;
}

export default function SchedulePage() {
  const { accessToken } = useAuth();
  const { tasks, habits, focusSessions } = useData();
  const [remoteSuggestions, setRemoteSuggestions] = useState<AiScheduleItem[] | null>(null);
  const [schedulerSummary, setSchedulerSummary] = useState<string | null>(null);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  // Get today's date
  const today = new Date();
  const todayStr = formatDateKeyLocal(today);
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  // Get tasks due exactly today (not completed, not in active focus sessions, not expired)
  const tasksInFocus = new Set(
    focusSessions
      .filter(session => session.status === "active")
      .flatMap(session =>
        session.items
          .filter(item => item.sourceType === "task")
          .map(item => item.sourceId)
      )
  );

  const dueSoonTasks = tasks.filter(task => {
    if (!task.dueDate || task.completed || tasksInFocus.has(task.id)) return false;
    return parseDateOnlyLocal(task.dueDate) <= nextWeek;
  }).sort((a, b) => {
    const dateA = a.dueDate ? parseDateOnlyLocal(a.dueDate).getTime() : Infinity;
    const dateB = b.dueDate ? parseDateOnlyLocal(b.dueDate).getTime() : Infinity;
    return dateA - dateB;
  });

  const todayTasks = dueSoonTasks.filter(task => task.dueDate === todayStr);
  const upcomingTasks = dueSoonTasks.filter(task => task.dueDate !== todayStr);

  // Get habits that need to be completed today
  const habitsInFocus = new Set(
    focusSessions
      .filter(session => session.status === "active")
      .flatMap(session =>
        session.items
          .filter(item => item.sourceType === "habit")
          .map(item => item.sourceId)
      )
  );

  const todayHabits = habits.filter(habit => {
    if (habitsInFocus.has(habit.id)) return false;
    
    // Check if habit is already completed for today
    if (habit.frequency === "hourly") {
      const currentHour = new Date().toISOString().slice(0, 13);
      return !habit.completedDates.some(date => date.startsWith(currentHour));
    } else if (habit.frequency === "daily") {
      return !habit.completedDates.includes(todayStr);
    }
    
    return true; // Include weekly/monthly habits
  });

  useEffect(() => {
    if (!accessToken) {
      setRemoteSuggestions(null);
      setSchedulerSummary(null);
      setIsLoadingSchedule(false);
      return;
    }

    let cancelled = false;
    setIsLoadingSchedule(true);
    setRemoteSuggestions(null);
    setSchedulerSummary(null);

    const loadScheduler = async () => {
      try {
        const response = await apiRequest<AiScheduleResponse>("/ai-scheduler/suggest", {
          method: "POST",
          token: accessToken,
          body: JSON.stringify({
            current_time: new Date().toISOString(),
            time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        });

        if (cancelled) {
          return;
        }

        setRemoteSuggestions(response.items || null);
        setSchedulerSummary(response.summary || null);
      } catch (error) {
        if (!cancelled) {
          setRemoteSuggestions(null);
          setSchedulerSummary(null);
          console.error("Failed to load AI schedule", error);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSchedule(false);
        }
      }
    };

    void loadScheduler();

    return () => {
      cancelled = true;
    };
  }, [accessToken, todayStr, refreshNonce]);

  const requestNewSchedule = () => {
    if (isLoadingSchedule) {
      return;
    }
    setRefreshNonce(value => value + 1);
  };

  // Generate dynamic schedule from actual tasks and habits
  const generateSchedule = () => {
    const schedule: Array<{
      time: string;
      type: string;
      title: string;
      priority: string;
      duration: string;
      id: string;
      detail?: string;
    }> = [];

    // Add morning planning
    schedule.push({
      time: "9:00 AM",
      type: "planning",
      title: "Morning planning session",
      priority: "medium",
      duration: "30 min",
      id: "planning-morning",
    });

    // Add high priority tasks first
    const highPriorityTasks = dueSoonTasks
      .filter(t => t.priority === "high")
      .slice(0, 2);
    
    highPriorityTasks.forEach((task, index) => {
      schedule.push({
        time: task.dueTime ? formatClockTime12(task.dueTime) : `${10 + index * 2}:00 AM`,
        type: "task",
        title: task.title,
        priority: task.priority,
        duration: "60 min",
        id: task.id,
        detail: formatRelativeDueLabel(task.dueDate, task.dueTime, today),
      });
    });

    // Add daily habits
    const dailyHabits = todayHabits.filter(h => h.frequency === "daily").slice(0, 2);
    dailyHabits.forEach((habit, index) => {
      schedule.push({
        time: `${12 + index}:00 PM`,
        type: "habit",
        title: habit.title,
        priority: "medium",
        duration: "30 min",
        id: habit.id,
        detail: formatHabitNextOccurrence(habit, today),
      });
    });

    // Add medium priority tasks
    const mediumPriorityTasks = dueSoonTasks
      .filter(t => t.priority === "medium")
      .slice(0, 2);
    
    mediumPriorityTasks.forEach((task, index) => {
      schedule.push({
        time: task.dueTime ? formatClockTime12(task.dueTime) : `${2 + index}:00 PM`,
        type: "task",
        title: task.title,
        priority: task.priority,
        duration: "45 min",
        id: task.id,
        detail: formatRelativeDueLabel(task.dueDate, task.dueTime, today),
      });
    });

    // Add low priority tasks
    const lowPriorityTasks = dueSoonTasks
      .filter(t => t.priority === "low")
      .slice(0, 1);
    
    lowPriorityTasks.forEach((task) => {
      schedule.push({
        time: task.dueTime ? formatClockTime12(task.dueTime) : "4:00 PM",
        type: "task",
        title: task.title,
        priority: task.priority,
        duration: "30 min",
        id: task.id,
        detail: formatRelativeDueLabel(task.dueDate, task.dueTime, today),
      });
    });

    // Add review session at end of day if we have tasks
    if (dueSoonTasks.length > 0) {
      schedule.push({
        time: "5:00 PM",
        type: "review",
        title: "Review and planning",
        priority: "low",
        duration: "30 min",
        id: "review-evening",
      });
    }

    return schedule;
  };

  const localSuggestions = generateSchedule();
  const aiSuggestions = remoteSuggestions && remoteSuggestions.length > 0 ? remoteSuggestions : localSuggestions;
  const scheduleItems = isLoadingSchedule ? [] : aiSuggestions;

  const getTypeColor = (type: string) => {
    switch (type) {
      case "task":
        return "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900";
      case "habit":
        return "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900";
      case "focus":
        return "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900";
      default:
        return "";
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold mb-2">AI Smart Schedule</h1>
            <p className="text-muted-foreground">Your personalized daily plan optimized for productivity</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={requestNewSchedule}
              disabled={isLoadingSchedule}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-sm font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingSchedule ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span>{isLoadingSchedule ? "Generating..." : "New schedule"}</span>
            </button>
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 rounded-lg border border-blue-200 dark:border-blue-900">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">AI Optimized</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* AI Schedule */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h2 className="font-semibold">Today's Schedule</h2>
                <span className="text-sm text-muted-foreground">
                  {today.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
                {schedulerSummary && (
                  <span className="ml-2 text-xs text-muted-foreground">{schedulerSummary}</span>
                )}
              </div>

              <div className="space-y-3">
                {isLoadingSchedule ? (
                  <div className="rounded-xl border border-border bg-accent/50 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600 dark:text-blue-400" />
                      <div>
                        <p className="font-medium">Generating your schedule</p>
                        <p className="text-sm text-muted-foreground">
                          Pulling your latest tasks, habits, and focus sessions.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-4 p-4 rounded-lg bg-background border border-border animate-pulse"
                        >
                          <div className="flex items-center justify-center w-20 h-20 rounded-lg bg-muted/40 border border-border">
                            <div className="h-4 w-10 rounded bg-muted" />
                          </div>
                          <div className="flex-1 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-2 w-full">
                                <div className="h-4 w-2/3 rounded bg-muted" />
                                <div className="h-3 w-1/2 rounded bg-muted/70" />
                              </div>
                              <div className="h-3 w-16 rounded bg-muted/70" />
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="h-5 w-14 rounded bg-muted/70" />
                              <div className="h-5 w-16 rounded bg-muted/70" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  scheduleItems.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-4 p-4 rounded-lg bg-accent hover:bg-accent/80 transition-colors border border-border"
                    >
                      <div className="flex items-center justify-center w-20 h-20 rounded-lg bg-background border border-border">
                        <div className="text-center px-2">
                          <div className="text-xs font-semibold leading-tight">
                            {item.time}
                          </div>
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <h4 className="font-medium">{item.title}</h4>
                            {item.detail && (
                              <p className="text-xs text-muted-foreground mt-1">{item.detail}</p>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {item.duration}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border capitalize ${getTypeColor(
                              item.type
                            )}`}
                          >
                            {item.type}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              item.priority === "high"
                                ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400"
                                : item.priority === "medium"
                                ? "bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400"
                                : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400"
                            }`}
                          >
                            {item.priority}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Due Today */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-semibold mb-4">Due Today</h3>
              <div className="space-y-3">
                {todayTasks.length > 0 ? (
                  todayTasks.slice(0, 5).map(task => (
                    <div
                      key={task.id}
                      className="p-3 rounded-lg bg-accent border border-border"
                    >
                      <p className="font-medium text-sm mb-1">{task.title}</p>
                      <p className="text-xs text-muted-foreground mb-2">
                        {formatRelativeDueLabel(task.dueDate, task.dueTime, today)}
                      </p>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          task.priority === "high"
                            ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400"
                            : task.priority === "medium"
                            ? "bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400"
                        }`}
                      >
                        {task.priority}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No tasks due today
                  </p>
                )}
              </div>
            </div>

            {/* Upcoming */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-semibold mb-4">Upcoming This Week</h3>
              <div className="space-y-3">
                {upcomingTasks.length > 0 ? (
                  upcomingTasks.slice(0, 5).map(task => (
                    <div
                      key={task.id}
                      className="p-3 rounded-lg bg-accent border border-border"
                    >
                      <p className="font-medium text-sm mb-1">{task.title}</p>
                      <p className="text-xs text-muted-foreground mb-2">
                        {formatRelativeDueLabel(task.dueDate, task.dueTime, today)}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {formatDueDate(task.dueDate!)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No upcoming tasks
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}


