import { useMemo } from "react";
import { useData } from "../../context/DataContext";
import { getTaskIdsInFocus } from "../../lib/focusStatus";

/** Ids of tasks currently held by an active or paused focus session. */
export function useTasksInFocus(): Set<string> {
  const { focusSessions } = useData();
  return useMemo(() => getTaskIdsInFocus(focusSessions, ["active", "paused"]), [focusSessions]);
}
