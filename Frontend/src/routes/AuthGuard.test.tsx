import { render, screen } from "@testing-library/react";
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
  it("shows the loading state while the session restores", () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: true });
    renderGuard();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByText("PRIVATE CONTENT")).not.toBeInTheDocument();
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
