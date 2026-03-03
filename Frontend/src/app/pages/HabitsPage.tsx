import { useState } from "react";
import { useData } from "../contexts/DataContext";
import DashboardLayout from "../components/DashboardLayout";
import { Button } from "../components/ui/button";
import { Plus, Target, TrendingUp } from "lucide-react";
import { HabitModal } from "../components/HabitModal";
import { HabitCard } from "../components/HabitCard";

export default function HabitsPage() {
  const { habits } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold mb-2">Habits</h1>
            <p className="text-muted-foreground">Build consistent routines and track your progress</p>
          </div>
          <Button onClick={() => setIsModalOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            New Habit
          </Button>
        </div>

        {/* Habits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {habits.length > 0 ? (
            habits.map(habit => <HabitCard key={habit.id} habit={habit} />)
          ) : (
            <div className="md:col-span-2 lg:col-span-3 text-center py-16">
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
          )}
        </div>

        <HabitModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </div>
    </DashboardLayout>
  );
}
