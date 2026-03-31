# Stability Remediation Plan

## Goal

Move the Electron desktop app from "feature-available but fragile" to "operationally stable for end users" in phased, measurable steps.

This plan prioritizes the runtime path that real users touch:

- `electron/main.cjs`
- `electron/preload.cjs`
- `src/`
- `automation/worker.mjs`

## P0 Checklist

- [x] Normalize the update flow into one user path: check, auto-download, install when ready.
- [x] Add update-operation de-duplication in the main process so repeated clicks do not spawn overlapping checks or downloads.
- [x] Guard update installation so the app only installs after a confirmed `downloaded` state.
- [x] Add atomic JSON writes for renderer store data.
- [x] Add backup-based JSON recovery for corrupted local store files.
- [ ] Replace global worker progress state with task-based progress records.
- [ ] Add a persisted worker task registry with `taskId`, `status`, `startedAt`, and `heartbeatAt`.
- [ ] Add worker startup health diagnostics that explain whether failure came from browser runtime, port conflict, missing resources, or app packaging.

## P1 Checklist

- [ ] Split `automation/worker.mjs` into task-oriented modules for login, collection, product creation, and image generation.
- [ ] Add store schema versioning and explicit migration functions for renderer data.
- [ ] Add a release channel policy for `internal`, `canary`, and `stable`.
- [ ] Add smoke tests for app launch, worker launch, update check, account login, and batch product creation recovery.
- [ ] Add worker-side structured logs that can be filtered by `taskId`.

## P2 Checklist

- [ ] Replace ad-hoc JSON persistence for high-value operational state with a more structured persistence layer.
- [ ] Add a visible diagnostics page for packaged runtime resources and update source health.
- [ ] Add automatic bug report bundles that collect desktop logs, frontend logs, worker logs, and recent screenshots.

## Acceptance Gates

### Update Reliability

- A user can only trigger one update check at a time.
- A discovered update starts a single background download.
- The install action is only shown after download completion.
- Manual retries after an update error do not require deleting local cache by hand.

### Local Data Safety

- Store writes never leave partially-written JSON as the only copy.
- If a store file becomes corrupted, the app can restore from the last known-good backup.
- A corrupted local file produces a log entry instead of silent failure.

### Next Implementation Slice

1. Convert batch product creation progress from a global singleton to persisted task records.
2. Add a packaged-runtime diagnostics surface for worker runtime, browser detection, and image-studio resources.
3. Introduce basic smoke coverage before each release build.
