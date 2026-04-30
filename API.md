# API Reference

The bot exposes a JSON HTTP API on port `3001`. All endpoints are prefixed with `/api`. Responses are `application/json`. Errors come back as `{ "error": "<code>", "message": "<details>" }` with a non-2xx status.

The API has no auth — bind it to localhost only, or front it with a reverse proxy that adds auth.

## Endpoint summary

| Method | Path | Purpose | Public |
|---|---|---|---|
| `GET` | `/api/health` | Liveness + DB check | ✅ |
| `GET` | `/api/markets` | Active markets (joined from both venues) | ✅ |
| `GET` | `/api/trade/orderbook` | Merged order book ladder for an outcome | ✅ |
| `GET` | `/api/stats/markets` | Coverage stats (matched fixtures, best-odds counts) | ✅ |
| `GET` | `/api/trade/preview` | Allocation plan + estimated fill | |
| `POST` | `/api/trade` | Execute trade (signs and submits on-chain) | |
| `GET` | `/api/trades` | Past trades, paginated | |
| `GET` | `/api/balances` | Live USDC and pUSD balances on both chains | |
| `GET` | `/api/config` | All BotConfig key/value rows | |
| `PUT` | `/api/config/:key` | Update a BotConfig value | |

The "Public" column marks endpoints exposed by the read-only app (`READ_ONLY_MODE=true`). Trade and wallet endpoints are absent in that mode.

---

## GET /api/health

Liveness check. Pings the database with `SELECT 1`.

**Response 200**
```json
{ "status": "ok", "db": "connected" }
```

**Response 500**
```json
{ "status": "error", "db": "unreachable", "message": "..." }
```

---

## GET /api/markets

Returns active markets from both venues, normalised to one schema. Each market includes its outcomes with implied odds, available size, and a canonical bet key for cross-venue grouping.

**Response 200** — array of:

```json
{
  "id": "string",
  "eventId": "string",
  "platform": "sx",
  "externalId": "string",
  "sport": "Soccer",
  "league": "UCL",
  "homeTeam": "Liverpool",
  "awayTeam": "Real Madrid",
  "name": "Liverpool vs Real Madrid",
  "startTime": "2026-04-29T18:00:00.000Z",
  "status": "active",
  "betType": "1x2",
  "line": null,
  "mainLine": true,
  "sxEventId": "string",
  "fixtureState": null,
  "outcomes": [
    {
      "id": "string",
      "label": "Liverpool",
      "platform": "sx",
      "externalId": "0x...:0",
      "impliedOdds": 0.55,
      "availableSize": 1500.0,
      "lastUpdated": "2026-04-29T17:55:00.000Z",
      "canonicalKey": "1x2:home"
    }
  ]
}
```

`platform` is `"sx"` or `"polymarket"`. `betType` is `"1x2"`, `"12"`, `"spread"`, or `"total"`. `line` is non-null for spreads and totals.

---

## GET /api/trade/orderbook

Merged order-book ladder across all canonical siblings of an outcome. Used by the dashboard's bet-slip view.

**Query**
- `outcomeId` (required) — Outcome ID from `/api/markets`

**Response 200**
```json
{
  "levels": [
    { "odds": 0.52, "size": 250.0, "platform": "polymarket" },
    { "odds": 0.53, "size": 1200.0, "platform": "sx" }
  ],
  "sxMarketHash": "0x...",
  "sxSide": 0,
  "polyTokenId": "..."
}
```

Levels are sorted ascending by odds (cheapest first). `sxMarketHash` / `sxSide` / `polyTokenId` are convenience pointers for subscribing to live updates over the WS relay.

---

## GET /api/stats/markets

Coverage stats for the next 24 hours: how many fixtures, how many are matched across both venues, and which venue has the best odds where.

**Response 200**
```json
{
  "totalMarkets": 142,
  "markets24h": 38,
  "matched24h": 27,
  "bestOdds24h":          { "sx": 18, "poly": 20, "total": 38 },
  "bestOddsMatched24h":   { "sx": 14, "poly": 13, "total": 27 },
  "bestOddsAll24h":       { "sx": 22, "poly": 16, "total": 38 },
  "bestOddsAllMatched24h":{ "sx": 16, "poly": 11, "total": 27 },
  "byLeague": [
    {
      "sport": "Soccer",
      "league": "UCL",
      "games24h": 6,
      "matched24h": 5,
      "mainLine": { "sx": 3, "poly": 2, "total": 5 },
      "allLines": { "sx": 4, "poly": 1, "total": 5 }
    }
  ]
}
```

