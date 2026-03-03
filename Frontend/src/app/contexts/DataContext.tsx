import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface Task {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  completedAt: string | null;
  priority: "low" | "medium" | "high";
  dueDate: string | null;
  dueTime: string | null;
  subtasks: { 
    id: string; 
    title: string; 
    completed: boolean;
    priority: "low" | "medium" | "high";
    dueDate: string | null;
    dueTime: string | null;
  }[];
  tags: string[];
  quadrant?: "urgent-important" | "not-urgent-important" | "urgent-not-important" | "not-urgent-not-important";
}

export interface Habit {
  id: string;
  title: string;
  description: string;
  frequency: "hourly" | "daily" | "weekly";
  hourlyInterval?: number; // For hourly habits: 1, 2, 3, 4, 5, 6, etc. (in hours)
  activeHours?: { start: string; end: string }; // For hourly habits: e.g., { start: "07:00", end: "22:00" }
  activeDays?: number[]; // Days of week: 0=Sunday, 1=Monday, ..., 6=Saturday
  streak: number;
  lastCompleted: string | null;
  completedDates: string[];
  occurrences?: Array<{
    timestamp: string;
    status: "completed" | "skipped" | "missed";
  }>;
}

export interface FocusSession {
  id: string;
  taskId?: string;
  habitId?: string;
  duration: number; // in minutes
  completed: boolean;
  startTime: string;
  endTime?: string;
}

interface DataContextType {
  tasks: Task[];
  habits: Habit[];
  focusSessions: FocusSession[];
  addTask: (task: Omit<Task, "id">) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  addHabit: (habit: Omit<Habit, "id">) => void;
  updateHabit: (id: string, updates: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;
  completeHabit: (id: string) => string | null;
  undoCompleteHabit: (id: string, completionTimestamp: string) => void;
  addFocusSession: (session: Omit<FocusSession, "id">) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>([]);

  // Load data from localStorage
  useEffect(() => {
    const storedTasks = localStorage.getItem("tasks");
    const storedHabits = localStorage.getItem("habits");
    const storedSessions = localStorage.getItem("focusSessions");

    if (storedTasks) {
      setTasks(JSON.parse(storedTasks));
    } else {
      // Initialize with sample data
      const sampleTasks: Task[] = [
        {
          id: "1",
          title: "Review quarterly goals and update roadmap",
          description: "Analyze Q1 performance and plan for Q2",
          completed: false,
          completedAt: null,
          priority: "high",
          dueDate: new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
          dueTime: "10:00",
          subtasks: [
            { 
              id: "1-1", 
              title: "Gather Q1 metrics", 
              completed: true,
              priority: "high",
              dueDate: new Date(Date.now() + 1 * 86400000).toISOString().split("T")[0],
              dueTime: "09:00"
            },
            { 
              id: "1-2", 
              title: "Schedule team review", 
              completed: false,
              priority: "medium",
              dueDate: new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0],
              dueTime: "11:00"
            },
          ],
          tags: [],
        },
        {
          id: "2",
          title: "Prepare presentation for team meeting",
          description: "Create slides for the weekly sync",
          completed: true,
          completedAt: new Date(Date.now() - 86400000 + 3600000).toISOString(), // Yesterday at +1 hour
          priority: "medium",
          dueDate: new Date(Date.now() - 86400000).toISOString().split("T")[0],
          dueTime: "14:00",
          subtasks: [],
          tags: [],
        },
        {
          id: "3",
          title: "Update project documentation",
          description: "Add new features to the docs",
          completed: false,
          completedAt: null,
          priority: "low",
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
          dueTime: "09:30",
          subtasks: [
            { 
              id: "3-1", 
              title: "Update API docs", 
              completed: false,
              priority: "low",
              dueDate: new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0],
              dueTime: "10:00"
            },
          ],
          tags: [],
        },
        {
          id: "4",
          title: "Complete code review",
          description: "Review pull requests from team members",
          completed: false,
          completedAt: null,
          priority: "high",
          dueDate: new Date().toISOString().split("T")[0],
          dueTime: "15:00",
          subtasks: [],
          tags: [],
        },
      ];
      setTasks(sampleTasks);
    }

    if (storedHabits) {
      setHabits(JSON.parse(storedHabits));
    } else {
      // Initialize with sample data
      const sampleHabits: Habit[] = [
        {
          id: "1",
          title: "Morning Meditation",
          description: "10 minutes of mindfulness practice",
          frequency: "daily",
          streak: 5,
          lastCompleted: new Date(Date.now() - 86400000).toISOString().split("T")[0],
          completedDates: [
            new Date(Date.now() - 86400000).toISOString().split("T")[0],
            new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0],
          ],
        },
        {
          id: "2",
          title: "Exercise",
          description: "30 minutes of physical activity",
          frequency: "daily",
          streak: 3,
          lastCompleted: new Date(Date.now() - 86400000).toISOString().split("T")[0],
          completedDates: [new Date(Date.now() - 86400000).toISOString().split("T")[0]],
        },
      ];
      setHabits(sampleHabits);
    }

