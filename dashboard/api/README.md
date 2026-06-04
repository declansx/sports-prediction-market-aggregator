# Public dashboard API (Vercel serverless)

This directory replaces the always-on Railway backend for the **read-only
public dashboard**. Instead of a 24/7 container holding two WebSockets + a
30s poller + a per-visitor relay, the public site is now:

```
visitor → Vercel static SPA (dashboard, public build)
              │  polls every 60s
              ▼
        /api/markets  (this function)
              │  fetches SX + Poly REST, builds the overlay, no DB / no WS
              ▼
        Vercel edge cache  (s-maxage=60, stale-while-revalidate=300)
```

The edge cache means upstream is hit **at most ~once per minute regardless of
visitor count**, and **nothing runs when nobody is on the site → $0**.

## Files

- `dashboard/serverless/markets.ts` — **source** for the function (esbuild
  entry). Thin wrapper around `bot/src/public/fetchMarkets.ts` →
  `buildMarkets.ts` (pure, DB-free; reuses the SX/Poly adapters + `canonicalize`).
- `dashboard/api/markets.js` — **the deployed function**: a single self-contained
  CommonJS bundle produced by `npm run build:api` (esbuild, bot code inlined,
  node deps left external). We bundle ourselves because Vercel's per-file
  transpile shipped the raw `import` + unresolved cross-package bot paths and
  failed at runtime (`ERR_MODULE_NOT_FOUND` / "Cannot use import outside a
  module"). The bundle is regenerated as the last step of `build:public` and
  also committed so it exists at function-discovery time.
- `dashboard/api/package.json` — `{ "type": "commonjs" }` so the bundle loads as
  CJS (the bot compiles to CommonJS).
- `dashboard/vercel.json` — `installCommand` (workspace-root install),
  function `maxDuration`, SPA rewrite.

To re-bundle after changing bot logic: `npm run build:api --workspace=dashboard`
(or just `npm run build:public`). Test locally without deploying:
`node dashboard/serverless/_localtest.cjs`.

## Vercel project settings (project: `spm-aggregator-readonly`)

These are already correct in the dashboard — keep them:

- **Root Directory:** `dashboard`
- **"Include files outside the root directory in the Build Step":** **Enabled**
  — required so the function can import the sibling `../../bot/src`.
- **Build Command:** `npm run build:public`
- **Output Directory:** `dist-public`

Then set/confirm **Environment Variables** (these just satisfy the bot's config
validator — this path never touches the DB and SX/Poly market reads need no
key):

- `READ_ONLY_MODE=true`
- `SX_BET_API_KEY=public` (any non-empty string)
- `DATABASE_URL=unused` (any non-empty string)
- **Remove `VITE_API_BASE_URL`** if it was set — the dashboard now calls the
  same-origin `/api/markets`. Leaving it pointed at Railway would bypass this
  function.

> First-deploy check: the only thing that can't be validated locally is Vercel
> installing the `bot` workspace deps + bundling the `../../bot/src` import. If
> the function 500s with a module-resolution error, set the **Install Command**
> to run at the repo root (`npm install` with the workspace root detected), or
> add `"bot": "*"` to `dashboard/dependencies` so npm symlinks it.

## Freshness & limitations

- **~60s freshness** (edge cache TTL). Tighten/loosen via `s-maxage` in
  `markets.ts`.
- **No live order-book depth ladders or in-play tick updates** in public mode —
  those were WebSocket-only. The match list + best-odds comparison (the
  showcase) works fully. To restore depth, add an `/api/orderbook` function
  that fetches a book on demand and cache it similarly.

## Decommission Railway

Once the Vercel deploy is verified:

1. Confirm the public dashboard loads markets from `/api/markets` (Network tab).
2. In Railway: delete the service (and its Postgres add-on if it served only
   the public dashboard). The live trading bot runs locally and is unaffected.

The bot's `READ_ONLY_MODE` path in `bot/src/index.ts` is retained — it's the
backend for local `npm run dev:public` (the dev server proxies `/api` to it).
