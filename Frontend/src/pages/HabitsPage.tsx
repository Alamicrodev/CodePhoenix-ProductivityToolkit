import { useState } from "react";
import { useData } from "../context/DataContext";
import DashboardLayout from "../components/DashboardLayout";
import { Button } from "../components/ui/button";
import { LayoutGrid, Plus, Table, Target } from "lucide-react";
import { HabitModal } from "../components/HabitModal";
import { HabitCard } from "../components/HabitCard";
import { HabitMatrix } from "../components/HabitMatrix";
import { ToggleGroup, ToggleGroupItem } from "../components/ui/toggle-group";

const VIEW_MODE_STORAGE_KEY = "habits:viewMode";
type HabitsViewMode = "matrix" | "cards";

function loadViewMode(): HabitsViewMode {
  return localStorage.getItem(VIEW_MODE_STORAGE_KEY) === "cards" ? "cards" : "matrix";
}

export default function HabitsPage() {
  const { habits } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<HabitsViewMode>(loadViewMode);

  const handleViewModeChange = (value: string) => {
    if (value === "matrix" || value === "cards") {
      setViewMode(value);
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, value);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold mb-2">Habits</h1>
            <p className="text-muted-foreground">Build consistent routines and track your progress</p>
          </div>
          <div className="flex items-center gap-2">
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={handleViewModeChange}
              variant="outline"
            >
              <ToggleGroupItem value="matrix" aria-label="Matrix view">
                <Table className="w-4 h-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="cards" aria-label="Card view">
                <LayoutGrid className="w-4 h-4" />
              </ToggleGroupItem>
            </ToggleGroup>
            <Button onClick={() => setIsModalOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              New Habit
            </Button>
          </div>
        </div>

        {habits.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
              <Target className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-2">No habits yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first habit to start building consistency
            </p>
            <Button onClick={() => setIsModalOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Create Habit
            </Button>
          </div>
        ) : viewMode === "matrix" ? (
          <HabitMatrix habits={habits} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {habits.map(habit => (
              <HabitCard key={habit.id} habit={habit} />
            ))}
          </div>
        )}

        <HabitModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </div>
    </DashboardLayout>
  );
}
