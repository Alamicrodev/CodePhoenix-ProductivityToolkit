import { useMemo } from "react";
import { useTheme } from "next-themes";
import { LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import DashboardLayout from "../components/DashboardLayout";
import { ViewHeader } from "../components/shell/ViewHeader";
import { ShortcutFooter } from "../components/shell/ShortcutFooter";
import { SettingPanel, SettingRow } from "../components/shell/SettingRow";
import { Segmented } from "../components/ui/segmented";
import { ToggleSwitch } from "../components/ui/toggle-switch";
import { Button } from "../components/ui/button";
import { usePersistentState } from "../hooks/usePersistentState";
import { useRegisterPaletteCommands } from "../context/PaletteContext";
import type { PaletteCommand } from "../components/ModuleCommandPalette";
import { CMD_LABEL } from "../lib/platform";

/** "Sharad Bhamidipati" → "SB". */
function initialsOf(name: string | undefined) {
  const letters = (name ?? "")
    .trim()
    .split(/\s+/)
    .map(part => part[0])
    .filter(char => char && /\p{L}/u.test(char));
  return letters.length === 0 ? "?" : letters.slice(0, 2).join("").toUpperCase();
}

const isBoolean = (v: unknown): v is boolean => typeof v === "boolean";
const isWeekStart = (v: unknown): v is "mon" | "sun" => v === "mon" || v === "sun";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { tasks, habits, focusSessions } = useData();
  const { resolvedTheme, setTheme } = useTheme();

  // "No save button — changes apply instantly."
  const [showShortcutHints, setShowShortcutHints] = usePersistentState(
    "prefs.shortcutHints",
    true,
    isBoolean,
  );
  const [weekStart, setWeekStart] = usePersistentState<"mon" | "sun">(
    "prefs.weekStart",
    "mon",
    isWeekStart,
  );

  const completedTasks = tasks.filter(t => t.completed).length;
  const maxStreak = habits.reduce((max, habit) => Math.max(max, habit.streak), 0);

  const stats = [
    { label: "Tasks done", value: `${completedTasks}`, delta: `of ${tasks.length}` },
    { label: "Active habits", value: `${habits.length}` },
    { label: "Focus sessions", value: `${focusSessions.length}` },
    { label: "Longest streak", value: `${maxStreak}`, delta: "days" },
  ];

  const achievements = [
    { title: "First task", detail: "Create your first task", unlocked: tasks.length > 0 },
    { title: "Habit builder", detail: "Track your first habit", unlocked: habits.length > 0 },
    { title: "Focus master", detail: "Finish 5 focus sessions", unlocked: focusSessions.length >= 5 },
    { title: "Week warrior", detail: "Hold a 7-day streak", unlocked: maxStreak >= 7 },
    { title: "Task crusher", detail: "Complete 10 tasks", unlocked: completedTasks >= 10 },
    { title: "Consistent", detail: "Hold a 30-day streak", unlocked: maxStreak >= 30 },
    { title: "Productive", detail: "Complete 50 tasks", unlocked: completedTasks >= 50 },
    { title: "Legend", detail: "Complete 100 tasks", unlocked: completedTasks >= 100 },
  ];
  const unlockedCount = achievements.filter(a => a.unlocked).length;

  const paletteCommands = useMemo<PaletteCommand[]>(
    () => [{ label: "Log out", icon: <LogOut />, destructive: true, run: logout }],
    [logout],
  );
  useRegisterPaletteCommands("Profile", paletteCommands);

  return (
    <DashboardLayout>
      <div className="flex min-h-full flex-col">
        <ViewHeader
          title="Profile"
          meta={`${unlockedCount} of ${achievements.length} achievements`}
          actions={
            <Button variant="secondary" onClick={logout}>
              <LogOut className="h-3.5 w-3.5" />
              Log out
            </Button>
          }
        />

        <div className="mx-auto w-full max-w-[840px] flex-1 px-4 pb-10 pt-4">
          {/* Identity as a plain row, not a card — no gradient avatar. */}
          <div className="flex items-center gap-2.5 px-1 pb-3.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary"
              aria-hidden="true"
            >
              {initialsOf(user?.name)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold">{user?.name}</span>
              <span className="block truncate text-xs text-tertiary">{user?.email}</span>
            </span>
          </div>

          {/* Stat strip: flat bordered cards, 18px/600 number, 11px label. */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {stats.map(stat => (
              <div key={stat.label} className="rounded-lg border border-border px-2.5 py-2">
                <div className="text-[11px] text-tertiary">{stat.label}</div>
                <div className="mt-0.5 text-[18px] font-semibold">
                  {stat.value}
                  {stat.delta && (
                    <span className="ml-1 text-[11px] font-medium text-tertiary">{stat.delta}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Preferences — the §3 settings pattern. Changes apply instantly. */}
          <div className="mb-1 mt-6 px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-tertiary">
            Preferences
          </div>
          <SettingPanel>
            <SettingRow
              label="Theme"
              description="Applies across all modules"
              control={
                <Segmented<"light" | "dark">
                  ariaLabel="Theme"
                  value={resolvedTheme === "dark" ? "dark" : "light"}
                  onChange={setTheme}
                  options={[
                    { value: "light", label: "Light" },
                    { value: "dark", label: "Dark" },
                  ]}
                />
              }
            />
            <SettingRow
              label="Shortcut hints"
              description="Show the footer shortcut strip"
              control={
                <ToggleSwitch
                  checked={showShortcutHints}
                  onChange={setShowShortcutHints}
                  label="Show the footer shortcut strip"
                />
              }
            />
            <SettingRow
              label="Week starts on"
              description="Used by the schedule week strip"
              control={
                <Segmented<"mon" | "sun">
                  ariaLabel="Week starts on"
                  value={weekStart}
                  onChange={setWeekStart}
                  options={[
                    { value: "mon", label: "Mon" },
                    { value: "sun", label: "Sun" },
                  ]}
                />
              }
            />
          </SettingPanel>

          {/* Achievements as rows, not emoji tiles. */}
          <div className="mb-1 mt-6 px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-tertiary">
            Achievements · {unlockedCount} of {achievements.length}
          </div>
          <div>
            {achievements.map(achievement => (
              <div
                key={achievement.title}
                className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-hover ${
                  achievement.unlocked ? "" : "opacity-70"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    achievement.unlocked ? "bg-done" : "bg-border"
                  }`}
                />
                <span className="w-[130px] shrink-0 truncate text-[13px] font-medium">
                  {achievement.title}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-tertiary">
                  {achievement.detail}
                </span>
                <span
                  className={`shrink-0 text-xs ${
                    achievement.unlocked ? "text-done" : "text-tertiary"
                  }`}
                >
                  {achievement.unlocked ? "Earned" : "Locked"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {showShortcutHints && (
          <ShortcutFooter
            items={[
              { keys: `${CMD_LABEL} K`, label: "commands" },
              { keys: "T", label: "theme" },
            ]}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
