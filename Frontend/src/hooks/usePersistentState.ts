import { Dispatch, SetStateAction, useEffect, useState } from "react";

/**
 * useState persisted to localStorage. `isValid` guards against stale or
 * corrupted stored values (e.g. an enum that no longer exists).
 */
export function usePersistentState<T>(
  key: string,
  initial: T,
  isValid?: (value: unknown) => value is T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored === null) {
        return initial;
      }
      const parsed: unknown = JSON.parse(stored);
      if (isValid ? isValid(parsed) : true) {
        return parsed as T;
      }
      return initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or unavailable — persistence is best-effort.
    }
  }, [key, value]);

  return [value, setValue];
}
