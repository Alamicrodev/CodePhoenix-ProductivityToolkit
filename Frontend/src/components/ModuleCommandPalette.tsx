import { ReactNode } from "react";
import { useNavigate } from "react-router";
import { useTheme } from "next-themes";
import { Calendar, CheckSquare, Moon, Sun, Target, Timer, Users } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "./ui/command";

export interface PaletteCommand {
  label: string;
  icon: ReactNode;
  shortcut?: string;
  run: () => void;
  /** Destructive commands read in the alert colour, like their buttons do. */
  destructive?: boolean;
}

interface ModuleCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Heading for the module's own commands — "Focus", "Room", "Cowork". */
  contextHeading: string;
  commands: PaletteCommand[];
}

const DESTINATIONS = [
  { label: "Today", href: "/", icon: <Calendar /> },
  { label: "Tasks", href: "/tasks", icon: <CheckSquare /> },
  { label: "Habits", href: "/habits", icon: <Target /> },
  { label: "Focus", href: "/focus", icon: <Timer /> },
  { label: "Cowork", href: "/cowork", icon: <Users /> },
];

/**
 * ⌘K for the Focus and Cowork screens: whatever the screen can do right now,
 * then the same navigate and theme rows everywhere. The task palette stays
 * separate because it also searches tasks.
 */
export function ModuleCommandPalette({
  open,
  onOpenChange,
  contextHeading,
  commands,
}: ModuleCommandPaletteProps) {
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();

  const run = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command palette"
      description={`Commands for ${contextHeading.toLowerCase()}, navigation, and theme`}
    >
      <CommandInput placeholder="Type a command…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {commands.length > 0 && (
          <CommandGroup heading={contextHeading}>
            {commands.map(command => (
              <CommandItem
                key={command.label}
                value={command.label}
                onSelect={() => run(command.run)}
                className={command.destructive ? "text-destructive" : undefined}
              >
                {command.icon}
                {command.label}
                {command.shortcut && <CommandShortcut>{command.shortcut}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading="Navigate">
          {DESTINATIONS.map(destination => (
            <CommandItem
              key={destination.href}
              value={`go ${destination.label}`}
              onSelect={() => run(() => navigate(destination.href))}
            >
              {destination.icon}
              {destination.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Theme">
          <CommandItem
            value="toggle theme"
            onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}
          >
            {resolvedTheme === "dark" ? <Sun /> : <Moon />}
            Switch to {resolvedTheme === "dark" ? "light" : "dark"} theme
            <CommandShortcut>T</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
