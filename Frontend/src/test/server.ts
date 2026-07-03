import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

// Must match the api client's default base URL (src/lib/api.ts).
export const API = "http://localhost:8000/api/v1";

// Baseline handlers: an empty workspace. Individual tests override with
// server.use(...) to add auth endpoints or seed data.
export const handlers = [
  http.get(`${API}/tasks`, () => HttpResponse.json([])),
  http.get(`${API}/habits`, () => HttpResponse.json([])),
  http.get(`${API}/focus-sessions`, () => HttpResponse.json([])),
];

export const server = setupServer(...handlers);
