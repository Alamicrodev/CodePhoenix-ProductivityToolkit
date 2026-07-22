import { useRef, useState } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Task } from "../../context/DataContext";
import {
  QUADRANT_META,
  QUADRANT_ORDER,
  Quadrant,
  effectiveQuadrant,
  formatDueLabel,
} from "../../lib/flowTasks";
import { PriorityBars } from "./PriorityBars";

interface MatrixRowProps {
  task: Task;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
}

function MatrixRow({ task, onToggle, onEdit }: MatrixRowProps) {
  const [{ isDragging }, drag] = useDrag({
    type: "FLOW_TASK",
    item: { id: task.id },
    collect: monitor => ({ isDragging: monitor.isDragging() }),
  });
  const due = formatDueLabel(task.dueDate);

  return (
    <div
      // react-dnd connectors aren't typed as React refs; wrap in a callback ref
      ref={node => {
        drag(node);
      }}
      className={`flex cursor-move items-center gap-[9px] rounded-md px-[7px] py-[5px] hover:bg-[var(--f-hover)] ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked="false"
        aria-label={`Mark done "${task.title}"`}
        title="Mark done"
        onClick={() => onToggle(task)}
        className="h-[13px] w-[13px] shrink-0 cursor-pointer rounded-full border-[1.5px] border-[var(--f-text3)] hover:border-[var(--f-done)]"
      />
      <PriorityBars priority={task.priority} compact />
      <span
        className="min-w-0 flex-1 truncate text-[12.5px] font-medium"
        onClick={() => onEdit(task)}
      >
        {task.title}
      </span>
      <span
        className="whitespace-nowrap text-[11.5px]"
        style={{ color: due?.urgent ? "var(--f-hi)" : "var(--f-text3)" }}
      >
        {due?.label ?? ""}
      </span>
    </div>
  );
}

interface QuadrantPanelProps {
  quadrant: Quadrant;
  tasks: Task[];
  onDropTask: (taskId: string, quadrant: Quadrant) => void;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onQuickAdd: (title: string, quadrant: Quadrant) => void;
}

function QuadrantPanel({ quadrant, tasks, onDropTask, onToggle, onEdit, onQuickAdd }: QuadrantPanelProps) {
  const meta = QUADRANT_META[quadrant];
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const [{ isOver }, drop] = useDrop({
    accept: "FLOW_TASK",
    drop: (item: { id: string }) => onDropTask(item.id, quadrant),
    collect: monitor => ({ isOver: monitor.isOver() }),
  });

  const submitAdd = () => {
    const title = draft.trim();
    if (title) {
      onQuickAdd(title, quadrant);
      setDraft("");
    }
    setAdding(false);
  };

  return (
    <div
      // react-dnd connectors aren't typed as React refs; wrap in a callback ref
      ref={node => {
        drop(node);
      }}
      className={`flex min-h-0 flex-col overflow-hidden rounded-[10px] border bg-[var(--f-panel)] ${
        isOver ? "border-[var(--f-accent)]" : "border-[var(--f-border)]"
      }`}
    >
      <div className="flex items-center gap-2 border-b border-[var(--f-border2)] px-3 py-[9px]">
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: `var(${meta.colorVar})` }}
        />
        <span className="text-[12.5px] font-semibold">{meta.name}</span>
        <span className="text-[11.5px] text-[var(--f-text3)]">{meta.hint}</span>
        <div className="flex-1" />
        <span className="rounded-[10px] bg-[var(--f-panel2)] px-[7px] py-[1px] text-[11px] text-[var(--f-text3)]">
          {tasks.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-[1px] overflow-y-auto px-[6px] py-[5px]">
        {tasks.map(task => (
          <MatrixRow key={task.id} task={task} onToggle={onToggle} onEdit={onEdit} />
        ))}
        {adding ? (
          <input
            ref={inputRef}
            autoFocus
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter") submitAdd();
              if (event.key === "Escape") {
                setDraft("");
                setAdding(false);
              }
            }}
            onBlur={submitAdd}
            placeholder={`Add to ${meta.name}…`}
            className="rounded-md border border-[var(--f-accent)] bg-transparent px-[7px] py-[5px] text-[12.5px] text-[var(--f-text)] outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="cursor-pointer rounded-md px-[7px] py-[6px] text-left text-[11.5px] text-[var(--f-text3)] hover:bg-[var(--f-hover)] hover:text-[var(--f-text2)]"
          >
            + Add to {meta.name}
          </button>
        )}
      </div>
    </div>
  );
}

interface FlowMatrixProps {
  activeTasks: Task[];
  onDropTask: (taskId: string, quadrant: Quadrant) => void;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onQuickAdd: (title: string, quadrant: Quadrant) => void;
}

// 2×2 Eisenhower grid; drag between quadrants reassigns the task's quadrant.
export function FlowMatrix({ activeTasks, onDropTask, onToggle, onEdit, onQuickAdd }: FlowMatrixProps) {
  return (
    <DndProvider backend={HTML5Backend}>
      <div className="grid min-h-[520px] flex-1 grid-cols-1 grid-rows-none gap-[10px] px-4 pb-10 pt-[14px] md:grid-cols-2 md:grid-rows-2">
        {QUADRANT_ORDER.map(quadrant => (
          <QuadrantPanel
            key={quadrant}
            quadrant={quadrant}
            tasks={activeTasks.filter(task => effectiveQuadrant(task) === quadrant)}
            onDropTask={onDropTask}
            onToggle={onToggle}
            onEdit={onEdit}
            onQuickAdd={onQuickAdd}
          />
        ))}
      </div>
    </DndProvider>
  );
}
