import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RouterProvider, createMemoryRouter } from "react-router";

import { API, server } from "../test/server";
import { AuthProvider } from "../context/AuthContext";
import LoginPage from "./LoginPage";

const API_USER = { id: "u1", email: "user@example.com", full_name: "Test User" };

function renderLogin() {
  const router = createMemoryRouter(
    [
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <div>REGISTER PAGE</div> },
      { path: "/", element: <div>HOME</div> },
    ],
    { initialEntries: ["/login"] },
  );
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

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

  it("stays on the page when credentials are rejected", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({ detail: "Incorrect email or password" }, { status: 401 }),
      ),
    );
    renderLogin();

    await userEvent.type(screen.getByLabelText("Email"), "user@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrongpassword");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(errorSpy).toHaveBeenCalled());
    expect(screen.queryByText("HOME")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(localStorage.getItem("accessToken")).toBeNull();
  });

  it("links to the signup page", async () => {
    renderLogin();
    await userEvent.click(screen.getByRole("link", { name: "Sign up" }));
    expect(await screen.findByText("REGISTER PAGE")).toBeInTheDocument();
  });
});
