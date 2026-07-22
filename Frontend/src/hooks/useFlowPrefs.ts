import { useCallback, useSyncExternalStore } from "react";

export type WeekStart = "mon" | "sun";

export interface FlowPrefs {
  /** Show the 30px footer shortcut strip. */
  hints: boolean;
  /** First day of the week, used by Habits and Schedule. */
  weekStart: WeekStart;
}

const HINTS_KEY = "flowmanager.prefs.hints";
const WEEK_START_KEY = "flowmanager.prefs.weekStart";
const CHANGE_EVENT = "flowmanager:prefs";

function readPrefs(): FlowPrefs {
  return {
    hints: window.localStorage.getItem(HINTS_KEY) !== "0",
    weekStart: window.localStorage.getItem(WEEK_START_KEY) === "sun" ? "sun" : "mon",
  };
}

let cached = typeof window === "undefined" ? { hints: true, weekStart: "mon" as WeekStart } : readPrefs();

function subscribe(callback: () => void) {
  const onChange = () => {
    cached = readPrefs();
    callback();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Instant-apply user preferences shared by the shell and the Profile page. */
export function useFlowPrefs() {
  const prefs = useSyncExternalStore(subscribe, () => cached);

  const setHints = useCallback((value: boolean) => {
    window.localStorage.setItem(HINTS_KEY, value ? "1" : "0");
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const setWeekStart = useCallback((value: WeekStart) => {
    window.localStorage.setItem(WEEK_START_KEY, value);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { ...prefs, setHints, setWeekStart };
}