`bestOdds*` counts how many fixtures have their best price on each venue. `*Matched*` variants restrict to fixtures present on both venues. `mainLine` covers main-line spreads/totals; `allLines` includes alternates.

---

## GET /api/trade/preview

Build an allocation plan for a candidate trade. Does NOT submit anything on-chain — useful for showing the user the routing decision before they confirm.

**Query**
- `outcomeId` (required)
- `side` (required) — buy direction
- `size` (required) — stake in USD

**Response 200**
```json
{
  "allocations": [
    {
      "platform": "sx",
      "outcomeId": "string",
      "externalMarketId": "0x...",
      "externalOutcomeId": "0x...:0",
      "size": 75.0,
      "expectedOdds": 0.523,
      "estimatedSlippage": 0.012
    }
  ],
  "totalSize": 100.0,
  "weightedOdds": 0.527,
  "totalSlippage": 0.018
}
```

**Errors**
- `400 size_exceeds_max` — size > `BotConfig.maxTradeSize`
- `404 outcome_not_found`
- `422 slippage_exceeded` — body includes `detail.slippage` and `detail.tolerance`
- `400 no_liquidity` — no order-book levels available for any sibling

---

## POST /api/trade

Build an allocation plan and execute it. Signs and submits orders concurrently per allocation. Notifies Telegram on each fill or failure.

**Body**
```json
{ "outcomeId": "string", "side": "string", "size": 100 }
```

**Response 201** — at least one allocation filled
```json
{
  "status": "filled",
  "trades": [
    { "tradeId": "string", "status": "filled", "platform": "sx", "txHash": "0x..." }
  ],
  "plan": { "allocations": [], "totalSize": 100, "weightedOdds": 0.527, "totalSlippage": 0.018 }
}
```

`status` is `"filled"` (all allocations filled), `"partial"` (some filled, some failed), or `"failed"` (none filled, response is `422`).

Pre-execution errors (`outcome_not_found`, `size_exceeds_max`, `slippage_exceeded`) match `/preview` and surface before any signing happens.

---

## GET /api/trades

Past trades, newest first, paginated.

**Query**
- `page` (default `1`)
- `limit` (default `20`, max `100`)

**Response 200**
```json
{
  "total": 142,
  "page": 1,
  "limit": 20,
  "trades": [
    {
      "id": "string",
      "createdAt": "2026-04-29T17:55:00.000Z",
      "marketName": "Liverpool vs Real Madrid",
      "outcomeLabel": "Liverpool",
      "platform": "sx",
      "side": "buy",
      "requestedSize": 100,
      "executedSize": 100,
      "requestedOdds": 0.527,
      "fillOdds": 0.527,
      "status": "filled",
      "txHash": "0x...",
      "failureReason": null
    }
  ]
}
```

`status` is `"filled"`, `"failed"`, or `"pending"`.

---

## GET /api/balances

Live wallet balances on both chains. Reads `balanceOf(funder)` directly from the ERC-20 contracts (USDC on SX Network, pUSD on Polygon).

**Response 200**
```json
{
  "sx":   { "address": "0x...", "balance": 250.42, "token": "USDC", "chain": "SX Network" },
  "poly": { "address": "0x...", "balance": 412.10, "token": "pUSD", "chain": "Polygon" }
}
```

Either field may be `null` if the read failed (RPC error, missing config, etc.) — check logs.

---

## GET /api/config

All `BotConfig` rows.

**Response 200**
```json
[
  { "key": "maxTradeSize",      "value": "100" },
  { "key": "slippageTolerance", "value": "0.05" },
  { "key": "orderBookLevels",   "value": "10" }
]
```

## PUT /api/config/:key

Upsert a `BotConfig` value. The `:key` URL parameter is the config key.

**Body**
```json
{ "value": "150" }
```

**Response 200** — the upserted row.

`orderBookLevels` is validated server-side (integer, 3–25) and applied immediately to the SX order-book cache. Other keys are stored as-is — your code is responsible for reading them.
