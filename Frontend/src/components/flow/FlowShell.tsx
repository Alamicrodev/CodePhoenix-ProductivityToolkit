import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useTheme } from "next-themes";
import {
  CalendarDays,
  CheckSquare,
  CircleUser,
  LayoutDashboard,
  Loader2,
  Menu,
  Plus,
  SunMoon,
  Target,
  Timer,
  Users,
  X,
} from "lucide-react";
import { useData, Task } from "../../context/DataContext";
import { useFlowPrefs } from "../../hooks/useFlowPrefs";
import { FlowSidebar } from "./FlowSidebar";
import { CommandPalette, PaletteCommand } from "./CommandPalette";
import { KbdChip } from "./KbdChip";

export interface FooterHint {
  keys: string;
  label: string;
}

const DEFAULT_HINTS: FooterHint[] = [
  { keys: "C", label: "create" },
  { keys: "⌘K", label: "commands" },
  { keys: "F", label: "focus session" },
  { keys: "G", label: "then D/H/F/C/S/P go to module" },
  { keys: "T", label: "theme" },
];

const G_NAV_TARGETS: Record<string, string> = {
  d: "/",
  t: "/tasks",
  h: "/habits",
  f: "/focus",
  c: "/cowork",
  s: "/schedule",
  p: "/profile",
};

interface FlowShellProps {
  title: ReactNode;
  meta?: ReactNode;
  /** Header content right of the flex spacer (buttons, segmented controls). */
  actions?: ReactNode;
  /** Optional 38px bar under the header (Tasks filter bar). */
  filterBar?: ReactNode;
  /** Replaces the default footer hints. */
  footerHints?: FooterHint[];
  /**
   * Single-key shortcuts, active while not typing (lowercase event.key).
   * `c` defaults to "jump to Tasks quick-add", `f` to "jump to Focus quick-add"
   * unless overridden here.
   */
  shortcuts?: Record<string, () => void>;
  /** Extra commands shown at the top of the ⌘K palette. */
  paletteExtras?: PaletteCommand[];
  /** Override for what selecting a task in the palette does. */
  onSelectPaletteTask?: (task: Task) => void;
  children: ReactNode;
}

