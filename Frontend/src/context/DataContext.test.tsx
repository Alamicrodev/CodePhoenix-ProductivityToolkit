import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import { API, server } from "../test/server";
import { AuthProvider, useAuth } from "./AuthContext";
import { DataProvider, useData } from "./DataContext";

const API_USER = { id: "u1", email: "user@example.com", full_name: "Test User" };

const API_TASK = {
  id: "t1",
  title: "Write report",
  description: "Q3 summary",
  completed: false,
  completed_at: null,
  priority: "high",
  due_date: "2026-07-10",
  due_time: null,
  tags: ["work"],
  quadrant: "urgent-important",
  subtasks: [
    {
      id: "s1",
      title: "Draft outline",
      completed: false,
      priority: "medium",
      due_date: null,
      due_time: null,
    },
  ],
};

const API_HABIT = {
  id: "h1",
  title: "Drink water",
  description: "",
  frequency: "daily",
  hourly_interval: null,
  active_hours: { start: "08:00", end: "20:00" },
  active_days: [1, 2],
  streak: 3,
  last_completed: null,
  completed_dates: [],
  occurrences: [],
};

// status "paused" on purpose: active sessions start the 1s persistence tick.
const API_SESSION = {
  id: "f1",
  title: "Deep work",
  total_duration_minutes: 50,
  focus_length_minutes: 25,
  break_length_minutes: 5,
  elapsed_seconds: 120,
  phase_type: "focus",
  phase_remaining_seconds: 1380,
  status: "paused",
  completion_result: null,
  completed: false,
  completed_focus_blocks: 0,
  created_at: "2026-07-02T08:00:00Z",
  started_at: "2026-07-02T08:00:00Z",
  updated_at: "2026-07-02T08:02:00Z",
  paused_at: "2026-07-02T08:02:00Z",
  ended_at: null,
  items: [],
};

function Probe() {
  const { user } = useAuth();
  const { tasks, habits, focusSessions } = useData();
  return (
    <div>
      <span data-testid="auth-user">{user ? user.name : "none"}</span>
      <span data-testid="task-count">{tasks.length}</span>
      <span data-testid="task-due">{tasks[0]?.dueDate ?? "unset"}</span>
      <span data-testid="subtask-title">{tasks[0]?.subtasks[0]?.title ?? "unset"}</span>
      <span data-testid="habit-hours">{habits[0]?.activeHours?.start ?? "unset"}</span>
      <span data-testid="habit-streak">{habits[0]?.streak ?? "unset"}</span>
      <span data-testid="session-elapsed">{focusSessions[0]?.elapsedSeconds ?? "unset"}</span>
    </div>
  );
}

function renderWorkspace() {
  return render(
    <AuthProvider>
      <DataProvider>
        <Probe />
      </DataProvider>
    </AuthProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DataProvider", () => {
  it("loads the workspace and maps snake_case payloads to camelCase", async () => {
    localStorage.setItem("accessToken", "tok-1");
    server.use(
      http.get(`${API}/auth/me`, () => HttpResponse.json(API_USER)),
      http.get(`${API}/tasks`, () => HttpResponse.json([API_TASK])),
      http.get(`${API}/habits`, () => HttpResponse.json([API_HABIT])),
      http.get(`${API}/focus-sessions`, () => HttpResponse.json([API_SESSION])),
    );

    renderWorkspace();

    await waitFor(() => expect(screen.getByTestId("task-count")).toHaveTextContent("1"));
    expect(screen.getByTestId("task-due")).toHaveTextContent("2026-07-10");
    expect(screen.getByTestId("subtask-title")).toHaveTextContent("Draft outline");
    expect(screen.getByTestId("habit-hours")).toHaveTextContent("08:00");
    expect(screen.getByTestId("habit-streak")).toHaveTextContent("3");
    expect(screen.getByTestId("session-elapsed")).toHaveTextContent("120");
  });

  it("logs the user out when the workspace load hits a 401", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem("accessToken", "stale-tok");
    server.use(
      http.get(`${API}/auth/me`, () => HttpResponse.json(API_USER)),
      http.get(`${API}/tasks`, () =>
        HttpResponse.json({ detail: "Could not validate credentials" }, { status: 401 }),
      ),
    );

    renderWorkspace();

    // session restore succeeds first...
    await waitFor(() => expect(screen.getByTestId("auth-user")).toHaveTextContent("Test User"));
    // ...then the 401 from /tasks triggers the automatic logout
    await waitFor(() => expect(screen.getByTestId("auth-user")).toHaveTextContent("none"));
    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(screen.getByTestId("task-count")).toHaveTextContent("0");
  });
});
