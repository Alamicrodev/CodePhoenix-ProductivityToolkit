import { useData } from "../contexts/DataContext";
import DashboardLayout from "../components/DashboardLayout";
import { Calendar, Clock, Sparkles, TrendingUp } from "lucide-react";

export default function SchedulePage() {
  const { tasks, habits, focusSessions } = useData();

  // Get today's date
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

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

  const todayTasks = tasks.filter(task => {
    if (!task.dueDate || task.completed || tasksInFocus.has(task.id)) return false;
    // Only include tasks due exactly today, not overdue tasks
    return task.dueDate === todayStr;
  });

  // Get upcoming tasks (next 7 days)
  const upcomingTasks = tasks.filter(task => {
    if (!task.dueDate || task.completed) return false;
    const dueDate = new Date(task.dueDate);
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    return dueDate > today && dueDate <= nextWeek;
  }).sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

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

  // Generate dynamic schedule from actual tasks and habits
  const generateSchedule = () => {
    const schedule: Array<{
      time: string;
      type: string;
      title: string;
      priority: string;
      duration: string;
      id: string;
    }> = [];

    // Add morning planning
    schedule.push({
      time: "09:00 AM",
      type: "planning",
      title: "Morning planning session",
      priority: "medium",
      duration: "30 min",
      id: "planning-morning",
    });

    // Add high priority tasks first
    const highPriorityTasks = todayTasks
      .filter(t => t.priority === "high")
      .slice(0, 2);
    
    highPriorityTasks.forEach((task, index) => {
      schedule.push({
        time: task.dueTime ? formatTime(task.dueTime) : `${10 + index * 2}:00 AM`,
        type: "task",
        title: task.title,
        priority: task.priority,
        duration: "60 min",
        id: task.id,
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
      });
    });

    // Add medium priority tasks
    const mediumPriorityTasks = todayTasks
      .filter(t => t.priority === "medium")
      .slice(0, 2);
    
    mediumPriorityTasks.forEach((task, index) => {
      schedule.push({
        time: task.dueTime ? formatTime(task.dueTime) : `${2 + index}:00 PM`,
        type: "task",
        title: task.title,
        priority: task.priority,
        duration: "45 min",
        id: task.id,
      });
    });

    // Add low priority tasks
    const lowPriorityTasks = todayTasks
      .filter(t => t.priority === "low")
      .slice(0, 1);
    
    lowPriorityTasks.forEach((task) => {
      schedule.push({
        time: task.dueTime ? formatTime(task.dueTime) : "04:00 PM",
        type: "task",
        title: task.title,
        priority: task.priority,
        duration: "30 min",
        id: task.id,
      });
    });

    // Add review session at end of day if we have tasks
    if (todayTasks.length > 0) {
      schedule.push({
        time: "05:00 PM",
        type: "review",
        title: "Review and planning",
        priority: "low",
        duration: "30 min",
        id: "review-evening",
      });
    }

    return schedule;
  };

  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const aiSuggestions = generateSchedule();

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
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 rounded-lg border border-blue-200 dark:border-blue-900">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">AI Optimized</span>
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
              </div>

              <div className="space-y-3">
                {aiSuggestions.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-4 p-4 rounded-lg bg-accent hover:bg-accent/80 transition-colors border border-border"
                  >
                    <div className="flex items-center justify-center w-20 h-20 rounded-lg bg-background border border-border">
                      <div className="text-center">
                        <div className="text-sm font-semibold">
                          {item.time.split(" ")[0]}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.time.split(" ")[1]}
                        </div>
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-medium">{item.title}</h4>
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
                ))}
              </div>
            </div>

            {/* Productivity Insights */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-900 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-semibold text-blue-900 dark:text-blue-100">AI Insights</h3>
              </div>
              <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                <li>• Your peak productivity hours are 10 AM - 12 PM</li>
                <li>• Consider scheduling deep work during morning hours</li>
                <li>• You've completed {focusSessions.length} focus sessions this week</li>
                <li>• Average task completion time: 45 minutes</li>
              </ul>
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
                      <span className="text-xs text-muted-foreground">
                        {new Date(task.dueDate!).toLocaleDateString()}
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
