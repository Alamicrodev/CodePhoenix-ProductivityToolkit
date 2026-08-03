import { useMemo, useState } from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PaletteProvider, usePalette, useRegisterPaletteCommands } from "./PaletteContext";
import type { PaletteCommand } from "../components/ModuleCommandPalette";

/**
 * Mirrors the shape CoworkRoomPage had when it wedged the app:
 *
 *   const mesh = useSfuRoom(...)             // fresh object literal per render
 *   const commands = useMemo(() => [...], [mesh])
 *   useRegisterPaletteCommands("Room", commands)
 *   const { open } = usePalette()            // subscribes to what it writes
 *
 * Registering committed new provider state, the new context value re-rendered
 * the caller, the caller produced a newer array, and round it went — ~1300
 * renders/sec, and any navigate() issued during the storm never committed.
 */
function RoomLike({ onRender, onRun }: { onRender: () => void; onRun?: (value: number) => void }) {
  onRender();
  const [clicks, setClicks] = useState(0);

  // Deliberately unstable, exactly like useSfuRoom's old return value.
  const mesh = { toggleMic: () => setClicks(current => current + 1) };

  const commands = useMemo<PaletteCommand[]>(
    () => [
      {
        label: "Mute microphone",
        icon: null,
        shortcut: "M",
        run: () => {
          mesh.toggleMic();
          onRun?.(clicks);
        },
      },
    ],
    [mesh, clicks, onRun],
  );

  useRegisterPaletteCommands("Room", commands);

  const { open, commands: registered } = usePalette();
  return (
    <div>
      <span data-testid="open">{open ? "open" : "closed"}</span>
      <span data-testid="registered">{registered.map(command => command.label).join(",")}</span>
      <button type="button" onClick={() => registered[0]?.run()}>
        run first
      </button>
      <span data-testid="clicks">{clicks}</span>
    </div>
  );
}

describe("useRegisterPaletteCommands", () => {
  it("settles when the caller passes a new array every render", () => {
    const onRender = vi.fn();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <PaletteProvider>
        <RoomLike onRender={onRender} />
      </PaletteProvider>,
    );

    const runawayWarning = errorSpy.mock.calls.find(call =>
      String(call[0]).includes("Maximum update depth exceeded"),
    );
    errorSpy.mockRestore();

    expect(runawayWarning).toBeUndefined();
    expect(onRender.mock.calls.length).toBeLessThan(10);
    expect(screen.getByTestId("registered")).toHaveTextContent("Mute microphone");
  });

  it("keeps registered rows pointing at the newest closure", async () => {
    const user = userEvent.setup();
    const seen: number[] = [];

    render(
      <PaletteProvider>
        <RoomLike onRender={() => {}} onRun={value => seen.push(value)} />
      </PaletteProvider>,
    );

    await user.click(screen.getByRole("button", { name: "run first" }));
    await user.click(screen.getByRole("button", { name: "run first" }));

    // Second invocation must see the state the first one produced, not a
    // closure captured at registration time.
    expect(seen).toEqual([0, 1]);
    expect(screen.getByTestId("clicks")).toHaveTextContent("2");
  });

  it("clears the entry when the view unmounts", () => {
    function Harness({ mounted }: { mounted: boolean }) {
      return (
        <PaletteProvider>
          {mounted && <RoomLike onRender={() => {}} />}
          <Probe />
        </PaletteProvider>
      );
    }
    function Probe() {
      const { heading } = usePalette();
      return <span data-testid="heading">{heading || "(none)"}</span>;
    }

    const view = render(<Harness mounted />);
    expect(screen.getByTestId("heading")).toHaveTextContent("Room");

    act(() => {
      view.rerender(<Harness mounted={false} />);
    });
    expect(screen.getByTestId("heading")).toHaveTextContent("(none)");
  });
});
