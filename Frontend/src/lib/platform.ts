export const IS_MAC =
  typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC");

/** Modifier-key label for shortcut hints: ⌘ on macOS, Ctrl elsewhere. */
export const CMD_LABEL = IS_MAC ? "⌘" : "Ctrl";
