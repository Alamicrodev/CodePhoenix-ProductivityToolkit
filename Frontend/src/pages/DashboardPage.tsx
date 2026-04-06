import { useMemo } from "react";
import { useData } from "../context/DataContext";
import DashboardLayout from "../components/DashboardLayout";
import { CheckSquare, Target, Timer, TrendingUp, Calendar } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function DashboardPage() {
  const { tasks, habits, focusSessions } = useData();

  const completedTasks = tasks.filter(t => t.completed).length;
  const totalTasks = tasks.length;
  const activeHabits = habits.length;
  const todaysSessions = focusSessions.filter(s => {
    const today = new Date().toISOString().split("T")[0];
    return s.startedAt.split("T")[0] === today;
  }).length;

  const chartData = useMemo(() => {
    const today = new Date();
    const startOfWeek = new Date(today);
    const dayOffset = (today.getDay() + 6) % 7;
    startOfWeek.setDate(today.getDate() - dayOffset);
    startOfWeek.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + index);

      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const taskCount = tasks.filter(task => {
        if (!task.completedAt) {
          return false;
        }

        const completedAt = new Date(task.completedAt);
        return completedAt >= dayStart && completedAt <= dayEnd;
      }).length;

      const habitCount = habits.reduce((count, habit) => {
        const completedForDay = habit.completedDates.filter(entry => {
          const completedAt = new Date(entry);
          return completedAt >= dayStart && completedAt <= dayEnd;
        }).length;

        return count + completedForDay;
      }, 0);

      const focusCount = focusSessions.filter(session => {
        if (session.status !== "completed" || !session.endedAt) {
          return false;
        }

        const endedAt = new Date(session.endedAt);
        return endedAt >= dayStart && endedAt <= dayEnd;
      }).length;

      return {
        day: date.toLocaleDateString("en-US", { weekday: "short" }),
        tasks: taskCount,
        habits: habitCount,
        focus: focusCount,
      };
    });
  }, [focusSessions, habits, tasks]);

  const upcomingTasks = tasks
    .filter(t => !t.completed && t.dueDate)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 5);

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your productivity overview.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                <CheckSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-sm text-muted-foreground">Tasks</span>
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-semibold">{completedTasks}/{totalTasks}</p>
              <p className="text-sm text-muted-foreground">Completed today</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-950 flex items-center justify-center">
                <Target className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-sm text-muted-foreground">Habits</span>
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-semibold">{activeHabits}</p>
              <p className="text-sm text-muted-foreground">Active habits</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-950 flex items-center justify-center">
                <Timer className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <span className="text-sm text-muted-foreground">Focus</span>
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-semibold">{todaysSessions}</p>
              <p className="text-sm text-muted-foreground">Sessions today</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-orange-100 dark:bg-orange-950 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <span className="text-sm text-muted-foreground">Streak</span>
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-semibold">{Math.max(...habits.map(h => h.streak), 0)}</p>
              <p className="text-sm text-muted-foreground">Day streak</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Progress Chart */}
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold mb-6">Weekly Progress</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="tasks"
                  stackId="1"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="habits"
                  stackId="1"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="focus"
                  stackId="1"
                  stroke="#8b5cf6"
                  fill="#8b5cf6"
                  fillOpacity={0.55}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Upcoming Tasks */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold">Upcoming Tasks</h3>
            </div>
            <div className="space-y-3">
              {upcomingTasks.length > 0 ? (
                upcomingTasks.map(task => (
                  <div key={task.id} className="p-3 rounded-lg bg-accent border border-border">
                    <p className="font-medium text-sm mb-1">{task.title}</p>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        task.priority === "high"
                          ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400"
                          : task.priority === "medium"
                          ? "bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400"
                      }`}>
                        {task.priority}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(task.dueDate!).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No upcoming tasks
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}


