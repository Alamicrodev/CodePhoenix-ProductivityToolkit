
# Frontend

This folder contains the React + Vite frontend for the CodePhoenix Productivity Toolkit.

## Stack

- React
- Vite
- TypeScript
- Tailwind CSS
- Radix UI based components

## What The Frontend Contains

- Authentication screens
- Dashboard and productivity pages
- Task management UI
- Habit tracking UI
- Focus session UI
- Shared UI components and layouts

## Important Folders

- `src/components/`: reusable UI and feature components
- `src/context/`: auth and app data state
- `src/pages/`: page-level screens
- `src/routes/`: router configuration
- `src/styles/`: shared styles
- `src/utils/`: utility helpers

## Development Notes

- The active application currently uses `src/`.
- There is also a duplicated `src/app/` tree that appears to be legacy scaffolding.
- The main auth and productivity flows in `src/` are now backed by the FastAPI API in `../backend/`.
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

## Integration Status

The active `src/` app currently:

1. Uses backend JWT auth for register, login, and session restore.
2. Loads and mutates tasks, habits, and focus sessions through the FastAPI API.
3. Keeps the existing page and component structure while mapping backend responses into the frontend data shape.

## Related Documentation

- Root guide: [README.md](file:///e:/_code/bits/CodePhoenix-ProductivityToolkit/README.md)
- Architecture guide: [ARCHITECTURE.md](file:///e:/_code/bits/CodePhoenix-ProductivityToolkit/Documentation/ARCHITECTURE.md)
- Backend guide: [backend/README.md](file:///e:/_code/bits/CodePhoenix-ProductivityToolkit/backend/README.md)
