# Electron Convergence Design

## Goal

Stabilize this repository around the existing Electron runtime and remove ambiguity about whether Electron or Tauri is the active desktop shell.

## Decision

Electron is the active application path.

Tauri remains in the repository only as legacy migration work and reference material. It is not the current runtime target and should not receive new feature work.

## Scope

- Make the default development entrypoint Electron-first.
- Rename the Tauri npm script so it is clearly legacy.
- Add project documentation that explains the active runtime path and the status of `src-tauri/`.

## Non-goals

- Deleting `src-tauri/`
- Finishing a Tauri migration
- Refactoring the worker implementation split inside `automation/`

## Active architecture

1. `src/` renders the React application.
2. `electron/preload.cjs` exposes `window.electronAPI`.
3. `electron/main.cjs` handles desktop lifecycle and forwards automation commands.
4. `automation/worker.mjs` runs the scraping and product automation flows.

## Follow-up work

- Document the active automation call graph in more detail.
- Decide whether `automation/src/` should also be archived or removed later.
- Reduce duplicate implementations once the Electron path is fully stabilized.
