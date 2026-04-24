
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
- The frontend still relies on prototype local state and localStorage for productivity data.
- The backend scaffold now exists in `../backend/` and is ready for integration.

## Local Run

```bash
cd Frontend
npm install
npm run dev
```

The frontend dev server runs at `http://localhost:5173`.

## Docker Run

From the repository root:

```bash
docker compose up --build
```

This starts the frontend alongside the backend API and PostgreSQL.

## Available Scripts

- `npm run dev`: starts the Vite development server
- `npm run build`: builds the production bundle

## Integration Direction

The current intended migration path is:

1. Replace localStorage-based auth and data flows with backend API calls.
2. Keep the current page and component structure.
3. Move task, habit, and focus-session persistence into FastAPI + PostgreSQL.

## Related Documentation

- Root guide: [README.md](file:///e:/_code/bits/CodePhoenix-ProductivityToolkit/README.md)
- Architecture guide: [ARCHITECTURE.md](file:///e:/_code/bits/CodePhoenix-ProductivityToolkit/Documentation/ARCHITECTURE.md)
- Backend guide: [backend/README.md](file:///e:/_code/bits/CodePhoenix-ProductivityToolkit/backend/README.md)
