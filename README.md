# pi-web-git-viewer

Git history sidebar plugin for pi-web.

## Install

```sh
pi-web
# Settings → Plugins → local path → ../pi-web-git-viewer → install
```

Provides a separate git-viewer panel button target (`git-viewer`).

## Icons

Uses a vendored Material Symbols `account_tree` SVG at `assets/material-account-tree.svg`; no icon package or runtime font dependency is required.

## Build

```sh
bun run build
```

The checked-in `index.js` is built from `src/index.js`, matching the pi-web-file-browser plugin layout.

## Backend

Uses prebuilt Go backend binaries under `bin/`:

- `backend-darwin-amd64`
- `backend-darwin-arm64`
- `backend-linux-amd64`
- `backend-linux-arm64`

Windows is not supported.
