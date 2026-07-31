import { useMemo, useRef, useState } from "react";
import { useData, Task } from "../context/DataContext";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Plus } from "lucide-react";
import { compareByDueDate } from "../lib/taskDates";
import { parseQuickAdd } from "../lib/quickAdd";
import { CircleCheckbox } from "./tasks/CircleCheckbox";
import { DueLabel } from "./tasks/DueLabel";
import { PriorityBars } from "./tasks/PriorityBars";
import { useCompleteTask } from "./tasks/useCompleteTask";

type Quadrant = NonNullable<Task["quadrant"]>;

const QUADRANTS: Array<{
  key: Quadrant;
  name: string;
  hint: string;
  dotClass: string;
}> = [
  { key: "urgent-important", name: "Do first", hint: "Urgent & important", dotClass: "bg-priority-high" },
  { key: "not-urgent-important", name: "Schedule", hint: "Not urgent & important", dotClass: "bg-primary" },
  { key: "urgent-not-important", name: "Delegate", hint: "Urgent & not important", dotClass: "bg-priority-medium" },
  { key: "not-urgent-not-important", name: "Eliminate", hint: "Not urgent & not important", dotClass: "bg-tertiary" },
];

function MatrixRow({ task, onEdit }: { task: Task; onEdit: () => void }) {
  const toggleComplete = useCompleteTask();
  const [{ isDragging }, drag] = useDrag({
    type: "TASK",
    item: { id: task.id },
    collect: monitor => ({ isDragging: monitor.isDragging() }),
  });

  return (
    <div
      // react-dnd connectors aren't typed as React refs; wrap in a callback ref
      ref={node => {
        drag(node);
      }}
      onClick={onEdit}
      className={`flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-accent/50 ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <CircleCheckbox
        checked={task.completed}
        onToggle={() => void toggleComplete(task)}
        label={`Complete task: ${task.title}`}
        size="sm"
      />
      <PriorityBars priority={task.priority} />
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{task.title}</span>
      <DueLabel dueDate={task.dueDate} dueTime={task.dueTime} size="sm" />
    </div>
  );
}

function InlineQuadrantAdd({ quadrant, name }: { quadrant: Quadrant; name: string }) {
  const { addTask } = useData();
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const parsed = parseQuickAdd(draft);
    if (!parsed.title) {
      return;
    }
    void addTask({
      title: parsed.title,
      description: "",
      completed: false,
      completedAt: null,
      durationMinutes: null,
      priority: parsed.priority,
      dueDate: parsed.dueDate,
      dueTime: null,
      tags: [],
      subtasks: [],
      quadrant,
    });
    setDraft("");
    inputRef.current?.focus();
  };

  if (!isAdding) {
    return (
      <button
        type="button"
        onClick={() => setIsAdding(true)}
        className="flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-left text-[11.5px] text-tertiary transition-colors hover:bg-accent/50 hover:text-foreground"
      >
        <Plus className="h-3 w-3" />
        Add to {name}
      </button>
    );
  }

  return (
    <form
      onSubmit={event => {
        event.preventDefault();
        submit();
      }}
    >
      <input
        ref={inputRef}
        autoFocus
        value={draft}
        onChange={event => setDraft(event.target.value)}
        onKeyDown={event => {
          if (event.key === "Escape") {
            setDraft("");
            setIsAdding(false);
          }
        }}
        onBlur={() => {
          if (!draft.trim()) {
            setIsAdding(false);
          }
        }}
        placeholder={`Add to ${name}…`}
        aria-label={`Add task to ${name}`}
        className="w-full rounded-md border border-border bg-background px-2 py-1 text-[12.5px] outline-none placeholder:text-tertiary focus:border-ring/60"
      />
    </form>
  );
}

interface QuadrantPanelProps {
  quadrant: (typeof QUADRANTS)[number];
  tasks: Task[];
  onDrop: (taskId: string, quadrant: Quadrant) => void;
  onTaskEdit: (task: Task) => void;
}

function QuadrantPanel({ quadrant, tasks, onDrop, onTaskEdit }: QuadrantPanelProps) {
  const [{ isOver }, drop] = useDrop({
    accept: "TASK",
    drop: (item: { id: string }) => {
      onDrop(item.id, quadrant.key);
    },
    collect: monitor => ({ isOver: monitor.isOver() }),
  });

  const sortedTasks = [...tasks].sort(compareByDueDate);

  return (
    <div
      // react-dnd connectors aren't typed as React refs; wrap in a callback ref
      ref={node => {
        drop(node);
      }}
      className={`flex min-h-[240px] flex-col rounded-xl border bg-card transition-colors ${
        isOver ? "border-primary/60 bg-accent/30" : "border-border"
      }`}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${quadrant.dotClass}`} />
        <span className="text-xs font-semibold">{quadrant.name}</span>
        <span className="min-w-0 truncate text-[11.5px] text-tertiary">{quadrant.hint}</span>
        <span className="ml-auto rounded-full bg-muted px-1.5 py-px text-[11px] text-muted-foreground">
          {tasks.length}
        </span>
      </div>
      <div className="flex-1 p-1.5">
        {sortedTasks.map(task => (
          <MatrixRow key={task.id} task={task} onEdit={() => onTaskEdit(task)} />
        ))}
        <InlineQuadrantAdd quadrant={quadrant.key} name={quadrant.name} />
      </div>
    </div>
  );
}

interface EisenhowerMatrixProps {
  onTaskEdit: (task: Task) => void;
  activeTasks: Task[];
}

export function EisenhowerMatrix({ onTaskEdit, activeTasks }: EisenhowerMatrixProps) {
  const { updateTask } = useData();

  const tasksByQuadrant = useMemo(() => {
    const groups = new Map<Quadrant, Task[]>(QUADRANTS.map(q => [q.key, []]));
    const uncategorized: Task[] = [];
    activeTasks.forEach(task => {
      if (task.quadrant) {
        groups.get(task.quadrant)?.push(task);
      } else {
        uncategorized.push(task);
      }
    });
    return { groups, uncategorized };
  }, [activeTasks]);

  const handleDrop = (taskId: string, quadrant: Quadrant) => {
    void updateTask(taskId, { quadrant });
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex h-full flex-col gap-3">
        {tasksByQuadrant.uncategorized.length > 0 && (
          <div className="rounded-xl border border-border bg-muted/30 p-2">
            <h4 className="mb-1 px-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-tertiary">
              Uncategorized · {tasksByQuadrant.uncategorized.length}
            </h4>
            <div className="grid grid-cols-1 gap-x-3 md:grid-cols-2 xl:grid-cols-3">
              {tasksByQuadrant.uncategorized.map(task => (
                <MatrixRow key={task.id} task={task} onEdit={() => onTaskEdit(task)} />
              ))}
            </div>
          </div>
        )}

        <div className="grid flex-1 grid-cols-1 gap-3 lg:grid-cols-2">
          {QUADRANTS.map(quadrant => (
            <QuadrantPanel
              key={quadrant.key}
              quadrant={quadrant}
              tasks={tasksByQuadrant.groups.get(quadrant.key) ?? []}
              onDrop={handleDrop}
              onTaskEdit={onTaskEdit}
            />
          ))}
        </div>
      </div>
    </DndProvider>
  );
}
