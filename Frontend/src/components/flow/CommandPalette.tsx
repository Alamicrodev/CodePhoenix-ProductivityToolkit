import { useMemo, useState } from "react";
import { Plus, Grid2X2, List, Sparkles, SunMoon, CheckSquare } from "lucide-react";
import { Task } from "../../context/DataContext";
import { KbdChip } from "./KbdChip";

export interface PaletteCommand {
  id: string;
  label: string;
  kbd?: string;
  icon: "new" | "matrix" | "list" | "auto" | "theme";
  run: () => void;
}

const COMMAND_ICONS = {
  new: Plus,
  matrix: Grid2X2,
  list: List,
  auto: Sparkles,
  theme: SunMoon,
} as const;

interface CommandPaletteProps {
  commands: PaletteCommand[];
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  onClose: () => void;
}

// ⌘K palette: filters commands, and searches/jumps to tasks by title.
export function CommandPalette({ commands, tasks, onSelectTask, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const { filteredCommands, filteredTasks } = useMemo(() => {
    const q = query.trim().toLowerCase();
    return {
      filteredCommands: q
        ? commands.filter(command => command.label.toLowerCase().includes(q))
        : commands,
      filteredTasks: q ? tasks.filter(task => task.title.toLowerCase().includes(q)).slice(0, 6) : [],
    };
  }, [commands, query, tasks]);

  const totalItems = filteredCommands.length + filteredTasks.length;
  const clampedIndex = Math.min(activeIndex, Math.max(totalItems - 1, 0));

  const runItem = (index: number) => {
    if (index < filteredCommands.length) {
      filteredCommands[index].run();
    } else {
      const task = filteredTasks[index - filteredCommands.length];
      if (task) onSelectTask(task);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex(index => Math.min(index + 1, totalItems - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(index => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && totalItems > 0) {
      event.preventDefault();
      runItem(clampedIndex);
    }
  };

  const rowClass = (isActive: boolean) =>
    `flex w-full cursor-pointer items-center gap-[10px] rounded-md px-2 py-[7px] text-left ${
      isActive ? "bg-[var(--f-hover)]" : "hover:bg-[var(--f-hover)]"
    }`;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center bg-black/35 pt-[14vh]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Command palette"
        className="h-fit w-[560px] max-w-[calc(100vw-32px)] overflow-hidden rounded-xl border border-[var(--f-border)] bg-[var(--f-panel)] shadow-[var(--f-shadow)]"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center gap-[10px] border-b border-[var(--f-border2)] px-[14px] py-3">
          <span className="text-[var(--f-text3)]">›</span>
          <input
            autoFocus
            value={query}
            onChange={event => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search tasks…"
            className="flex-1 border-none bg-transparent text-[14px] text-[var(--f-text)] outline-none"
          />
          <KbdChip>esc</KbdChip>
        </div>
        <div className="flex flex-col p-[6px]">
          {filteredCommands.length > 0 && (
            <div className="px-2 pb-1 pt-[6px] text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--f-text3)]">
              Commands
            </div>
          )}
          {filteredCommands.map((command, index) => {
            const Icon = COMMAND_ICONS[command.icon];
            return (
              <button
                key={command.id}
                type="button"
                className={rowClass(index === clampedIndex)}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => command.run()}
              >
                <Icon className="h-4 w-4 shrink-0 text-[var(--f-text3)]" />
                <span className="flex-1">{command.label}</span>
                {command.kbd && <KbdChip className="px-[6px]">{command.kbd}</KbdChip>}
              </button>
            );
          })}
          {filteredTasks.length > 0 && (
            <div className="px-2 pb-1 pt-[6px] text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--f-text3)]">
              Tasks
            </div>
          )}
          {filteredTasks.map((task, taskIndex) => {
            const index = filteredCommands.length + taskIndex;
            return (
              <button
                key={task.id}
                type="button"
                className={rowClass(index === clampedIndex)}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => onSelectTask(task)}
              >
                <CheckSquare className="h-4 w-4 shrink-0 text-[var(--f-text3)]" />
                <span className="flex-1 truncate">{task.title}</span>
              </button>
            );
          })}
          {totalItems === 0 && (
            <div className="px-2 py-[14px] text-center text-[12px] text-[var(--f-text3)]">
              No results
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
