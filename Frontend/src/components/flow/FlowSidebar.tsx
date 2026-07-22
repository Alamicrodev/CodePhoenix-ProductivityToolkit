import { Link, useLocation } from "react-router";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  CheckSquare,
  Target,
  Timer,
  Users,
  CalendarDays,
  CircleUser,
  Moon,
  Sun,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { userInitials } from "../../lib/flowTasks";
import { KbdChip } from "./KbdChip";

const NAV_ITEMS = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Tasks", href: "/tasks", icon: CheckSquare },
  { name: "Habits", href: "/habits", icon: Target },
  { name: "Focus", href: "/focus", icon: Timer },
  { name: "Cowork", href: "/cowork", icon: Users },
  { name: "Schedule", href: "/schedule", icon: CalendarDays },
  { name: "Profile", href: "/profile", icon: CircleUser },
];

interface FlowSidebarProps {
  activeCount: number;
  onToggleTheme: () => void;
}

export function FlowSidebar({ activeCount, onToggleTheme }: FlowSidebarProps) {
  const location = useLocation();
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div className="flex h-full w-[212px] shrink-0 flex-col border-r border-[var(--f-border2)] bg-[var(--f-bg)] px-2 py-[10px]">
      {/* Logo row */}
      <div className="flex items-center gap-2 px-2 pb-[14px] pt-[6px]">
        <div className="flex h-5 w-5 items-center justify-center rounded-[5px] bg-[var(--f-accent)] text-[11px] font-semibold text-white">
          F
        </div>
        <div className="text-[13px] font-semibold">FlowManager</div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-[1px]">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;
          if (isActive) {
            return (
              <Link
                key={item.name}
                to={item.href}
                className="flex items-center justify-between rounded-md bg-[var(--f-accent-soft)] px-2 py-[5px] font-medium text-[var(--f-text)]"
              >
                <span className="flex items-center gap-[9px]">
                  <Icon className="h-[15px] w-[15px] text-[var(--f-accent)]" />
                  {item.name}
                </span>
                {item.name === "Tasks" && (
                  <span className="text-[11px] text-[var(--f-text3)]">{activeCount}</span>
                )}
              </Link>
            );
          }
          return (
            <Link
              key={item.name}
              to={item.href}
              className="flex items-center gap-[9px] rounded-md px-2 py-[5px] text-[var(--f-text2)] hover:bg-[var(--f-hover)] hover:text-[var(--f-text)]"
            >
              <Icon className="h-[15px] w-[15px] opacity-80" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      {/* Theme toggle + user */}
      <div className="flex flex-col gap-[6px] px-[2px]">
        <button
          type="button"
          onClick={onToggleTheme}
          className="flex cursor-pointer items-center justify-between rounded-md border border-[var(--f-border)] bg-[var(--f-panel)] px-2 py-[5px] text-[13px] text-[var(--f-text2)] hover:bg-[var(--f-hover)] hover:text-[var(--f-text)]"
        >
          <span className="flex items-center gap-[7px]">
            {isDark ? <Moon className="h-[13px] w-[13px]" /> : <Sun className="h-[13px] w-[13px]" />}
            {isDark ? "Dark" : "Light"}
          </span>
          <KbdChip>T</KbdChip>
        </button>
        <Link to="/profile" className="flex items-center gap-2 rounded-md px-[6px] py-[5px] hover:bg-[var(--f-hover)]">
          <div className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[var(--f-accent-soft)] text-[10px] font-semibold text-[var(--f-accent)]">
            {userInitials(user?.name)}
          </div>
          <div className="min-w-0 truncate text-[12px] font-medium">{user?.name}</div>
        </Link>
      </div>
    </div>
  );
}