    if (storedSessions) {
      setFocusSessions(JSON.parse(storedSessions));
    } else {
      // Initialize with sample data
      const sampleSessions: FocusSession[] = [
        {
          id: "1",
          duration: 25,
          completed: true,
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
        },
      ];
      setFocusSessions(sampleSessions);
    }
  }, []);

  // Save tasks to localStorage
  useEffect(() => {
    if (tasks.length > 0 || localStorage.getItem("tasks")) {
      localStorage.setItem("tasks", JSON.stringify(tasks));
    }
  }, [tasks]);

  // Save habits to localStorage
  useEffect(() => {
    if (habits.length > 0 || localStorage.getItem("habits")) {
      localStorage.setItem("habits", JSON.stringify(habits));
    }
  }, [habits]);

  // Save focus sessions to localStorage
  useEffect(() => {
    if (focusSessions.length > 0 || localStorage.getItem("focusSessions")) {
      localStorage.setItem("focusSessions", JSON.stringify(focusSessions));
    }
  }, [focusSessions]);

  const addTask = (task: Omit<Task, "id">) => {
    const newTask = { ...task, id: Date.now().toString() };
    setTasks([...tasks, newTask]);
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks(tasks.map(task => task.id === id ? { ...task, ...updates } : task));
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter(task => task.id !== id));
  };

  const addHabit = (habit: Omit<Habit, "id">) => {
    const newHabit = { ...habit, id: Date.now().toString() };
    setHabits([...habits, newHabit]);
  };

  const updateHabit = (id: string, updates: Partial<Habit>) => {
    setHabits(habits.map(habit => habit.id === id ? { ...habit, ...updates } : habit));
  };

  const deleteHabit = (id: string) => {
    setHabits(habits.filter(habit => habit.id !== id));
  };

  const completeHabit = (id: string): string | null => {
    const today = new Date().toISOString().split("T")[0];
    const currentHour = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH format
    
    let completionTimestamp: string | null = null;
    
    setHabits(habits.map(habit => {
      if (habit.id === id) {
        // For hourly habits, check if already completed this hour
        // For other habits, check if already completed today
        const alreadyCompleted = habit.frequency === "hourly"
          ? habit.completedDates.some(date => date.startsWith(currentHour))
          : habit.completedDates.includes(today);
        
        if (alreadyCompleted) return habit;
        
        // Store full ISO timestamp for hourly habits, just date for others
        completionTimestamp = habit.frequency === "hourly" 
          ? new Date().toISOString() 
          : today;
        
        return {
          ...habit,
          streak: habit.streak + 1,
          lastCompleted: today,
          completedDates: [...habit.completedDates, completionTimestamp],
        };
      }
      return habit;
    }));
    
    return completionTimestamp;
  };

  const undoCompleteHabit = (id: string, completionTimestamp: string) => {
    setHabits(habits.map(habit => {
      if (habit.id === id) {
        const newCompletedDates = habit.completedDates.filter(date => date !== completionTimestamp);
        const newStreak = newCompletedDates.length;
        const newLastCompleted = newCompletedDates.length > 0 ? newCompletedDates[newCompletedDates.length - 1] : null;
        
        return {
          ...habit,
          streak: newStreak,
          lastCompleted: newLastCompleted,
          completedDates: newCompletedDates,
        };
      }
      return habit;
    }));
  };

  const addFocusSession = (session: Omit<FocusSession, "id">) => {
    const newSession = { ...session, id: Date.now().toString() };
    setFocusSessions([...focusSessions, newSession]);
  };

  return (
    <DataContext.Provider
      value={{
        tasks,
        habits,
        focusSessions,
        addTask,
        updateTask,
        deleteTask,
        addHabit,
        updateHabit,
        deleteHabit,
        completeHabit,
        undoCompleteHabit,
        addFocusSession,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}