# Project Stabilization Design

## Goal

Bring the current Electron mainline back to a state where the team can trust the core workflows:

1. Account login
2. One-click collection
3. Product list and product detail
4. Batch product creation

This pass does not add new business features. It removes ambiguity, stabilizes the active runtime path, and makes failures measurable.

## Current Problems

The project is not failing because of one isolated bug. It is failing because the active workflows have drifted at multiple layers:

- Data collection can succeed technically while still producing incomplete datasets.
- Renderer pages often cannot distinguish between "no platform data", "collection incomplete", and "frontend parsing bug".
- The product list and operational datasets can point at different product samples, which makes detail pages look broken even when the UI is reading local data correctly.
- Batch product creation can continue in the worker while the renderer loses state, which makes the app feel disconnected and unreliable.
- Too many legacy or half-wired surfaces remain visible, so the user cannot tell which flows are truly production-ready.

## Scope

This stabilization pass only covers the Electron runtime path:

- `src/`
- `electron/`
- `automation/worker.mjs`
- `automation/browser.mjs`
- `automation/scrape-registry.mjs`

The following are explicitly out of scope for this pass:

- `src-tauri/`
- the legacy `automation/src/` sidecar experiment
- new business pages or new workflow categories

## Recommended Approach

### Option A: Keep patching page-by-page

Pros:

- Fastest short-term progress on single screenshots

Cons:

- Repeats the current pattern of local fixes without improving trust
- Does not create measurable acceptance standards
- High risk of the next page exposing the same underlying drift

### Option B: Stabilize the core path with diagnostics and acceptance gates

Pros:

- Creates a verifiable baseline
- Converts hidden failures into visible collection gaps
- Reduces rework by fixing the shared runtime path first

Cons:

- Slightly slower than ad-hoc page patches in the first day

### Option C: Large refactor before stabilization

Pros:

- Better long-term structure

Cons:

- Too risky while the current product path is still unstable
- Makes it harder to tell whether regressions come from the refactor or existing bugs

Recommended choice: Option B.

## Execution Order

### Phase 1: Freeze and reduce ambiguity

- Treat Electron as the only active runtime.
- Keep legacy code available for reference, but do not route new work through it.
- Hide, label, or downgrade any page state that implies a workflow is production-ready when it is not.

### Phase 2: Make collection completeness observable

- For each collection task, record:
  - matched API count
  - page count
  - item count
  - parse result count
  - storage write status
- Show the renderer whether a task is:
  - success
  - partial
  - empty
  - failed
- Add summary diagnostics for the three most important datasets:
  - products
  - sales
  - flux

### Phase 3: Re-align product detail with collected data

- Ensure product collection captures enough pages to represent the real seller catalog.
- Ensure parsed product rows and operational datasets can be compared by the same identifiers.
- Make the product detail page explain whether missing data is caused by:
  - a collection gap
  - a platform gap for a new product
  - a parse or mapping issue

### Phase 4: Stabilize batch product creation as the second mainline

- Preserve progress and logs across renderer reconnects.
- Make result states explicit:
  - filled only
  - submitted
  - failed with step name
  - retryable
- Track batch success rate and top failure reasons locally so regressions are obvious.

## Acceptance Criteria

The stabilization pass is not considered complete until these checks pass:

### Collection

- One-click collection returns a structured status for every enabled task.
- Product collection captures multiple pages when the platform reports totals greater than one page.
- The parsed product count is within a reasonable range of the raw collected total.
- Diagnostics show whether a zero-result page is expected or suspicious.

### Product Detail

- Opening a product from the current product list no longer silently shows empty blocks.
- When operational data is missing, the page states why in plain language.
- Recent products can be distinguished from true collection failures.

### Batch Product Creation

- Renderer reconnect does not make an active batch look lost.
- Logs show the current item and current step.
- Failures include a usable reason, not only raw technical fragments.

### Workspace Hygiene

- Temporary helper scripts are not left in the repo root after debugging.
- New troubleshooting output is either documented or intentionally persisted.

## Immediate Next Tasks

1. Remove temporary debug scripts from the repository root.
2. Add collection diagnostics for product scraping completeness.
3. Surface collection completeness in the UI before chasing more page-level bugs.
4. Re-check product detail behavior against the new diagnostics output.
