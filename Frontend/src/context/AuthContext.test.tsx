import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import { API, server } from "../test/server";
import { AuthProvider, useAuth } from "./AuthContext";

const API_USER = { id: "u1", email: "user@example.com", full_name: "Test User" };

function useAuthSuccessHandlers() {
  server.use(
    http.post(`${API}/auth/login`, () =>
      HttpResponse.json({ access_token: "tok-1", token_type: "bearer" }),
    ),
    http.get(`${API}/auth/me`, () => HttpResponse.json(API_USER)),
  );
}

function Probe() {
  const { user, accessToken, isLoading, login, register, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="user">{user ? user.name : "none"}</span>
      <span data-testid="token">{accessToken ?? "none"}</span>
      <button onClick={() => void login("user@example.com", "password123").catch(() => {})}>
        do-login
      </button>
      <button
        onClick={() =>
          void register("user@example.com", "password123", "Test User").catch(() => {})
        }
      >
        do-register
      </button>
      <button onClick={logout}>do-logout</button>
    </div>
  );
}

function renderProbe() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

async function waitUntilSettled() {
  await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AuthProvider", () => {
  it("settles logged out when no token is stored", async () => {
    renderProbe();
    await waitUntilSettled();
    expect(screen.getByTestId("user")).toHaveTextContent("none");
    expect(screen.getByTestId("token")).toHaveTextContent("none");
  });

  it("restores the session from a stored token", async () => {
    localStorage.setItem("accessToken", "stored-tok");
    let sentAuthorization: string | null = null;
    server.use(
      http.get(`${API}/auth/me`, ({ request }) => {
        sentAuthorization = request.headers.get("authorization");
        return HttpResponse.json(API_USER);
      }),
    );

    renderProbe();
    await waitUntilSettled();

    expect(screen.getByTestId("user")).toHaveTextContent("Test User");
    expect(screen.getByTestId("token")).toHaveTextContent("stored-tok");
    expect(sentAuthorization).toBe("Bearer stored-tok");
  });

  it("clears a stored token the backend rejects", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem("accessToken", "expired-tok");
    server.use(
      http.get(`${API}/auth/me`, () =>
        HttpResponse.json({ detail: "Could not validate credentials" }, { status: 401 }),
      ),
    );

    renderProbe();
    await waitUntilSettled();

    expect(screen.getByTestId("user")).toHaveTextContent("none");
    expect(localStorage.getItem("accessToken")).toBeNull();
  });

  it("login stores the token and exposes the mapped user", async () => {
    useAuthSuccessHandlers();
    renderProbe();
    await waitUntilSettled();

    await userEvent.click(screen.getByRole("button", { name: "do-login" }));

    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("Test User"));
    expect(screen.getByTestId("token")).toHaveTextContent("tok-1");
    expect(localStorage.getItem("accessToken")).toBe("tok-1");
  });

  it("register posts full_name and chains into login", async () => {
    let registerBody: unknown = null;
    useAuthSuccessHandlers();
    server.use(
      http.post(`${API}/auth/register`, async ({ request }) => {
        registerBody = await request.json();
        return HttpResponse.json(API_USER, { status: 201 });
      }),
    );

    renderProbe();
    await waitUntilSettled();
    await userEvent.click(screen.getByRole("button", { name: "do-register" }));

    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("Test User"));
    expect(registerBody).toEqual({
      email: "user@example.com",
      password: "password123",
      full_name: "Test User",
    });
    expect(localStorage.getItem("accessToken")).toBe("tok-1");
  });

  it("logout clears the user and the stored token", async () => {
    useAuthSuccessHandlers();
    renderProbe();
    await waitUntilSettled();
    await userEvent.click(screen.getByRole("button", { name: "do-login" }));
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("Test User"));

    await userEvent.click(screen.getByRole("button", { name: "do-logout" }));

    expect(screen.getByTestId("user")).toHaveTextContent("none");
    expect(screen.getByTestId("token")).toHaveTextContent("none");
    expect(localStorage.getItem("accessToken")).toBeNull();
  });
});
