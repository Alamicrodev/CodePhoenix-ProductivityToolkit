import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "./ui/button";
import { Kbd } from "./tasks/Kbd";

/**
 * Mobile theme control. Two fixes over the original:
 *
 * - It used to cross-fade a rotate + scale between the two icons, which is
 *   exactly the "slide/scale entrance" the motion rule names. The icon now
 *   swaps instantly; the only thing that animates on a theme switch is the
 *   0.2s background transition on `body`, which the guide permits.
 * - It read `theme`, which is "system" until the user picks explicitly, so
 *   with enableSystem the first click could be a no-op. `resolvedTheme` is
 *   always the theme actually on screen.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <Kbd>T</Kbd>
    </Button>
  );
}
