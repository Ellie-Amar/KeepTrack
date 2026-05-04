# KeepTrack Frontend

Frontend React + TypeScript + Vite.

## Prerequisites

- Node.js 20+ (recommended)
- npm 10+ (recommended)

## Install

```bash
npm install
```

## Run in dev

```bash
npm run dev
```

The app starts on Vite default port (usually `http://localhost:5173`).

## Backend API (dev proxy)

The frontend calls `/api/*` and Vite proxies to:

- `http://localhost:8000` by default
- or `VITE_BACKEND_TARGET` if set

Example:

```bash
VITE_BACKEND_TARGET=http://localhost:8000 npm run dev
```

## Build / Preview / Lint

```bash
npm run build
npm run preview
npm run lint
```

## Tests

Test stack:

- Vitest
- Testing Library
- MSW (HTTP mocks)
- fake-indexeddb (IndexedDB for DB-level tests)

Commands:

```bash
npm run test       # unit + integration
npm run test:db    # DB-level tests (Dexie / IndexedDB)
npm run test:all   # full frontend suite
npm run coverage
```

Quality gate (same spirit as backend `check`):

```bash
npm run check
```

## CI (GitHub Actions)

Frontend CI lives in `.github/workflows/ci.yml` with 3 jobs:

1. `Lint + Unit / Integration`
2. `DB Tests (IndexedDB)`
3. `Production Build` (with build artifact upload)
