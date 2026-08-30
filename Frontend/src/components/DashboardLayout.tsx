import { ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useTheme } from "next-themes";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { usePalette } from "../context/PaletteContext";
import { ModuleCommandPalette } from "./ModuleCommandPalette";
import { Button } from "./ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { Kbd } from "./tasks/Kbd";
import { deriveDayBlocks } from "../lib/schedulePlan";
import { formatTimerDigits } from "../lib/focusPlan";
import { formatDateKeyLocal } from "../lib/timeFormat";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import {
  CheckSquare,
  Target,
  Timer,
  Calendar,
  Users,
  LogOut,
  Menu,
  LucideIcon,
} from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

type CountKey = "today" | "tasks";

const navigation: Array<{ name: string; href: string; icon: LucideIcon; count?: CountKey }> = [
  { name: "Today", href: "/schedule", icon: Calendar, count: "today" },
  { name: "Tasks", href: "/tasks", icon: CheckSquare, count: "tasks" },
  { name: "Habits", href: "/habits", icon: Target },
  { name: "Focus", href: "/focus", icon: Timer },
  { name: "Cowork", href: "/cowork", icon: Users },
];

/** "Sharad Bhamidipati" → "SB"; single names fall back to one letter. */
function initialsOf(name: string | undefined) {
  const letters = (name ?? "")
    .trim()
    .split(/\s+/)
    .map(part => part[0])
    .filter(char => char && /\p{L}/u.test(char));
  if (letters.length === 0) return "?";
  return letters.slice(0, 2).join("").toUpperCase();
}

