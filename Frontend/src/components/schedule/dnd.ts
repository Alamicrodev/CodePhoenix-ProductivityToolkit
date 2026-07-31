import { BlockKind } from "../../lib/schedulePlan";

/** react-dnd item type shared by timeline blocks, untimed rows, and rail rows. */
export const SCHEDULE_ITEM = "SCHEDULE_ITEM";

/** Payload carried by any draggable schedule item. */
export interface ScheduleDragItem {
  kind: BlockKind;
  /** Backing task/habit id. */
  sourceId: string;
  /** Display duration — sizes the drop ghost. */
  dur: number;
  title: string;
}
