import { useAuth } from "../contexts/AuthContext";
import DashboardLayout from "../components/DashboardLayout";
import { useData } from "../contexts/DataContext";
import { User, Mail, Calendar, Award, Target, CheckSquare } from "lucide-react";

export default function ProfilePage() {
  const { user } = useAuth();
  const { tasks, habits, focusSessions } = useData();

  const completedTasks = tasks.filter(t => t.completed).length;
  const totalTasks = tasks.length;
  const totalHabits = habits.length;
  const totalSessions = focusSessions.length;
  const maxStreak = Math.max(...habits.map(h => h.streak), 0);

  const stats = [
    {
      icon: CheckSquare,
      label: "Tasks Completed",
      value: completedTasks,
      total: totalTasks,
      color: "blue",
    },
    {
      icon: Target,
      label: "Active Habits",
      value: totalHabits,
      color: "green",
    },
    {
      icon: Calendar,
      label: "Focus Sessions",
      value: totalSessions,
      color: "purple",
    },
    {
      icon: Award,
      label: "Longest Streak",
      value: maxStreak,
      suffix: "days",
      color: "orange",
    },
  ];

  return (
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-3xl font-semibold mb-8">Profile</h1>

        <div className="max-w-4xl">
          {/* User Info */}
          <div className="bg-card border border-border rounded-xl p-8 mb-6">
            <div className="flex items-start gap-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-semibold">
                {user?.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-semibold mb-1">{user?.name}</h2>
                <div className="flex items-center gap-2 text-muted-foreground mb-4">
                  <Mail className="w-4 h-4" />
                  <span>{user?.email}</span>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 rounded-lg border border-blue-200 dark:border-blue-900">
                  <User className="w-4 h-4" />
                  <span className="text-sm font-medium">Pro Member</span>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              const colorClasses = {
                blue: "bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400",
                green: "bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400",
                purple: "bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400",
                orange: "bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400",
              }[stat.color];

              return (
                <div key={index} className="bg-card border border-border rounded-xl p-6">
                  <div
                    className={`w-12 h-12 rounded-lg ${colorClasses} flex items-center justify-center mb-4`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                  <p className="text-2xl font-semibold">
                    {stat.value}
                    {stat.total && `/${stat.total}`}
                    {stat.suffix && ` ${stat.suffix}`}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Achievements */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              Achievements
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { title: "First Task", emoji: "🎯", unlocked: totalTasks > 0 },
                { title: "Habit Builder", emoji: "🔥", unlocked: totalHabits > 0 },
                { title: "Focus Master", emoji: "⏰", unlocked: totalSessions >= 5 },
                { title: "Week Warrior", emoji: "📅", unlocked: maxStreak >= 7 },
                { title: "Task Crusher", emoji: "💪", unlocked: completedTasks >= 10 },
                { title: "Consistent", emoji: "⭐", unlocked: maxStreak >= 30 },
                { title: "Productive", emoji: "🚀", unlocked: completedTasks >= 50 },
                { title: "Legend", emoji: "👑", unlocked: completedTasks >= 100 },
              ].map((achievement, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border text-center transition-all ${
                    achievement.unlocked
                      ? "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-900"
                      : "bg-muted border-border opacity-40"
                  }`}
                >
                  <div className="text-3xl mb-2">{achievement.emoji}</div>
                  <p className="text-xs font-medium">{achievement.title}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
