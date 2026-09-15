# smogon-predictions

Static React + TypeScript dashboard for tracking prediction tournament performance.

## Local development

Use Node 22 (see `.nvmrc`):

```bash
nvm use
npm install
npm run dev
```

The app generates a browser-ready dataset from the CSV files in `data/` before starting Vite.

`data/` contains raw predictor names and picks and is gitignored — it never leaves your machine. `public/data.b64` (the generated, base64-encoded dataset) is committed, so anyone building or deploying from the repo doesn't need the raw source files.

## Project structure

- `data/` — spreadsheet-style source CSV files used by the build step (gitignored, local only)
- `scripts/generate-data.mjs` — normalizes raw predictions and results into `public/data.b64`
- `public/data.b64` — generated frontend dataset (base64-encoded JSON) consumed by the dashboard, committed to the repo
- `src/App.tsx` — dashboard shell and rendered views
- `src/App.css` — dashboard styling

## Scripts

- `npm run generate:data` — rebuild `public/data.b64` from the local `data/` source files
- `npm run dev` — generate data and start the Vite dev server
- `npm run build` — create a production static build from the already-committed `public/data.b64`, without touching `data/` (the default — safe for a hosting provider's build step, since the deploy environment never has `data/`)
- `npm run build:local` — regenerate data from the local `data/` source files and create a production static build (local use only — requires `data/`)

## Deploying (e.g. Cloudflare Pages)

Whenever the underlying prediction data changes, run `npm run generate:data` locally (or `npm run build:local`) and commit the updated `public/data.b64`.

For the hosting provider's build step, use `npm run build` with output directory `dist` — it never runs `generate:data`, so it always ships whatever `data.b64` is committed rather than silently regenerating an empty one in an environment without `data/`. Node 22 is picked up automatically via `.nvmrc`. No SPA-fallback/redirects config is needed since the app has no client-side routing.

## Notes

This is a static app designed for deployment on GitHub Pages, Cloudflare Pages, or any static hosting solution with no backend dependency.

