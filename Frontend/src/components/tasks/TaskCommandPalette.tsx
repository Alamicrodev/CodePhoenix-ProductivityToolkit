import { useEffect, useState } from "react";
import { Grid2X2, List, Plus, Sparkles, Tag, Timer } from "lucide-react";
import { Task } from "../../context/DataContext";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "../ui/command";

interface TaskCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  viewMode: "list" | "matrix";
  allTags: string[];
  onQuickAdd: () => void;
  onNewDetailedTask: () => void;
  onSwitchView: (view: "list" | "matrix") => void;
  onAutoCategorize: () => void;
  onEditTask: (task: Task) => void;
  onFilterTag: (tag: string) => void;
  onStartFocus: (task: Task) => void;
}

type PalettePage = "root" | "focus";

/** ⌘K palette: commands, fuzzy jump-to-task search, and a pick-a-task page for focus. */
export function TaskCommandPalette({
  open,
  onOpenChange,
  tasks,
  viewMode,
  allTags,
  onQuickAdd,
  onNewDetailedTask,
  onSwitchView,
  onAutoCategorize,
  onEditTask,
  onFilterTag,
  onStartFocus,
}: TaskCommandPaletteProps) {
  const [page, setPage] = useState<PalettePage>("root");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      setPage("root");
      setSearch("");
    }
  }, [open]);

  const run = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  const goToPage = (next: PalettePage) => {
    setPage(next);
    setSearch("");
  };

  const activeTasks = tasks.filter(task => !task.completed);
  const completedTasks = tasks.filter(task => task.completed);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command palette"
      description="Type a command or search tasks"
    >
      <CommandInput
        value={search}
        onValueChange={setSearch}
        placeholder={page === "focus" ? "Pick a task to focus on…" : "Type a command or search tasks…"}
        onKeyDown={event => {
          // Backspace on an empty query steps back to the root page.
          if (page !== "root" && event.key === "Backspace" && search === "") {
            event.preventDefault();
            goToPage("root");
          }
        }}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {page === "root" && (
          <>
            <CommandGroup heading="Commands">
              <CommandItem onSelect={() => run(onQuickAdd)}>
                <Plus />
                New task
                <CommandShortcut>C</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => run(onNewDetailedTask)}>
                <Plus />
                New detailed task…
              </CommandItem>
              {activeTasks.length > 0 && (
                <CommandItem onSelect={() => goToPage("focus")}>
                  <Timer />
                  Start focus session with…
                </CommandItem>
              )}
              {viewMode === "list" ? (
                <CommandItem onSelect={() => run(() => onSwitchView("matrix"))}>
                  <Grid2X2 />
                  Switch to matrix view
                  <CommandShortcut>V</CommandShortcut>
                </CommandItem>
              ) : (
                <CommandItem onSelect={() => run(() => onSwitchView("list"))}>
                  <List />
                  Switch to list view
                  <CommandShortcut>V</CommandShortcut>
                </CommandItem>
              )}
              <CommandItem onSelect={() => run(onAutoCategorize)}>
                <Sparkles />
                Auto-categorize tasks
              </CommandItem>
            </CommandGroup>
            {allTags.length > 0 && (
              <CommandGroup heading="Filter by tag">
                {allTags.map(tag => (
                  <CommandItem key={tag} value={`tag-${tag}`} onSelect={() => run(() => onFilterTag(tag))}>
                    <Tag />
                    #{tag}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {activeTasks.length > 0 && (
              <CommandGroup heading="Tasks">
                {activeTasks.map(task => (
                  <CommandItem
                    key={task.id}
                    value={`task-${task.id} ${task.title}`}
                    onSelect={() => run(() => onEditTask(task))}
                  >
                    <span className="truncate">{task.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {completedTasks.length > 0 && (
              <CommandGroup heading="Completed">
                {completedTasks.map(task => (
                  <CommandItem
                    key={task.id}
                    value={`task-${task.id} ${task.title}`}
                    onSelect={() => run(() => onEditTask(task))}
                  >
                    <span className="truncate text-muted-foreground line-through">{task.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}
        {page === "focus" && (
          <CommandGroup heading="Start focus session with">
            {activeTasks.map(task => (
              <CommandItem
                key={task.id}
                value={`focus-${task.id} ${task.title}`}
                onSelect={() => run(() => onStartFocus(task))}
              >
                <Timer />
                <span className="truncate">{task.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