export default function DashboardLayout({ children }: LayoutProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { tasks, habits, focusSessions } = useData();
  const { resolvedTheme, setTheme } = useTheme();
  const {
    open: isPaletteOpen,
    setOpen: setPaletteOpen,
    heading: paletteHeading,
    commands: paletteCommands,
    claimed: isPaletteClaimed,
  } = usePalette();

  const counts = useMemo(() => {
    const todayKey = formatDateKeyLocal(new Date());
    const { timed, untimed } = deriveDayBlocks(tasks, habits, todayKey);
    return {
      today: [...timed, ...untimed].filter(block => !block.done).length,
      tasks: tasks.filter(task => !task.completed).length,
    };
  }, [tasks, habits]);

  // Live state the sidebar carries: a running session's clock, and whether the
  // user is sitting in a cowork room right now.
  const runningFocus = focusSessions.find(session => session.status === "active") ?? null;
  const isInRoom = location.pathname.startsWith("/cowork/");

  // The shell owns the two global keys the guide requires of every view:
  // ⌘K (commands) and T (theme). Module keys stay on their pages.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // ⌘K is checked BEFORE the typing guard on purpose — the palette has to
      // open from inside a quick-add field too.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(!isPaletteOpen);
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() !== "t") return;
      const target = event.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target?.isContentEditable ?? false);
      if (isTyping || document.querySelector('[role="dialog"]')) return;
      event.preventDefault();
      setTheme(resolvedTheme === "dark" ? "light" : "dark");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [resolvedTheme, setTheme, isPaletteOpen, setPaletteOpen]);

  const handleLogout = () => {
    logout();
    setIsMobileNavOpen(false);
    navigate("/login");
  };

  const isProfileActive = location.pathname === "/profile";

  const sidebarContent = (isMobile = false) => {
    /** The user row doubles as the Profile link. */
    const profileRow = (
      <Link
        to="/profile"
        aria-label="Open profile"
        aria-current={isProfileActive ? "page" : undefined}
        className={`flex items-center gap-2 rounded-md px-1.5 py-1.5 transition-colors ${
          isProfileActive ? "bg-primary/10" : "hover:bg-hover"
        }`}
      >
        <span
          className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
            isProfileActive ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
          }`}
          aria-hidden="true"
        >
          {initialsOf(user?.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-xs font-medium ${
              isProfileActive ? "text-primary" : ""
            }`}
          >
            {user?.name}
          </span>
          <span className="block truncate text-[11px] text-tertiary">{user?.email}</span>
        </span>
      </Link>
    );

    return (
      <div className="flex h-full flex-col px-2 py-2.5">
        {/* Logo row */}
        <div className="flex items-center gap-2 px-2 pb-3.5 pt-1.5">
          <span
            className="flex h-5 w-5 items-center justify-center rounded-[5px] bg-primary text-[11px] font-semibold text-primary-foreground"
            aria-hidden="true"
          >
            F
          </span>
          <span className="text-[13px] font-semibold">FlowManager</span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-px">
          {navigation.map(item => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            const count = item.count ? counts[item.count] : 0;
            const row = (
              <Link
                key={item.name}
                to={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-md px-2 py-[5px] text-[13px] transition-colors ${
                  isActive
                    ? "bg-primary/10 font-medium text-foreground"
                    : "text-muted-foreground hover:bg-hover hover:text-foreground"
                }`}
              >
                <Icon
                  className={`h-[15px] w-[15px] shrink-0 ${
                    isActive ? "text-primary" : "opacity-80"
                  }`}
                />
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                {item.name === "Focus" && runningFocus ? (
                  <span
                    className="shrink-0 font-mono text-[10.5px] tabular-nums text-primary"
                    title="Focus session running"
                  >
                    {formatTimerDigits(runningFocus.phaseRemainingSeconds)}
                  </span>
                ) : item.name === "Cowork" && isInRoom ? (
                  <span
                    className="h-[7px] w-[7px] shrink-0 animate-pulse rounded-full bg-done"
                    title="You're in a room"
                    aria-label="You're in a room"
                  />
                ) : (
                  item.count &&
                  count > 0 && <span className="shrink-0 text-[11px] text-tertiary">{count}</span>
                )}
              </Link>
            );
            return isMobile ? (
              <SheetClose asChild key={item.name}>
                {row}
              </SheetClose>
            ) : (
              row
            );
          })}
        </nav>

        <div className="flex-1" />

        {/* Footer: theme toggle, user/profile row, sign out */}
        <div className="flex flex-col gap-1.5 px-0.5">
          <button
            type="button"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="flex items-center justify-between rounded-md border border-border bg-card px-2 py-[5px] text-[13px] text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
          >
            <span>{resolvedTheme === "dark" ? "◐ Dark" : "◑ Light"}</span>
            <Kbd>T</Kbd>
          </button>
          {isMobile ? <SheetClose asChild>{profileRow}</SheetClose> : profileRow}
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2.5 rounded-md px-2 py-[5px] text-[13px] text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
          >
            <LogOut className="h-[15px] w-[15px] shrink-0 opacity-80" />
            <span>Log out</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-[212px] shrink-0 border-r border-border md:flex md:flex-col">
        {sidebarContent()}
      </aside>

      <main className="min-w-0 flex-1 overflow-auto">
        <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur md:hidden">
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2.5">
              <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Open navigation menu">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[248px] p-0">
                  <SheetHeader className="sr-only">
                    <SheetTitle>Navigation Menu</SheetTitle>
                    <SheetDescription>Browse pages and account actions.</SheetDescription>
                  </SheetHeader>
                  {sidebarContent(true)}
                </SheetContent>
              </Sheet>
              <span
                className="flex h-5 w-5 items-center justify-center rounded-[5px] bg-primary text-[11px] font-semibold text-primary-foreground"
                aria-hidden="true"
              >
                F
              </span>
              <span className="text-[13px] font-semibold">FlowManager</span>
            </div>
            <ThemeToggle />
          </div>
        </div>
        {children}
      </main>

      {/* One palette for every authenticated route. Pages contribute their own
          commands through useRegisterPaletteCommands; a page that needs a
          richer palette (Tasks searches tasks) claims it and renders its own. */}
      {!isPaletteClaimed && (
        <ModuleCommandPalette
          open={isPaletteOpen}
          onOpenChange={setPaletteOpen}
          contextHeading={paletteHeading}
          commands={paletteCommands}
        />
      )}
    </div>
  );
}
