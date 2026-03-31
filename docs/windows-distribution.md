# Windows Distribution

This project can be shipped as a Windows installer.

## Build outputs

- Installer: `release/Temu 自动化运营工具-Setup-<version>.exe`
- Unpacked app folder: `release/win-unpacked/`

## Build commands

1. Install dependencies with `npm install`
2. Generate brand assets with `npm run build:resources`
3. Build the installer with `npm run dist:win`

For a local smoke build without the installer wrapper, use `npm run pack:win`.

## What the installer includes

- Electron desktop shell
- Vite production frontend bundle
- Automation worker from `automation/worker.mjs`
- Native dependency rebuilds required by `better-sqlite3`

The packaged app no longer requires a separate Node.js installation because the worker is launched through the packaged Electron runtime in Node mode.

## Machine requirements

- Windows x64
- Google Chrome or Microsoft Edge installed
- Network access to Temu seller pages

## Handoff guidance

- Send the `Setup` executable to end users for normal installation.
- Use `win-unpacked` only for smoke testing or portable internal runs.
- If Windows SmartScreen prompts on first launch, allow the app to continue. This build is packaged for internal distribution and may not have enterprise trust on every machine.
