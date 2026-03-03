import { useState, useEffect, useCallback } from "react";
import { useData } from "../contexts/DataContext";
import DashboardLayout from "../components/DashboardLayout";
import { Button } from "../components/ui/button";
import { PomodoroTimer } from "../components/PomodoroTimer";
import { Play, Pause, RotateCcw, CheckSquare, Target } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

export default function FocusPage() {
  const { tasks, habits, addFocusSession } = useData();
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes in seconds
  const [duration, setDuration] = useState(25);
  const [linkedTaskId, setLinkedTaskId] = useState<string>("none");
  const [linkedHabitId, setLinkedHabitId] = useState<string>("none");

  const activeTasks = tasks.filter(t => !t.completed);
  const activeHabits = habits;

  const handleReset = useCallback(() => {
    setIsRunning(false);
    setTimeLeft(duration * 60);
  }, [duration]);

  const handleComplete = useCallback(() => {
    setIsRunning(false);
    addFocusSession({
      taskId: linkedTaskId !== "none" ? linkedTaskId : undefined,
      habitId: linkedHabitId !== "none" ? linkedHabitId : undefined,
      duration,
      completed: true,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
    });
    // Play completion sound or notification here
    alert("Focus session complete! Great work! 🎉");
    handleReset();
  }, [linkedTaskId, linkedHabitId, duration, addFocusSession, handleReset]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      handleComplete();
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft, handleComplete]);

  const handleStart = () => {
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleDurationChange = (newDuration: string) => {
    const mins = parseInt(newDuration);
    setDuration(mins);
    setTimeLeft(mins * 60);
    setIsRunning(false);
  };

  const progress = ((duration * 60 - timeLeft) / (duration * 60)) * 100;

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold mb-2">Focus Session</h1>
          <p className="text-muted-foreground">Use the Pomodoro technique to stay focused and productive</p>
        </div>

        <div className="max-w-2xl mx-auto">
          {/* Timer Display */}
          <div className="bg-card border border-border rounded-2xl p-12 mb-8 text-center">
            <PomodoroTimer timeLeft={timeLeft} progress={progress} />

            <div className="flex items-center justify-center gap-4 mt-8">
              {!isRunning ? (
                <Button size="lg" onClick={handleStart} className="gap-2 px-8">
                  <Play className="w-5 h-5" />
                  Start
                </Button>
              ) : (
                <Button size="lg" onClick={handlePause} variant="outline" className="gap-2 px-8">
                  <Pause className="w-5 h-5" />
                  Pause
                </Button>
              )}
              <Button size="lg" onClick={handleReset} variant="outline" className="gap-2">
                <RotateCcw className="w-5 h-5" />
                Reset
              </Button>
            </div>
          </div>

          {/* Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-card border border-border rounded-xl p-6">
              <label className="block text-sm font-medium mb-3">Duration</label>
              <Select value={duration.toString()} onValueChange={handleDurationChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="25">25 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">60 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-card border border-border rounded-xl p-6">
              <label className="block text-sm font-medium mb-3">Link to Task</label>
              <Select value={linkedTaskId} onValueChange={setLinkedTaskId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select task..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {activeTasks.map(task => (
                    <SelectItem key={task.id} value={task.id}>
                      {task.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-card border border-border rounded-xl p-6">
              <label className="block text-sm font-medium mb-3">Link to Habit</label>
              <Select value={linkedHabitId} onValueChange={setLinkedHabitId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select habit..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {activeHabits.map(habit => (
                    <SelectItem key={habit.id} value={habit.id}>
                      {habit.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tips */}
          <div className="mt-8 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl p-6">
            <h3 className="font-semibold mb-3 text-blue-900 dark:text-blue-100">Focus Tips</h3>
            <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
              <li>• Eliminate distractions before starting your session</li>
              <li>• Take short breaks between focus sessions</li>
              <li>• Stay hydrated and maintain good posture</li>
              <li>• Link sessions to specific tasks for better tracking</li>
            </ul>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}