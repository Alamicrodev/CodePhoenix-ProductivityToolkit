import { FocusSession } from "../context/DataContext";

/** Ids of tasks included in focus sessions with one of the given statuses. */
export function getTaskIdsInFocus(
  sessions: FocusSession[],
  statuses: Array<FocusSession["status"]> = ["active"],
): Set<string> {
  return new Set(
    sessions
      .filter(session => statuses.includes(session.status))
      .flatMap(session =>
        session.items
          .filter(item => item.sourceType === "task")
          .map(item => item.sourceId),
      ),
  );
}
