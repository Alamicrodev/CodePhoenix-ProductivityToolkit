import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CoworkVideoTile from "./CoworkVideoTile";

describe("CoworkVideoTile", () => {
  it("shows a connecting status while a publishing peer's media is on its way", () => {
    render(<CoworkVideoTile displayName="Sam Partner" stream={null} isPublishing />);

    expect(screen.getByText("Connecting...")).toBeInTheDocument();
  });

  it("shows no status for a peer who publishes nothing — there is no connection to wait for", () => {
    // A camera-less peer previously read as permanently "Connecting...", which
    // made a perfectly healthy room look stuck.
    render(<CoworkVideoTile displayName="Sam Partner" stream={null} isPublishing={false} isCameraOff />);

    expect(screen.queryByText("Connecting...")).not.toBeInTheDocument();
    expect(screen.getByText("SP")).toBeInTheDocument();
  });

  it("never shows a status on the local tile", () => {
    render(<CoworkVideoTile displayName="Me" stream={null} isLocal />);

    expect(screen.queryByText("Connecting...")).not.toBeInTheDocument();
  });
});
