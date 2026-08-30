
# Frontend

This folder contains the React + Vite frontend for the CodePhoenix Productivity Toolkit.

## Stack

- React
- Vite
- TypeScript
- Tailwind CSS
- Radix UI based components
- React Router
- Vitest, Testing Library, MSW, and Playwright

## What The Frontend Contains

- Authentication screens
- Schedule home page with agenda and timeline views
- Task management UI
- Habit tracking UI
- Focus session UI
- Cowork lobby and room UI with live presence, shared task lists, and video tiles
- Profile/settings UI
- Shared UI components and layouts

## Important Folders

- `src/components/`: reusable UI and feature components
- `src/context/`: auth and app data state
- `src/hooks/`: cowork room and SFU room hooks
- `src/lib/`: API client, parsers, schedule planning, cowork protocol, and formatting helpers
- `src/pages/`: page-level screens
- `src/routes/`: router configuration
- `src/styles/`: shared styles

## Development Notes

- The main auth and productivity flows in `src/` are backed by the FastAPI API in `../backend/`.
- The schedule page is the authenticated home page (`/`); `/schedule` redirects there for old bookmarks.
- Schedule blocks are derived client-side from persisted tasks and habit schedule settings.
- Cowork rooms use REST for room metadata, a WebSocket for presence/task-list updates, and Cloudflare Realtime SFU proxy calls for video when the backend is configured with SFU credentials.
- Authentication stores the JWT access token in localStorage for session restore between reloads.

## Local Run

```bash
cd Frontend
npm install
npm run dev
```

The frontend dev server runs at `http://localhost:5173`.

## API Configuration

- Default API base URL: `http://localhost:8000/api/v1`
- Override with `VITE_API_BASE_URL` when the backend is hosted elsewhere.

Example:

```bash
VITE_API_BASE_URL=http://localhost:8000/api/v1 npm run dev
```

## Docker Run

From the repository root:

```bash
docker compose up --build
```

This starts the frontend alongside the backend API and PostgreSQL.

## Available Scripts

- `npm run dev`: starts the Vite development server
- `npm run build`: builds the production bundle
- `npm run typecheck`: TypeScript check (`tsc --noEmit`)
- `npm test`: Vitest unit/component tests in watch mode (`npm run test:ci` for one-shot)
- `npm run e2e`: Playwright E2E suite (expects `docker compose up -d` from the repo root)

## Testing

- Unit/component tests use Vitest + Testing Library + MSW; they live next to
  the code as `*.test.ts(x)` with shared setup in `src/test/`.
- Vitest config lives in `vitest.config.ts` — kept separate from
  `vite.config.ts` so the docker dev container never depends on test-only
  packages.
- E2E specs live in `e2e/` and run against the full docker compose stack.

## Integration Status

The active `src/` app currently:

1. Uses backend JWT auth for register, login, and session restore.
2. Loads and mutates tasks, habits, and focus sessions through the FastAPI API.
3. Creates and joins cowork rooms through the backend, then uses the cowork WebSocket and SFU proxy routes for realtime room state and video.
4. Maps backend `snake_case` payloads into the frontend camelCase data shape.

## Related Documentation

- Root guide: [../README.md](../README.md)
- Architecture guide: [../Documentation/ARCHITECTURE.md](../Documentation/ARCHITECTURE.md)
- Backend guide: [../backend/README.md](../backend/README.md)
