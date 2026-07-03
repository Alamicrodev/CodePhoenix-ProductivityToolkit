import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { RouterProvider, createMemoryRouter } from "react-router";

import { API, server } from "../test/server";
import { AuthProvider } from "../context/AuthContext";
import RegisterPage from "./RegisterPage";

const API_USER = { id: "u1", email: "ada@example.com", full_name: "Ada Lovelace" };

function renderRegister() {
  const router = createMemoryRouter(
    [
      { path: "/register", element: <RegisterPage /> },
      { path: "/login", element: <div>LOGIN PAGE</div> },
      { path: "/", element: <div>HOME</div> },
    ],
    { initialEntries: ["/register"] },
  );
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

async function fillForm() {
  await userEvent.type(screen.getByLabelText("Name"), "Ada Lovelace");
  await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
  await userEvent.type(screen.getByLabelText("Password"), "password123");
}

describe("RegisterPage", () => {
  it("creates the account with full_name, auto-logs-in, and navigates home", async () => {
    let registerBody: unknown = null;
    server.use(
      http.post(`${API}/auth/register`, async ({ request }) => {
        registerBody = await request.json();
        return HttpResponse.json(API_USER, { status: 201 });
      }),
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({ access_token: "tok-1", token_type: "bearer" }),
      ),
      http.get(`${API}/auth/me`, () => HttpResponse.json(API_USER)),
    );
    renderRegister();

    await fillForm();
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("HOME")).toBeInTheDocument();
    expect(registerBody).toEqual({
      email: "ada@example.com",
      password: "password123",
      full_name: "Ada Lovelace",
    });
    expect(localStorage.getItem("accessToken")).toBe("tok-1");
  });

  it("shows the backend error when registration fails", async () => {
    server.use(
      http.post(`${API}/auth/register`, () =>
        HttpResponse.json({ detail: "Email already registered" }, { status: 400 }),
      ),
    );
    renderRegister();

    await fillForm();
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Email already registered");
    expect(screen.queryByText("HOME")).not.toBeInTheDocument();
    expect(localStorage.getItem("accessToken")).toBeNull();

    // editing a field dismisses the stale error
    await userEvent.type(screen.getByLabelText("Email"), "x");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("hints and enforces the 8-character password minimum client-side", () => {
    renderRegister();
    expect(screen.getByLabelText("Password")).toHaveAttribute("minlength", "8");
    expect(screen.getByText("Must be at least 8 characters.")).toBeInTheDocument();
  });

  it("links back to the sign-in page", async () => {
    renderRegister();
    await userEvent.click(screen.getByRole("link", { name: "Sign in" }));
    expect(await screen.findByText("LOGIN PAGE")).toBeInTheDocument();
  });
});
