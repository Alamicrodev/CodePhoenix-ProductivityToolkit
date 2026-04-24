import { useMemo, useState } from "react";
import { useData, Task } from "../contexts/DataContext";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Calendar, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "./ui/button";

interface DraggableTaskCardProps {
  task: Task;
  onEdit: () => void;
}

const DraggableTaskCard = ({ task, onEdit }: DraggableTaskCardProps) => {
  const [{ isDragging }, drag] = useDrag({
    type: "TASK",
    item: { id: task.id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900";
      case "medium":
        return "bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900";
      case "low":
        return "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-700";
      default:
        return "";
    }
  };

  const formatTime = (time: string | null) => {
    if (!time) return "";
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date(new Date().setHours(0, 0, 0, 0));
  };

  return (
    <div
      ref={drag}
      className={`bg-card border border-border rounded-lg p-3 hover:shadow-md transition-all cursor-move ${
        isDragging ? "opacity-50" : ""
      }`}
      onClick={onEdit}
    >
      <h4 className="font-medium text-sm mb-2 line-clamp-2">{task.title}</h4>
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${getPriorityColor(
            task.priority
          )}`}
        >
          {task.priority}
        </span>
        {task.dueDate && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            {new Date(task.dueDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
            {task.dueTime && <span>· {formatTime(task.dueTime)}</span>}
            {isOverdue(task.dueDate) && <AlertCircle className="w-3 h-3 text-red-500" />}
          </span>
        )}
      </div>
    </div>
  );
};

interface QuadrantProps {
  title: string;
  subtitle: string;
  tasks: Task[];
  quadrantType: Task["quadrant"];
  onDrop: (taskId: string, quadrant: Task["quadrant"]) => void;
  onTaskEdit: (task: Task) => void;
  bgColor: string;
}

const Quadrant = ({
  title,
  subtitle,
  tasks,
  quadrantType,
  onDrop,
  onTaskEdit,
  bgColor,
}: QuadrantProps) => {
  const [{ isOver }, drop] = useDrop({
    accept: "TASK",
    drop: (item: { id: string }) => {
      onDrop(item.id, quadrantType);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  return (
    <div
      ref={drop}
      className={`border-2 rounded-xl p-4 min-h-[300px] transition-all ${
        isOver ? "border-primary bg-accent/30" : "border-border"
      } ${bgColor}`}
    >
      <div className="mb-4">
        <h3 className="font-semibold text-lg">{title}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="space-y-2">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <DraggableTaskCard key={task.id} task={task} onEdit={() => onTaskEdit(task)} />
          ))
        ) : (
          <p className="text-center py-8 text-muted-foreground text-sm">
            Drag tasks here or they will be auto-categorized
          </p>
        )}
      </div>
    </div>
  );
};

interface EisenhowerMatrixProps {
  onTaskEdit: (task: Task) => void;
  activeTasks: Task[];
}

export function EisenhowerMatrix({ onTaskEdit, activeTasks }: EisenhowerMatrixProps) {
  const { updateTask } = useData();
  const [autoCategorizeTrigger, setAutoCategorizeTrigger] = useState(0);

  // Auto-categorize tasks based on due date and priority
  const autoCategorizeTasks = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await Promise.all(activeTasks.map(async (task) => {
      // Skip if task already has a quadrant assigned
      if (task.quadrant) return;

      let quadrant: Task["quadrant"];

      // Determine urgency based on due date
      const isUrgent = (() => {
        if (!task.dueDate) return false;
        const dueDate = new Date(task.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays <= 2; // Urgent if due within 2 days
      })();

      // Determine importance based on priority
      const isImportant = task.priority === "high" || task.priority === "medium";

      // Assign quadrant
      if (isUrgent && isImportant) {
        quadrant = "urgent-important";
      } else if (!isUrgent && isImportant) {
        quadrant = "not-urgent-important";
      } else if (isUrgent && !isImportant) {
        quadrant = "urgent-not-important";
      } else {
        quadrant = "not-urgent-not-important";
      }

      await updateTask(task.id, { quadrant });
    }));

    setAutoCategorizeTrigger((prev) => prev + 1);
  };

  // Group tasks by quadrant
  const tasksByQuadrant = useMemo(() => {
    return {
      "urgent-important": activeTasks.filter((t) => t.quadrant === "urgent-important"),
      "not-urgent-important": activeTasks.filter((t) => t.quadrant === "not-urgent-important"),
      "urgent-not-important": activeTasks.filter((t) => t.quadrant === "urgent-not-important"),
      "not-urgent-not-important": activeTasks.filter(
        (t) => t.quadrant === "not-urgent-not-important"
      ),
      uncategorized: activeTasks.filter((t) => !t.quadrant),
    };
  }, [activeTasks, autoCategorizeTrigger]);

  const handleDrop = async (taskId: string, quadrant: Task["quadrant"]) => {
    await updateTask(taskId, { quadrant });
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="space-y-4">
        {/* Auto-categorize button */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-1">Eisenhower Matrix</h3>
            <p className="text-sm text-muted-foreground">
              Organize tasks by urgency and importance
            </p>
          </div>
          <Button onClick={autoCategorizeTasks} variant="outline" className="gap-2">
            <Sparkles className="w-4 h-4" />
            Auto-Categorize
          </Button>
        </div>

        {/* Uncategorized tasks */}
        {tasksByQuadrant.uncategorized.length > 0 && (
          <div className="bg-muted/30 border border-border rounded-lg p-4">
            <h4 className="font-medium text-sm mb-3 text-muted-foreground">
              Uncategorized Tasks ({tasksByQuadrant.uncategorized.length})
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {tasksByQuadrant.uncategorized.map((task) => (
                <DraggableTaskCard key={task.id} task={task} onEdit={() => onTaskEdit(task)} />
              ))}
            </div>
          </div>
        )}

        {/* 2x2 Matrix Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Q1: Urgent & Important (DO FIRST) */}
          <Quadrant
            title="🔥 Do First"
            subtitle="Urgent & Important"
            tasks={tasksByQuadrant["urgent-important"]}
            quadrantType="urgent-important"
            onDrop={handleDrop}
            onTaskEdit={onTaskEdit}
            bgColor="bg-red-50/50 dark:bg-red-950/10"
          />

          {/* Q2: Not Urgent & Important (SCHEDULE) */}
          <Quadrant
            title="📅 Schedule"
            subtitle="Not Urgent & Important"
            tasks={tasksByQuadrant["not-urgent-important"]}
            quadrantType="not-urgent-important"
            onDrop={handleDrop}
            onTaskEdit={onTaskEdit}
            bgColor="bg-blue-50/50 dark:bg-blue-950/10"
          />

          {/* Q3: Urgent & Not Important (DELEGATE) */}
          <Quadrant
            title="🤝 Delegate"
            subtitle="Urgent & Not Important"
            tasks={tasksByQuadrant["urgent-not-important"]}
            quadrantType="urgent-not-important"
            onDrop={handleDrop}
            onTaskEdit={onTaskEdit}
            bgColor="bg-yellow-50/50 dark:bg-yellow-950/10"
          />

          {/* Q4: Not Urgent & Not Important (ELIMINATE) */}
          <Quadrant
            title="🗑️ Eliminate"
            subtitle="Not Urgent & Not Important"
            tasks={tasksByQuadrant["not-urgent-not-important"]}
            quadrantType="not-urgent-not-important"
            onDrop={handleDrop}
            onTaskEdit={onTaskEdit}
            bgColor="bg-gray-50/50 dark:bg-gray-800/10"
          />
        </div>
      </div>
    </DndProvider>
  );
}
