import { motion } from "motion/react";

interface PomodoroTimerProps {
  timeLeft: number;
  progress: number;
}

export function PomodoroTimer({ timeLeft, progress }: PomodoroTimerProps) {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      {/* Circular Progress */}
      <svg className="w-80 h-80 transform -rotate-90">
        {/* Background circle */}
        <circle
          cx="160"
          cy="160"
          r={radius}
          stroke="currentColor"
          strokeWidth="12"
          fill="none"
          className="text-muted opacity-20"
        />
        {/* Progress circle */}
        <motion.circle
          cx="160"
          cy="160"
          r={radius}
          stroke="currentColor"
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          className="text-blue-600 dark:text-blue-400"
          style={{
            strokeDasharray: circumference,
            strokeDashoffset,
          }}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.5 }}
        />
      </svg>

      {/* Timer Display */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl font-semibold tabular-nums">
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </div>
          <p className="text-muted-foreground mt-2">
            {progress === 0 ? "Ready to focus" : progress === 100 ? "Complete!" : "Stay focused"}
          </p>
        </div>
      </div>
    </div>
  );
}
