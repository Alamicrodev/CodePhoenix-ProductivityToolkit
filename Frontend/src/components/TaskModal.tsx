import { useState, useEffect } from "react";
import { useData, Task } from "../context/DataContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Sparkles, Plus, X, AlertCircle } from "lucide-react";
import { Checkbox } from "./ui/checkbox";
import { DateInput } from "./ui/date-input";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task?: Task;
}

interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  priority: "low" | "medium" | "high";
  dueDate: string | null;
  dueTime: string | null;
}

export function TaskModal({ isOpen, onClose, task }: TaskModalProps) {
  const { addTask, updateTask, deleteTask } = useData();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [subtaskInput, setSubtaskInput] = useState("");
  const [subtaskPriority, setSubtaskPriority] = useState<"low" | "medium" | "high">("medium");
  const [subtaskDueDate, setSubtaskDueDate] = useState("");
  const [subtaskDueTime, setSubtaskDueTime] = useState("");
  const [dueDateError, setDueDateError] = useState<string>("");

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setPriority(task.priority);
      setDueDate(task.dueDate || "");
      setDueTime(task.dueTime || "");
      setSubtasks(task.subtasks);
    } else {
      resetForm();
    }
  }, [task, isOpen]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setDueDate("");
    setDueTime("");
    setSubtasks([]);
    setSubtaskInput("");
    setSubtaskPriority("medium");
    setSubtaskDueDate("");
    setSubtaskDueTime("");
    setDueDateError("");
  };

  const validateSubtaskDateTime = (
    subtaskDate: string,
    subtaskTime: string | null,
    parentDate: string,
    parentTime: string | null
  ): boolean => {
    if (!subtaskDate || !parentDate) return true;
    
    const subtaskDateTime = new Date(`${subtaskDate}T${subtaskTime || "23:59"}`);
    const parentDateTime = new Date(`${parentDate}T${parentTime || "23:59"}`);
    
    return subtaskDateTime <= parentDateTime;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all subtask due dates
    if (dueDate) {
      for (const subtask of subtasks) {
        if (subtask.dueDate && !validateSubtaskDateTime(subtask.dueDate, subtask.dueTime, dueDate, dueTime)) {
          setDueDateError(`Subtask "${subtask.title}" has a due date later than the parent task`);
          return;
        }
      }
    }

    const taskData = {
      title,
      description,
      priority,
      dueDate: dueDate || null,
      dueTime: dueTime || null,
      tags: [],
      subtasks,
      completed: task?.completed || false,
      completedAt: task?.completedAt || null,
    };

    if (task) {
      await updateTask(task.id, taskData);
    } else {
      await addTask(taskData);
    }

    onClose();
  };

  const handleDelete = async () => {
    if (task && confirm("Are you sure you want to delete this task?")) {
      await deleteTask(task.id);
      onClose();
    }
  };

  const addSubtask = () => {
    if (subtaskInput.trim()) {
      // Validate subtask due date against parent
      if (subtaskDueDate && dueDate && !validateSubtaskDateTime(subtaskDueDate, subtaskDueTime, dueDate, dueTime)) {
        setDueDateError("Subtask due date cannot be later than parent task due date");
        return;
      }

      setSubtasks([
        ...subtasks,
        {
          id: Date.now().toString(),
          title: subtaskInput.trim(),
          completed: false,
          priority: subtaskPriority,
          dueDate: subtaskDueDate || null,
          dueTime: subtaskDueTime || null,
        },
      ]);
      setSubtaskInput("");
      setSubtaskPriority("medium");
      setSubtaskDueDate("");
      setSubtaskDueTime("");
      setDueDateError("");
    }
  };

  const removeSubtask = (id: string) => {
    setSubtasks(subtasks.filter(st => st.id !== id));
  };

  const toggleSubtask = (id: string) => {
    setSubtasks(
      subtasks.map(st => (st.id === id ? { ...st, completed: !st.completed } : st))
    );
  };

  const updateSubtaskField = (id: string, field: keyof Subtask, value: any) => {
    // Validate if updating due date
    if (field === "dueDate" && value && dueDate && !validateSubtaskDateTime(value, subtaskDueTime, dueDate, dueTime)) {
      setDueDateError("Subtask due date cannot be later than parent task due date");
      return;
    }
    
    setSubtasks(
      subtasks.map(st => (st.id === id ? { ...st, [field]: value } : st))
    );
    setDueDateError("");
  };

  const handleParentDueDateChange = (newDueDate: string) => {
    setDueDate(newDueDate);
    
    // Check if any existing subtasks violate the new parent due date
    if (newDueDate) {
      const violations = subtasks.filter(
        st => st.dueDate && !validateSubtaskDateTime(st.dueDate, st.dueTime, newDueDate, dueTime)
      );
      if (violations.length > 0) {
        setDueDateError(
          `${violations.length} subtask(s) have due dates later than the new parent due date`
        );
      } else {
        setDueDateError("");
      }
    } else {
      setDueDateError("");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? "Edit Task" : "Create New Task"}</DialogTitle>
          <DialogDescription>
            {task ? "Edit the details of your task." : "Create a new task."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* AI Input Field */}
          <div className="space-y-2">
            <Label>Task Title</Label>
            <div className="relative">
              <Sparkles className="absolute left-3 top-3.5 w-5 h-5 text-blue-600 dark:text-blue-400" />
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g., Complete project proposal, Review design mockups..."
                className="pl-11 h-12"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add more details..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date (Optional)</Label>
              <DateInput
                id="dueDate"
                value={dueDate}
                onChange={e => handleParentDueDateChange(e.target.value)}
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="dueTime">Due Time (Optional)</Label>
              <Input
                id="dueTime"
                type="time"
                value={dueTime}
                onChange={e => setDueTime(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          {/* Due Date Error Message */}
          {dueDateError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-600 dark:text-red-400">{dueDateError}</p>
            </div>
          )}

          {/* Subtasks */}
          <div className="space-y-3">
            <Label>Subtasks</Label>
            
            {/* Add Subtask Form */}
            <div className="space-y-3 p-4 bg-accent/50 rounded-lg border border-border">
              <Input
                value={subtaskInput}
                onChange={e => setSubtaskInput(e.target.value)}
                placeholder="Add a subtask..."
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSubtask())}
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Subtask Priority</Label>
                  <Select value={subtaskPriority} onValueChange={(v: any) => setSubtaskPriority(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Subtask Due Date</Label>
                  <DateInput
                    value={subtaskDueDate}
                    onChange={e => setSubtaskDueDate(e.target.value)}
                    max={dueDate || undefined}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Subtask Due Time</Label>
                  <Input
                    type="time"
                    value={subtaskDueTime}
                    onChange={e => setSubtaskDueTime(e.target.value)}
                  />
                </div>
              </div>
              <Button type="button" onClick={addSubtask} className="w-full gap-2">
                <Plus className="w-4 h-4" />
                Add Subtask
              </Button>
            </div>

            {/* Existing Subtasks */}
            {subtasks.length > 0 && (
              <div className="space-y-2">
                {subtasks.map(subtask => (
                  <div
                    key={subtask.id}
                    className="p-3 rounded-lg bg-card border border-border space-y-2"
                  >
                    <div className="flex items-start gap-2">
                      <Checkbox
                        checked={subtask.completed}
                        onCheckedChange={() => toggleSubtask(subtask.id)}
                        className="mt-1"
                      />
                      <span
                        className={`flex-1 text-sm ${
                          subtask.completed ? "line-through text-muted-foreground" : ""
                        }`}
                      >
                        {subtask.title}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeSubtask(subtask.id)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pl-7">
                      <Select
                        value={subtask.priority}
                        onValueChange={v => updateSubtaskField(subtask.id, "priority", v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                      <DateInput
                        value={subtask.dueDate || ""}
                        onChange={e => updateSubtaskField(subtask.id, "dueDate", e.target.value || null)}
                        className="h-8 text-xs"
                        max={dueDate || undefined}
                      />
                      <Input
                        type="time"
                        value={subtask.dueTime || ""}
                        onChange={e => updateSubtaskField(subtask.id, "dueTime", e.target.value || null)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            {task && (
              <Button type="button" variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!!dueDateError}>
              {task ? "Update" : "Create"} Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
