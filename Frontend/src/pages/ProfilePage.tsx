import { useMemo } from "react";
import { useNavigate } from "react-router";
import { useTheme } from "next-themes";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useFlowPrefs, WeekStart } from "../hooks/useFlowPrefs";
import { FlowShell } from "../components/flow/FlowShell";
import {
  FlowButton,
  FlowSectionHeader,
  FlowSegmented,
  FlowStatCard,
} from "../components/flow/FlowPrimitives";
import { userInitials } from "../lib/flowTasks";

interface Achievement {
  name: string;
  desc: string;
  earned: boolean;
  progress: string;
}

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { tasks, habits, focusSessions } = useData();
  const { resolvedTheme, setTheme } = useTheme();
  const { hints, setHints, weekStart, setWeekStart } = useFlowPrefs();
  const navigate = useNavigate();

  const completedTasks = tasks.filter(task => task.completed).length;
  const totalTasks = tasks.length;
  const totalHabits = habits.length;
  const totalSessions = focusSessions.length;
  const maxStreak = Math.max(...habits.map(habit => habit.streak), 0);

  const achievements = useMemo<Achievement[]>(() => {
    const progress = (value: number, target: number) =>
      value >= target ? "Earned" : `${value} / ${target}`;
    return [
      { name: "First task", desc: "Complete your first task", earned: completedTasks >= 1, progress: progress(completedTasks, 1) },
      { name: "Habit builder", desc: "Create your first habit", earned: totalHabits >= 1, progress: progress(totalHabits, 1) },
      { name: "Focus master", desc: "Complete 10 focus sessions", earned: totalSessions >= 10, progress: progress(totalSessions, 10) },
      { name: "Week warrior", desc: "Hold a 7-day habit streak", earned: maxStreak >= 7, progress: progress(maxStreak, 7) },
      { name: "Task crusher", desc: "Complete 10 tasks", earned: completedTasks >= 10, progress: progress(completedTasks, 10) },
      { name: "Consistent", desc: "Hold a 30-day streak", earned: maxStreak >= 30, progress: progress(maxStreak, 30) },
      { name: "Productive", desc: "Complete 50 tasks", earned: completedTasks >= 50, progress: progress(completedTasks, 50) },
      { name: "Legend", desc: "Complete 100 tasks", earned: completedTasks >= 100, progress: progress(completedTasks, 100) },
    ];
  }, [completedTasks, maxStreak, totalHabits, totalSessions]);

  const earnedCount = achievements.filter(achievement => achievement.earned).length;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <FlowShell
      title="Profile"
      actions={<FlowButton onClick={handleLogout}>Log out</FlowButton>}
    >
      <div className="mx-auto w-full max-w-[840px] px-4 pb-10 pt-[14px]">
        {/* Identity */}
        <div className="flex items-center gap-3 px-1 pb-[14px] pt-[2px]">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--f-accent-soft)] text-[13px] font-semibold text-[var(--f-accent)]">
            {userInitials(user?.name)}
          </div>
          <div>
            <div className="text-[14px] font-semibold">{user?.name}</div>
            <div className="text-[12px] text-[var(--f-text3)]">{user?.email}</div>
          </div>
        </div>

        {/* Stat strip */}
        <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          <FlowStatCard label="Tasks completed">
            {completedTasks}
            <span className="text-[12px] font-normal text-[var(--f-text3)]">/{totalTasks}</span>
          </FlowStatCard>
          <FlowStatCard label="Active habits">{totalHabits}</FlowStatCard>
          <FlowStatCard label="Focus sessions">{totalSessions}</FlowStatCard>
          <FlowStatCard label="Longest streak">
            {maxStreak} <span className="text-[11px] font-medium text-[var(--f-text3)]">days</span>
          </FlowStatCard>
        </div>

        {/* Achievements */}
        <FlowSectionHeader>
          Achievements · {earnedCount} of {achievements.length}
        </FlowSectionHeader>
        <div className="mb-4 flex flex-col">
          {achievements.map(achievement => (
            <div
              key={achievement.name}
              className={`flex items-center gap-[10px] rounded-md px-2 py-[6px] hover:bg-[var(--f-hover)] ${
                achievement.earned ? "" : "opacity-70"
              }`}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: achievement.earned ? "var(--f-done)" : "var(--f-border)" }}
              />
              <span className="w-[130px] shrink-0 font-medium">{achievement.name}</span>
              <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--f-text3)]">
                {achievement.desc}
              </span>
              <span
                className="whitespace-nowrap text-[12px]"
                style={{ color: achievement.earned ? "var(--f-done)" : "var(--f-text3)" }}
              >
                {achievement.progress}
              </span>
            </div>
          ))}
        </div>

        {/* Preferences */}
        <FlowSectionHeader>Preferences</FlowSectionHeader>
        <div className="overflow-hidden rounded-lg border border-[var(--f-border)] bg-[var(--f-panel)]">
          <div className="flex items-center gap-[10px] border-b border-[var(--f-border2)] px-3 py-2">
            <div className="flex-1">
              <div className="font-medium">Theme</div>
              <div className="text-[11.5px] text-[var(--f-text3)]">Applies across all modules</div>
            </div>
            <FlowSegmented<string>
              small
              value={resolvedTheme === "dark" ? "dark" : "light"}
              onChange={value => setTheme(value)}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
          </div>
          <div className="flex items-center gap-[10px] border-b border-[var(--f-border2)] px-3 py-2">
            <div className="flex-1">
              <div className="font-medium">Shortcut hints</div>
              <div className="text-[11.5px] text-[var(--f-text3)]">Show the footer shortcut strip</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={hints}
              aria-label="Shortcut hints"
              onClick={() => setHints(!hints)}
              className="relative h-[17px] w-[30px] cursor-pointer rounded-[10px] border-none"
              style={{ background: hints ? "var(--f-accent)" : "var(--f-border)" }}
            >
              <span
                className="absolute top-[2px] h-[13px] w-[13px] rounded-full bg-white transition-[left,right]"
                style={hints ? { right: 2 } : { left: 2 }}
              />
            </button>
          </div>
          <div className="flex items-center gap-[10px] px-3 py-2">
            <div className="flex-1">
              <div className="font-medium">Week starts on</div>
              <div className="text-[11.5px] text-[var(--f-text3)]">Used by Habits and Schedule</div>
            </div>
            <FlowSegmented<WeekStart>
              small
              value={weekStart}
              onChange={setWeekStart}
              options={[
                { value: "mon", label: "Mon" },
                { value: "sun", label: "Sun" },
              ]}
            />
          </div>
        </div>
      </div>
    </FlowShell>
  );
}
