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
