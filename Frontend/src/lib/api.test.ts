import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import { API, server } from "../test/server";
import { ApiError, apiRequest, getApiErrorMessage, getApiUrl } from "./api";

describe("getApiUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("joins the default base with a leading-slash path", () => {
    expect(getApiUrl("/tasks")).toBe("http://localhost:8000/api/v1/tasks");
  });

  it("adds the missing leading slash", () => {
    expect(getApiUrl("tasks")).toBe("http://localhost:8000/api/v1/tasks");
  });

  it("respects VITE_API_BASE_URL and strips trailing slashes", () => {
    // This is the exact mechanism behind pointing the deployed frontend at a
    // hosted backend — pin it so it never silently regresses.
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com/api/v1///");
    expect(getApiUrl("/tasks")).toBe("https://api.example.com/api/v1/tasks");
  });
});

describe("apiRequest", () => {
  it("returns parsed JSON on success", async () => {
    server.use(http.get(`${API}/tasks`, () => HttpResponse.json([{ id: "t1" }])));
    await expect(apiRequest("/tasks")).resolves.toEqual([{ id: "t1" }]);
  });

  it("sends the bearer token when provided", async () => {
    let authorization: string | null = null;
    server.use(
      http.get(`${API}/auth/me`, ({ request }) => {
        authorization = request.headers.get("authorization");
        return HttpResponse.json({ id: "u1", email: "a@b.c", full_name: "A" });
      }),
    );
    await apiRequest("/auth/me", { token: "tok-123" });
    expect(authorization).toBe("Bearer tok-123");
  });

  it("sets a JSON content type for plain string bodies", async () => {
    let contentType: string | null = null;
    server.use(
      http.post(`${API}/tasks`, ({ request }) => {
        contentType = request.headers.get("content-type");
        return HttpResponse.json({ id: "t1" }, { status: 201 });
      }),
    );
    await apiRequest("/tasks", { method: "POST", body: JSON.stringify({ title: "x" }) });
    expect(contentType).toBe("application/json");
  });

  it("appends query params and skips empty values", async () => {
    let requestedUrl: URL | null = null;
    server.use(
      http.get(`${API}/tasks`, ({ request }) => {
        requestedUrl = new URL(request.url);
        return HttpResponse.json([]);
      }),
    );
    await apiRequest("/tasks", { query: { a: 1, b: "", c: null, d: "x" } });
    expect(requestedUrl!.searchParams.get("a")).toBe("1");
    expect(requestedUrl!.searchParams.has("b")).toBe(false);
    expect(requestedUrl!.searchParams.has("c")).toBe(false);
    expect(requestedUrl!.searchParams.get("d")).toBe("x");
  });

  it("returns undefined for 204 responses", async () => {
    server.use(
      http.delete(`${API}/tasks/t1`, () => new HttpResponse(null, { status: 204 })),
    );
    await expect(apiRequest("/tasks/t1", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("throws ApiError carrying the backend detail message and status", async () => {
    server.use(
      http.get(`${API}/tasks/missing`, () =>
        HttpResponse.json({ detail: "Task not found" }, { status: 404 }),
      ),
    );
    const error = await apiRequest("/tasks/missing").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
    expect((error as ApiError).message).toBe("Task not found");
  });

  it("falls back to a generic message when the error body is empty", async () => {
    server.use(http.get(`${API}/boom`, () => new HttpResponse(null, { status: 500 })));
    const error = await apiRequest("/boom").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe("Request failed");
  });

  it("flattens FastAPI 422 validation details into readable text", async () => {
    server.use(
      http.post(`${API}/auth/register`, () =>
        HttpResponse.json(
          {
            detail: [
              {
                loc: ["body", "password"],
                msg: "String should have at least 8 characters",
                type: "string_too_short",
              },
            ],
          },
          { status: 422 },
        ),
      ),
    );
    const error = await apiRequest("/auth/register", { method: "POST", body: "{}" }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    // not "[object Object]" — the msg fields are extracted
    expect((error as ApiError).message).toBe("String should have at least 8 characters");
  });
});

describe("getApiErrorMessage", () => {
  it("passes through backend ApiError messages", () => {
    expect(getApiErrorMessage(new ApiError("Email already registered", 400), "fallback")).toBe(
      "Email already registered",
    );
  });

  it("maps network failures to a connectivity hint", () => {
    expect(getApiErrorMessage(new TypeError("fetch failed"), "fallback")).toBe(
      "Could not reach the server. Please try again.",
    );
  });

  it("uses the fallback for unknown errors", () => {
    expect(getApiErrorMessage("boom", "fallback")).toBe("fallback");
  });
});
