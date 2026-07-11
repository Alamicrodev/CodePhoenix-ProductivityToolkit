import { useState } from "react";
import { useData } from "../context/DataContext";
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
import { Checkbox } from "./ui/checkbox";
import { Loader2 } from "lucide-react";
import { splitClockTime12, toClockTime24 } from "../lib/timeFormat";

interface HabitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => index);

function formatMinute(value: number) {
  return value.toString().padStart(2, "0");
}

function TimePicker12({
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const current = splitClockTime12(value);

  return (
    <div className="grid grid-cols-3 gap-2">
      <Select
        value={current.hour.toString()}
        onValueChange={hour => onChange(toClockTime24(Number(hour), current.minute, current.period))}
      >
        <SelectTrigger id={`${idPrefix}-hour`}>
          <SelectValue placeholder="Hour" />
        </SelectTrigger>
        <SelectContent>
          {HOUR_OPTIONS.map(hour => (
            <SelectItem key={hour} value={hour.toString()}>
              {hour}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={formatMinute(current.minute)}
        onValueChange={minute => onChange(toClockTime24(current.hour, Number(minute), current.period))}
      >
        <SelectTrigger id={`${idPrefix}-minute`}>
          <SelectValue placeholder="Minute" />
        </SelectTrigger>
        <SelectContent>
          {MINUTE_OPTIONS.map(minute => (
            <SelectItem key={minute} value={formatMinute(minute)}>
              {formatMinute(minute)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={current.period}
        onValueChange={period => onChange(toClockTime24(current.hour, current.minute, period as "AM" | "PM"))}
      >
        <SelectTrigger id={`${idPrefix}-period`}>
          <SelectValue placeholder="AM/PM" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="AM">AM</SelectItem>
          <SelectItem value="PM">PM</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function HabitModal({ isOpen, onClose }: HabitModalProps) {
  const { addHabit, isSyncing } = useData();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState<"hourly" | "daily" | "weekly">("daily");
  const [hourlyInterval, setHourlyInterval] = useState<number>(1);
  const [activeHoursStart, setActiveHoursStart] = useState("07:00");
  const [activeHoursEnd, setActiveHoursEnd] = useState("22:00");
  const [activeDays, setActiveDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]); // All days by default

  const daysOfWeek = [
    { value: 0, label: "Sun" },
    { value: 1, label: "Mon" },
    { value: 2, label: "Tue" },
    { value: 3, label: "Wed" },
    { value: 4, label: "Thu" },
    { value: 5, label: "Fri" },
    { value: 6, label: "Sat" },
  ];

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setFrequency("daily");
    setHourlyInterval(1);
    setActiveHoursStart("07:00");
    setActiveHoursEnd("22:00");
    setActiveDays([0, 1, 2, 3, 4, 5, 6]);
  };

  const toggleDay = (day: number) => {
    if (activeDays.includes(day)) {
      setActiveDays(activeDays.filter(d => d !== day));
    } else {
      setActiveDays([...activeDays, day].sort());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await addHabit({
      title,
      description,
      frequency,
      ...(frequency === "hourly" && {
        hourlyInterval,
        activeHours: { start: activeHoursStart, end: activeHoursEnd },
      }),
      ...(frequency !== "weekly" && { activeDays }), // Add activeDays for hourly and daily
      streak: 0,
      lastCompleted: null,
      completedDates: [],
      occurrences: [],
    });
    resetForm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Habit</DialogTitle>
          <DialogDescription>
            Add a new habit to track your progress.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="habit-title">Habit Name</Label>
            <Input
              id="habit-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Morning meditation, Daily exercise..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="habit-description">Description</Label>
            <Textarea
              id="habit-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What does this habit involve?"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="frequency">Frequency</Label>
            <Select value={frequency} onValueChange={(v: any) => setFrequency(v)}>
              <SelectTrigger id="frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Hourly Interval */}
          {frequency === "hourly" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="hourly-interval">Repeat Every (hours)</Label>
                <Select 
                  value={hourlyInterval.toString()} 
                  onValueChange={(v) => setHourlyInterval(parseInt(v))}
                >
                  <SelectTrigger id="hourly-interval">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 hour</SelectItem>
                    <SelectItem value="2">2 hours</SelectItem>
                    <SelectItem value="3">3 hours</SelectItem>
                    <SelectItem value="4">4 hours</SelectItem>
                    <SelectItem value="5">5 hours</SelectItem>
                    <SelectItem value="6">6 hours</SelectItem>
                    <SelectItem value="8">8 hours</SelectItem>
                    <SelectItem value="12">12 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Active Hours</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Start Time
                    </Label>
                    <TimePicker12
                      idPrefix="active-start"
                      value={activeHoursStart}
                      onChange={setActiveHoursStart}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      End Time
                    </Label>
                    <TimePicker12
                      idPrefix="active-end"
                      value={activeHoursEnd}
                      onChange={setActiveHoursEnd}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Active Days (for hourly and daily habits) */}
          {(frequency === "hourly" || frequency === "daily") && (
            <div className="space-y-2">
              <Label>Active Days</Label>
              <div className="flex gap-2 flex-wrap">
                {daysOfWeek.map(day => (
                  <div
                    key={day.value}
                    className={`flex items-center justify-center w-10 h-10 rounded-md border-2 cursor-pointer transition-colors ${
                      activeDays.includes(day.value)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => toggleDay(day.value)}
                  >
                    <span className="text-sm font-medium">{day.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSyncing}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSyncing} className="gap-2">
              {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isSyncing ? "Creating..." : "Create Habit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
