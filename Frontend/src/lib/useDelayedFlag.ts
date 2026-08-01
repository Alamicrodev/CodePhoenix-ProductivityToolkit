import { useEffect, useState } from "react";

/**
 * Gates a pending flag behind a delay so fast operations never flash a
 * spinner or a skeleton.
 *
 * Style Guide §1 Motion: "No spinners under 300ms." Principle 4, Instant by
 * default: "no skeletons under 300ms, optimistic updates everywhere."
 *
 * Returns false until `pending` has been continuously true for `delayMs`,
 * and drops back to false the moment `pending` clears — so a 40ms request
 * renders nothing at all.
 *
 *   const showSpinner = useDelayedFlag(isLoading);
 */
export function useDelayedFlag(pending: boolean, delayMs = 300): boolean {
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    if (!pending) {
      setElapsed(false);
      return;
    }
    const timer = window.setTimeout(() => setElapsed(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [pending, delayMs]);

  return pending && elapsed;
}
