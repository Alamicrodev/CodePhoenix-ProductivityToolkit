import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { RouterProvider, createMemoryRouter } from "react-router";

import { API, server } from "../test/server";
import { AuthProvider } from "../context/AuthContext";
import LoginPage from "./LoginPage";

const API_USER = { id: "u1", email: "user@example.com", full_name: "Test User" };

function renderLogin(initialEntry: string | { pathname: string; state?: unknown } = "/login") {
  const router = createMemoryRouter(
    [
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <div>REGISTER PAGE</div> },
      { path: "/cowork/:slug", element: <div>ROOM PAGE</div> },
      { path: "/", element: <div>HOME</div> },
    ],
    { initialEntries: [initialEntry] },
  );
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

describe("LoginPage", () => {
  it("signs in and navigates to the dashboard", async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({ access_token: "tok-1", token_type: "bearer" }),
      ),
      http.get(`${API}/auth/me`, () => HttpResponse.json(API_USER)),
    );
    renderLogin();

    await userEvent.type(screen.getByLabelText("Email"), "user@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("HOME")).toBeInTheDocument();
    expect(localStorage.getItem("accessToken")).toBe("tok-1");
  });

  it("returns to the page the guard redirected away from", async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({ access_token: "tok-1", token_type: "bearer" }),
      ),
      http.get(`${API}/auth/me`, () => HttpResponse.json(API_USER)),
    );
    // AuthGuard sends this state along when it bounces an unauthenticated visitor.
    renderLogin({ pathname: "/login", state: { from: { pathname: "/cowork/abc123", search: "" } } });

    await userEvent.type(screen.getByLabelText("Email"), "user@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("ROOM PAGE")).toBeInTheDocument();
  });

  it("shows the backend error and stays on the page when credentials are rejected", async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({ detail: "Incorrect email or password" }, { status: 401 }),
      ),
    );
    renderLogin();

    await userEvent.type(screen.getByLabelText("Email"), "user@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrongpassword");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Incorrect email or password");
    expect(screen.queryByText("HOME")).not.toBeInTheDocument();
    expect(localStorage.getItem("accessToken")).toBeNull();

    // editing a field dismisses the stale error
    await userEvent.type(screen.getByLabelText("Password"), "x");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("links to the signup page", async () => {
    renderLogin();
    await userEvent.click(screen.getByRole("link", { name: "Sign up" }));
    expect(await screen.findByText("REGISTER PAGE")).toBeInTheDocument();
  });
});
