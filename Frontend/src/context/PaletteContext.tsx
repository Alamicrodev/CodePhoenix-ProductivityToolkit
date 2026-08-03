import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PaletteCommand } from "../components/ModuleCommandPalette";

/**
 * Makes ⌘K global.
 *
 * Style Guide principle 1: "Every view answers C (create), ⌘K (commands),
 * V (switch view), T (theme), Esc (dismiss)."
 *
 * Before this, each page bound ⌘K and mounted its own palette, so the three
 * pages that never got round to it (Habits, Habit detail, Profile) answered
 * nothing at all, and Schedule — the index route — swallowed the chord in its
 * modifier guard. The shell now owns the binding and the dialog; a page
 * contributes only its own commands via useRegisterPaletteCommands.
 */
interface PaletteContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  heading: string;
  commands: PaletteCommand[];
  register: (heading: string, commands: PaletteCommand[]) => void;
  /** True while a page renders its own palette instead of the shell default. */
  claimed: boolean;
  setClaimed: (claimed: boolean) => void;
}

const PaletteContext = createContext<PaletteContextValue | null>(null);

export function PaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [entry, setEntry] = useState<{ heading: string; commands: PaletteCommand[] }>({
    heading: "",
    commands: [],
  });

  const [claimed, setClaimed] = useState(false);

  // Callers pass a fresh array on most renders. Committing it unconditionally
  // would setState on every render and spin — so re-commit only when the
  // palette's visible content actually changes.
  const register = useCallback((heading: string, commands: PaletteCommand[]) => {
    setEntry(current => {
      const sameHeading = current.heading === heading;
      const sameCommands =
        current.commands.length === commands.length &&
        current.commands.every(
          (command, index) =>
            command.label === commands[index].label &&
            command.shortcut === commands[index].shortcut &&
            command.destructive === commands[index].destructive,
        );
      return sameHeading && sameCommands ? current : { heading, commands };
    });
  }, []);

  const value = useMemo(
    () => ({
      open,
      setOpen,
      heading: entry.heading,
      commands: entry.commands,
      register,
      claimed,
      setClaimed,
    }),
    [open, entry, register, claimed],
  );

  return <PaletteContext.Provider value={value}>{children}</PaletteContext.Provider>;
}

export function usePalette(): PaletteContextValue {
  const context = useContext(PaletteContext);
  if (!context) {
    throw new Error("usePalette must be used inside a PaletteProvider");
  }
  return context;
}

/**
 * Publishes this view's own commands to the global palette for as long as the
 * view is mounted.
 *
 *   const commands = useMemo(() => [...], [deps]);
 *   useRegisterPaletteCommands("Habits", commands);
 *
 * Keyed on what the palette actually shows, never on the array's identity.
 * Identity looked like a reasonable dep until a caller memoised on a value that
 * is itself fresh every render — useSfuRoom used to hand back a bare object
 * literal — and then: re-register -> new entry -> new context value -> the
 * caller re-renders -> a newer array -> re-register. That spun CoworkRoomPage at
 * ~1300 renders/sec, and a navigate() issued during the storm never committed,
 * which is what stranded users on an ended room with every control dead.
 */
export function useRegisterPaletteCommands(heading: string, commands: PaletteCommand[]) {
  const { register } = usePalette();

  const signature = commands
    .map(command => [command.label, command.shortcut ?? "", command.destructive ? "!" : ""].join("\u0001"))
    .join("\u0002");

  // The registered rows keep working off the newest closures even while the
  // signature — and therefore the registration — stays put.
  const latest = useRef(commands);
  latest.current = commands;

  useEffect(() => {
    register(
      heading,
      latest.current.map((command, index) => ({
        ...command,
        run: () => latest.current[index]?.run(),
      })),
    );
    return () => register("", []);
  }, [register, heading, signature]);
}

/**
 * Declares that this view renders its own palette dialog, so the shell should
 * not also render the default one. Tasks uses this because its palette also
 * searches tasks — it is still opened by the shell's global ⌘K.
 */
export function useClaimPalette() {
  const { setClaimed } = usePalette();
  useEffect(() => {
    setClaimed(true);
    return () => setClaimed(false);
  }, [setClaimed]);
}
