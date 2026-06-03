# Re:ZERO Tools

<!-- rezero-init: v0.1.0 -->

## Detected Stack

- Pi Web plugin: `plugin.json` with browser entry `index.js` and backend entry `backend.js`.
- Frontend/browser JavaScript: `index.js` manipulates plugin UI directly.
- Go backend helper: `backend.go` builds the `.pi-web-backend-bin` binary used by `backend.js`.
- Git integration plugin: repository contains git history/status backend logic.
- No package manifest or Go module is present, so tooling is limited to available local CLIs.

## Installed/Configured

- Typhon: Go toolchain available — `go version`.
- Typhon: Node.js runtime available — `node --version`.
- Minerva: Go compile verification available — `go build -o .pi-web-backend-bin backend.go`.
- Satella: Git CLI available — `git --version`.

## Skipped

- npm-based lint/test tools — no `package.json` exists; avoid adding broad dependencies without project approval.
- Go module linters/tests — no `go.mod` or Go test files exist; use compile verification for now.
- Playwright/Lighthouse/axe — web app/plugin host integration requires Pi Web runtime setup; not installed by default.
- SonarQube local service — heavier quality gate not configured for this small plugin without explicit approval.
- OSV-Scanner/CodeQL/Gitleaks/Trivy — not installed in this environment; record as unavailable rather than ready.

## Local Services

- None configured.

## Required Environment

- Pi Web runtime for manual plugin UI verification.
- Local Git repository workspace for backend history/status calls.
