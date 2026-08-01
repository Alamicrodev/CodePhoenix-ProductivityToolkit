import { act, render, screen } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));
vi.mock("../context/AuthContext", () => ({ useAuth: mockUseAuth }));

import AuthGuard from "./AuthGuard";

function renderGuard() {
  const router = createMemoryRouter(
    [
      { path: "/login", element: <div>LOGIN PAGE</div> },
      {
        path: "/",
        element: <AuthGuard />,
        children: [{ index: true, element: <div>PRIVATE CONTENT</div> }],
      },
    ],
    { initialEntries: ["/"] },
  );
  return render(<RouterProvider router={router} />);
}

describe("AuthGuard", () => {
  it("stays silent for 300ms while the session restores, then explains", async () => {
    vi.useFakeTimers();
    try {
      mockUseAuth.mockReturnValue({ user: null, isLoading: true });
      renderGuard();

      // This is the first paint on every private route: "No spinners under
      // 300ms", so a fast restore shows nothing at all.
      expect(screen.queryByText("Signing you in…")).not.toBeInTheDocument();
      expect(screen.queryByText("PRIVATE CONTENT")).not.toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      expect(screen.getByText("Signing you in…")).toBeInTheDocument();
      expect(screen.queryByText("PRIVATE CONTENT")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("redirects to /login when there is no user", async () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false });
    renderGuard();
    expect(await screen.findByText("LOGIN PAGE")).toBeInTheDocument();
    expect(screen.queryByText("PRIVATE CONTENT")).not.toBeInTheDocument();
  });

  it("renders the protected outlet when authenticated", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1", email: "user@example.com", name: "Test User" },
      isLoading: false,
    });
    renderGuard();
    expect(await screen.findByText("PRIVATE CONTENT")).toBeInTheDocument();
  });
});
