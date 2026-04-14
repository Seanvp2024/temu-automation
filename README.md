# Temu Automation

This repository is maintained as an Electron-first desktop app.

Detailed runtime and architecture notes live in `docs/runtime-architecture.md`.

## Active runtime

- Desktop shell: Electron
- Frontend: Vite + React + Ant Design
- Automation engine: `automation/worker.mjs` over local HTTP
- Frontend bridge: `window.electronAPI` from `electron/preload.cjs`

## Current status

The Electron path is the only active product path in this repo.

## Takeover snapshot (2026-04-11)

- App version baseline: `0.1.65`
- Working branch baseline: `master` tracking `origin/master`
- Pre-existing in-progress work is centered on competitor analysis and Yunqi data integration rather than unrelated fixes.
- The main feature slice already touches `src/App.tsx`, `src/components/Layout/AppLayout.tsx`, `src/pages/CompetitorAnalysis.tsx`, `electron/preload.cjs`, `electron/main.cjs`, `src/types/electron.d.ts`, `src/utils/multiStore.ts`, `automation/worker.mjs`, `automation/yunqi-db.mjs`, and local `logs/`.
- Use `docs/runtime-architecture.md` for the current handoff matrix, data paths, and module status.
- Use `docs/windows-distribution.md` for the current release gate and packaging checklist.

## Run commands

- `npm run dev`: start the Electron desktop app with the Vite dev server
- `npm run dev:web`: start the frontend only
- `npm run build:resources`: generate app icons used by the Windows package
- `npm run build`: build the frontend bundle
- `npm run dist:win`: build a Windows NSIS installer into `release/`
- `npm run pack:win`: build a portable unpacked Windows folder into `release/win-unpacked`
- `npm run electron`: open Electron against an already-running dev server

## Quick start

1. Install root dependencies with `npm install`
2. Make sure the machine has Google Chrome or Microsoft Edge installed
3. Start the app with `npm run dev`
4. Open the Accounts page, add a Temu account, then log in before running scraping tasks

For the full boot sequence, storage locations, and module call graph, see `docs/runtime-architecture.md`.
For Windows packaging and handoff steps, see `docs/windows-distribution.md`.
For colleague-facing usage instructions, see `docs/colleague-user-guide.md`.
For update publishing, see `docs/update-publishing.md`.
For update source deployment options, see `docs/update-source-options.md`.
For the static update site template, see `docs/static-update-site-template.md`.

## Repository map

- `electron/`: Electron main process and preload bridge
- `src/`: active React UI
- `automation/worker.mjs`: active automation worker used by Electron
- `automation/src/`: older TypeScript sidecar experiment, not part of the current runtime path

## Maintenance rules

- Build new features against the Electron bridge.
- When touching automation behavior, verify the call chain from `src/` to `electron/` to `automation/worker.mjs`.