export function FlowShell({
  title,
  meta,
  actions,
  filterBar,
  footerHints,
  shortcuts,
  paletteExtras,
  onSelectPaletteTask,
  children,
}: FlowShellProps) {
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const { tasks, isSyncing, isWorkspaceLoading, syncStatus } = useData();
  const { hints } = useFlowPrefs();

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const gPrefixRef = useRef(false);
  const gTimerRef = useRef<number | undefined>(undefined);

  const activeTasks = useMemo(() => tasks.filter(task => !task.completed), [tasks]);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  // Keep the latest handlers in a ref so the keydown listener stays stable.
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(open => !open);
        return;
      }
      if (event.key === "Escape") {
        setPaletteOpen(false);
        setMobileNavOpen(false);
        (document.activeElement as HTMLElement | null)?.blur?.();
        return;
      }

      const target = event.target as HTMLElement | null;
      const typing =
        !!target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable);
      // Radix dialogs (task edit modal) render into [role="dialog"]; keep single-key
      // shortcuts quiet while one is open.
      const dialogOpen = !!document.querySelector('[role="dialog"]:not([aria-label="Command palette"])');
      if (typing || dialogOpen || event.metaKey || event.ctrlKey || event.altKey) {
        gPrefixRef.current = false;
        return;
      }

      const key = event.key.toLowerCase();

      if (gPrefixRef.current) {
        gPrefixRef.current = false;
        window.clearTimeout(gTimerRef.current);
        const destination = G_NAV_TARGETS[key];
        if (destination) {
          event.preventDefault();
          navigate(destination);
        }
        return;
      }

      if (key === "g") {
        gPrefixRef.current = true;
        window.clearTimeout(gTimerRef.current);
        gTimerRef.current = window.setTimeout(() => {
          gPrefixRef.current = false;
        }, 1500);
        return;
      }

      const pageHandler = shortcutsRef.current?.[key];
      if (pageHandler) {
        event.preventDefault();
        pageHandler();
        return;
      }

      if (key === "t") {
        toggleTheme();
      } else if (key === "c") {
        event.preventDefault();
        navigate("/tasks", { state: { quickAdd: true } });
      } else if (key === "f") {
        event.preventDefault();
        navigate("/focus", { state: { quickAdd: true } });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(gTimerRef.current);
    };
  }, [navigate, toggleTheme]);

  const coreCommands = useMemo<PaletteCommand[]>(() => {
    const close = () => setPaletteOpen(false);
    const go = (path: string, state?: object) => () => {
      close();
      navigate(path, state ? { state } : undefined);
    };
    // Every command closes the palette when run, including page extras.
    const wrapClose = (commands: PaletteCommand[]) =>
      commands.map(command => ({
        ...command,
        run: () => {
          close();
          command.run();
        },
      }));
    return [
      ...wrapClose(paletteExtras ?? []),
      {
        id: "core-new-task",
        label: "New task",
        kbd: "C",
        icon: Plus,
        run: shortcutsRef.current?.c
          ? () => {
              close();
              shortcutsRef.current?.c?.();
            }
          : go("/tasks", { quickAdd: true }),
      },
      { id: "core-focus", label: "Start focus session", kbd: "F", icon: Timer, run: go("/focus", { quickAdd: true }) },
      { id: "core-go-dashboard", label: "Go to Dashboard", kbd: "G D", icon: LayoutDashboard, run: go("/") },
      { id: "core-go-tasks", label: "Go to Tasks", kbd: "G T", icon: CheckSquare, run: go("/tasks") },
      { id: "core-go-habits", label: "Go to Habits", kbd: "G H", icon: Target, run: go("/habits") },
      { id: "core-go-cowork", label: "Go to Cowork", kbd: "G C", icon: Users, run: go("/cowork") },
      { id: "core-go-schedule", label: "Go to Schedule", kbd: "G S", icon: CalendarDays, run: go("/schedule") },
      { id: "core-go-profile", label: "Go to Profile", kbd: "G P", icon: CircleUser, run: go("/profile") },
      {
        id: "core-theme",
        label: "Toggle theme",
        kbd: "T",
        icon: SunMoon,
        run: () => {
          toggleTheme();
          close();
        },
      },
    ];
  }, [navigate, paletteExtras, toggleTheme]);

  const handleSelectPaletteTask = useCallback(
    (task: Task) => {
      setPaletteOpen(false);
      if (onSelectPaletteTask) {
        onSelectPaletteTask(task);
      } else {
        navigate("/tasks", { state: { editTaskId: task.id } });
      }
    },
    [navigate, onSelectPaletteTask],
  );

  return (
    <div className="flow-shell flex h-screen w-full overflow-hidden">
      {/* Sidebar (desktop) */}
      <div className="hidden md:block">
        <FlowSidebar activeCount={activeTasks.length} onToggleTheme={toggleTheme} />
      </div>

      {/* Sidebar (mobile overlay) */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden" onClick={() => setMobileNavOpen(false)}>
          <div className="absolute inset-0 bg-black/35" />
          <div className="relative h-full bg-[var(--f-bg)]" onClick={event => event.stopPropagation()}>
            <FlowSidebar activeCount={activeTasks.length} onToggleTheme={toggleTheme} />
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setMobileNavOpen(false)}
              className="absolute right-2 top-3 rounded-md p-1 text-[var(--f-text2)] hover:bg-[var(--f-hover)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="flex h-[46px] shrink-0 items-center gap-3 border-b border-[var(--f-border2)] px-4">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setMobileNavOpen(true)}
            className="rounded-md p-1 text-[var(--f-text2)] hover:bg-[var(--f-hover)] md:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="whitespace-nowrap text-[13px] font-semibold">{title}</div>
          {meta && <div className="whitespace-nowrap text-[12px] text-[var(--f-text3)]">{meta}</div>}
          {(isWorkspaceLoading || isSyncing) && (
            <span className="hidden items-center gap-1 text-[11px] text-[var(--f-text3)] lg:flex">
              <Loader2 className="h-3 w-3 animate-spin" />
              {isWorkspaceLoading ? "Loading…" : syncStatus ?? "Syncing…"}
            </span>
          )}
          <div className="flex-1" />
          {actions}
        </div>

        {filterBar}

        {/* Content */}
        <div className="flex flex-1 flex-col overflow-y-auto">{children}</div>

        {/* Shortcut footer */}
        {hints && (
          <div className="hidden h-[30px] shrink-0 items-center gap-4 overflow-hidden whitespace-nowrap border-t border-[var(--f-border2)] px-4 text-[11px] text-[var(--f-text3)] md:flex">
            {(footerHints ?? DEFAULT_HINTS).map(hint => (
              <span key={hint.keys + hint.label} className="flex items-center gap-[5px]">
                <KbdChip className="py-0">{hint.keys}</KbdChip> {hint.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Command palette */}
      {paletteOpen && (
        <CommandPalette
          commands={coreCommands}
          tasks={activeTasks}
          onSelectTask={handleSelectPaletteTask}
          onClose={() => setPaletteOpen(false)}
        />
      )}
    </div>
  );
}
