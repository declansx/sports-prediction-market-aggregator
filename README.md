# Sports Prediction Market Aggregator

Smart order router for sports prediction markets — aggregates liquidity from **SX Bet** and **Polymarket**, routes your trade to the best price, or splits it across both venues based on available liquidity and the size of your trade.

Bet through the **React dashboard** or, optionally, a **Telegram bot** for mobile control — both backed by the same routing engine, with a **REST API** behind them. Normalized order books from both venues stream in real-time. Trades execute on-chain via ethers.js (Polygon for Polymarket, SX Network for SX Bet).

**Live read-only dashboard:** [spm-aggregator-readonly.vercel.app](https://spm-aggregator-readonly.vercel.app/)

https://github.com/user-attachments/assets/6f221a08-d802-45a5-a210-ef12a96f99ae

---

## How to use

| You want to... | Start here |
|---|---|
| Browse aggregated order books and stats — no wallet, no setup | [Read-only dashboard](https://spm-aggregator-readonly.vercel.app/) |
| Run the bot on your own wallet and execute real trades | [Quickstart](#quickstart) |
| Fork it, modify it, or lift the SX Bet adapter for your own project | [Architecture](#architecture) → [Extending the bot](#extending-the-bot) |

---

## Stack

- **Runtime** — TypeScript, Node 18+, npm workspaces
- **Bot** — Express, Prisma + SQLite, grammY (Telegram), ethers.js v6, viem, Zod
- **Dashboard** — React, Vite, Tailwind, shadcn/ui
- **Real-time** — Centrifuge client (SX Bet) + native WS (Polymarket CLOB)
- **Order signing** — `@polymarket/clob-client-v2` (EIP-712 + L2 HMAC, viem-based); SX Bet EIP-712 directly via ethers
- **Tests** — Vitest

## Quickstart

### Prerequisites

- Node.js 18+ and npm 9+
- An **SX Bet account** ([sign up](https://sx.bet)) with USDC funded on **SX Network**. New to SX Bet? See the [account guide](https://docs.sx.bet/developers/accounts) and the [deposit guide](https://docs.sx.bet/user-guides/deposit-withdraw/transfer-crypto).
- A **Polymarket account** ([sign up](https://polymarket.com)) with pUSD funded on **Polygon** and CLOB API credentials generated. The polymarket.com UI handles signup, deposits, and key export — see [Proxy Wallets](https://docs.polymarket.com/polymarket-101#proxy-wallets) for context.
- You can use the same EOA private key for both venues, but each wallet needs to be funded on its own chain.

### 1. Clone and install

```bash
git clone https://github.com/<your-username>/sports-prediction-market-router.git
cd sports-prediction-market-router
npm install
```

### 2. Configure

```bash
cp bot/.env.example bot/.env
```

Fill in `bot/.env`:

| Variable | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Optional. Token from BotFather — enables the Telegram controller |
| `TELEGRAM_AUTHORIZED_CHAT_ID` | Optional (required if `TELEGRAM_BOT_TOKEN` is set). Your Telegram chat ID — only this chat can control the bot |
| `POLYMARKET_FUNDER_ADDRESS` | Polymarket proxy wallet address (polymarket.com → Settings) |
| `POLYMARKET_API_KEY` / `_SECRET` / `_PASSPHRASE` | CLOB L2 credentials (polymarket.com → Settings → API Keys) |
| `POLYMARKET_PRIVATE_KEY` | Private key of the EOA that owns the Polymarket proxy wallet (polymarket.com → Settings → Export Private Key) |
| `SX_PRIVATE_KEY` | Private key for SX Bet wallet (sx.bet → [Assets page](https://docs.sx.bet/developers/accounts)) |
| `SX_BET_API_KEY` | SX Bet API key — required for the realtime feed (see [API Key guide](https://docs.sx.bet/api-reference/api-key)) |
| `POLYGON_RPC_URL` | Polygon RPC (default public endpoint works) |
| `SX_NETWORK_RPC_URL` | SX Network RPC (defaults to `https://rpc-rollup.sx.technology`) |
| `DATABASE_URL` | Leave as `file:./prisma/dev.db` for local SQLite |
| `LOG_LEVEL` | `fatal` \| `error` \| `warn` \| `info` (default) \| `debug` \| `trace` \| `silent` |
| `READ_ONLY_MODE` | Optional. Set to `true` to boot the public read-only API (no trading, no Telegram). See [Read-only / public mode](#read-only--public-mode) |

> **Never commit `bot/.env`** — it contains private keys. The repo's `.gitignore` already excludes it.

### 3. Initialise the database

```bash
cd bot && npx prisma generate && npx prisma migrate dev --name init && cd ..
```

### 4. Run

```bash
npm run dev   # starts bot API + dashboard concurrently
```

- Bot API → `http://localhost:3001`
- Dashboard → `http://localhost:5173`
- Telegram (if configured) → message `/menu` to your bot

### 5. Place a bet

<img width="1728" height="963" alt="mlb-odds" src="https://github.com/user-attachments/assets/f14f8ec8-3736-4984-9820-36cc3bb79ad4" />

1. Open [http://localhost:5173](http://localhost:5173)
2. Pick a market and enter your bet size
3. Click **Execute** — the router fills your bet at the best available odds across both venues
4. Open the **History** page to see the fill (tx hash, fill price, platform split)

## Architecture

```
        ┌────────────┐         ┌────────────┐
        │  Dashboard │         │  Telegram  │
        │ React/Vite │         │   grammY   │
        └──────┬─────┘         └──────┬─────┘
               │ REST + WS relay      │ inline keyboard
               ▼                      ▼
        ┌──────────────────────────────────┐
        │         Bot (Express API)        │
        │  ┌────────┐  ┌────────┐  ┌─────┐ │
        │  │adapters│─▶│ router │─▶│ exec│ │
        │  └────┬───┘  └────────┘  └──┬──┘ │
        │       │                     │    │
        │  ┌────▼──────┐    ┌─────────▼──┐ │
        │  │ SQLite    │    │ ethers/viem│ │
        │  │ (Prisma)  │    │   signer   │ │
        │  └───────────┘    └─────┬──────┘ │
        └──────────────────────────┼───────┘
              │              │     │
              ▼              ▼     ▼
        ┌─────────┐    ┌──────────┐  ┌──────────┐
        │ SX Bet  │    │Polymarket│  │ Polygon  │
        │ REST+WS │    │ CLOB+WS  │  │ + SX RPC │
        └─────────┘    └──────────┘  └──────────┘
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start bot + dashboard (concurrently) |
| `npm run build` | Compile TypeScript + build dashboard |
| `npm run test` | Vitest suite (bot workspace) |
| `npm run lint` | ESLint across both workspaces |
| `npm run typecheck` | `tsc --noEmit` across both workspaces |

## Project structure

```
.
├── bot/
│   ├── prisma/               Prisma schema + migrations
│   └── src/
│       ├── adapters/         SX Bet + Polymarket clients (return normalised MarketQuote)
│       │   ├── sxbet.ts
│       │   ├── polymarket.ts
│       │   ├── balance.ts             On-chain USDC balance reader
│       │   ├── teamNames.ts           Cross-venue team-name canonicalisation (manual aliases)
│       │   └── teamNamesGenerated.ts  Auto-generated by sync-teams
│       ├── router/           Allocation engine (no venue specifics)
│       ├── executor/         Trade execution per venue (sxbet.ts, polymarket.ts)
│       ├── routes/           REST API (markets, trade, orderbook, balances, history, stats)
│       ├── services/         Realtime clients + caches
│       │   ├── centrifugo.ts        SX Bet Centrifugo client
│       │   ├── polymarketWs.ts      Polymarket CLOB WS client
│       │   ├── orderBookCache.ts    SX order-book state
│       │   ├── polymarketBookCache.ts
│       │   ├── oddsCache.ts / polymarketOddsCache.ts
│       │   └── marketGroups.ts      Cross-venue market grouping
│       ├── ws/               Browser-facing WS relay (ref-counted fan-out)
│       ├── sync/             Background market polling loop
│       ├── db/               All Prisma access (markets.ts, trades.ts, teamAlias.ts, index.ts)
│       ├── telegram/
│       │   ├── commands/     One file per slash command
│       │   ├── screens/      One file per inline-keyboard screen
│       │   └── bot.ts
│       ├── leagues.ts        LeagueConfig registry (add a league here)
│       ├── config.ts         Zod-validated env (single source of truth)
│       ├── app.ts            Full Express app (authenticated)
│       └── publicApp.ts      Read-only Express app (public dashboard mode)
└── dashboard/
    └── src/                  React + Vite frontend
```

## How routing works

Before the router can compare prices across SX Bet and Polymarket, it has to recognise when both venues are listing the same wager. Two normalisation passes — one for the fixture, one for the outcome — produce a unified view; the router then allocates your stake across the merged book and executes on each side.

### 1. Match the same fixture across venues

Each venue lists markets with its own naming conventions ("Brentford FC" vs "Brentford", "CA Lanús" vs "Lanús"). Every team name goes through a canonicalisation chain:

1. Sport-scoped manual override (`Kings` → Sacramento Kings for Basketball, LA Kings for Hockey)
2. Global manual map (`adapters/teamNames.ts`) — hand-written aliases
3. Auto-generated map (`adapters/teamNamesGenerated.ts`)
4. Affix stripping — drops common org prefixes (`AFC`, `CA`, `Club`…) and suffixes (`FC`, `SC`…) so "Brentford FC" and "Brentford" collapse
5. Trailing-parenthesis strip — "Stade Brestois (Brest)" → "Stade Brestois"

Markets from different venues are then grouped by a single key: `{sport, league, sortedTeamNames, 6h-startTime-bucket}`. The 6-hour bucket tolerates small startTime differences between venues, while keeping consecutive-day NBA games separate.

### 2. Match the same bet within a fixture

Within a fixture, each outcome maps to a canonical bet key independent of venue. SX and Polymarket each have their quirks — Polymarket spreads come as separate "Home -1.5 YES" / "Away +1.5 NO" tokens, SX puts both sides on one market — but the canonical key folds them together:

- **1x2** (soccer) — `1x2:home`, `1x2:draw`, `1x2:away`
- **12** (American sports, no draw) — `12:home`, `12:away`
- **Spreads** — `spread:home:-1.5`, `spread:away:+1.5` (keyed from each side's perspective)
- **Totals** — `total:over:2.5`, `total:under:2.5`

Outcomes sharing a canonical key are *siblings*. When you click an outcome to trade, the router pulls every sibling across both venues into one merged order book.

### 3. Allocate across the merged book

The router flattens all sibling order-book levels into one ladder, sorts ascending by odds (cheapest first), and walks it filling your stake from each level until satisfied. Levels come from a fallback chain:

1. Live WS caches — SX from Centrifugo, Polymarket from CLOB WS — first preference
2. DB `liquidityLevels` snapshot (refreshed by the sync loop every ~30s) — fallback when the WS frame hasn't arrived yet
3. A single synthesized level from `(currentOdds, liquidityDepth)` — last resort

It then computes the weighted-average fill odds and compares to the global best price. If `(weighted − best) / best > slippageTolerance` (default 5%), the trade is rejected before any signing happens. `maxTradeSize` (default 100) caps the total stake.

### 4. Execute

Each non-zero allocation goes to its venue's executor:
- **Polymarket** — FOK (Fill-Or-Kill) order via `@polymarket/clob-client-v2`
- **SX Bet** — EIP-712 maker-fill order via ethers

Both submit concurrently. Trade rows are persisted with tx hash, fill price, and platform split; a Telegram fill summary is sent.

## Extending the bot

### Add a new league

1. Edit `bot/src/leagues.ts` and append a `LeagueConfig`:

   ```ts
   export const MY_LEAGUE: LeagueConfig = {
     name: 'My League',
     sport: 'Soccer',
     hasDraw: true,
     sxbet: { leagueId: 1234 },                              // from SX Bet /leagues
     polymarket: { seriesId: 10188, titleOrdering: 'home' }, // from Polymarket Gamma /sports
   };

   export const ACTIVE_LEAGUE: LeagueConfig = MY_LEAGUE;
   ```

   For American sports (NHL/NBA/MLB), set `hasDraw: false` and `titleOrdering: 'away'` — Polymarket titles those as `"AwayTeam vs HomeTeam"` (soccer is the opposite). Omit the `polymarket` block entirely for SX-only leagues.

2. Add team-name mappings for the new league (see below). **Do this before going live** — without correct mappings, fixtures won't match across venues and the router will treat them as separate markets.

### Team-name mapping

SX Bet and Polymarket name the same team differently — "Manchester City FC" vs "Manchester City", "CA Lanús" vs "Lanús", "Sport Lisboa e Benfica" vs "Benfica". The router relies on a canonicalisation map to merge them.

**Where mappings live:**
- `bot/src/adapters/teamNames.ts` — `MANUAL` map (hand-written, always wins) + `MANUAL_BY_SPORT` (sport-scoped overrides for cross-sport collisions like "Kings" → Sacramento Kings vs Los Angeles Kings)
- `bot/src/adapters/teamNamesGenerated.ts` — auto-generated output of `npm run sync-teams`

**The reliable flow is to add entries manually.** For each team in the new league, add rows to the `MANUAL` map mapping every variant you've seen on either venue to one canonical name. Use the SX Bet form as canonical (shorter and prefix-free):

```ts
'manchester city': 'Manchester City',
'manchester city fc': 'Manchester City',
'man city': 'Manchester City',
```

To find the variants on both venues:
- SX Bet → `GET https://api.sx.bet/markets/active?leagueId=<id>` — read `teamOneName` / `teamTwoName`
- Polymarket → `GET https://gamma-api.polymarket.com/events?series_id=<id>` — read team names from event titles

Add entries for: the bare name, the name with `FC`/`SC`/`CF` suffix, the name with `AFC`/`CA`/`Club` prefix, and common nicknames. Affix stripping (handled automatically by the router) catches most prefix/suffix variants without an explicit entry, but explicit entries are unambiguous and easier to debug when something doesn't match.

**About `npm run sync-teams`:** the script attempts to auto-resolve mappings using exact match → affix stripping → token-subset → Jaro-Winkler fuzzy match, and writes results to `teamNamesGenerated.ts`. Low-confidence matches and unresolved teams are written as commented-out lines for human review. Treat the generated file as a draft, not a source of truth — if you care about getting fixtures matched correctly, hand-write the mappings in `MANUAL` and let those override anything auto-generated.

### Add a new venue adapter

1. Create `bot/src/adapters/<venue>.ts` that exports a function returning `MarketQuote[]`
2. Add a corresponding executor in `bot/src/executor/<venue>.ts`
3. Wire it into `router/index.ts` allocation
4. Add `<VENUE>_API_*` and signing-key env vars to `bot/src/config.ts`

The adapter contract is the only seam — the router consumes `MarketQuote` and doesn't know what venue produced it.

## API reference

The bot exposes a JSON HTTP API on port `3001` for the dashboard and any other client. Use it to fetch markets and order books, preview routing decisions before executing, submit trades, or read trade history and balances. All endpoints are unauthenticated — bind to localhost only, or put it behind a proxy that adds auth.

See [API.md](API.md) for full request/response shapes per endpoint.

## Telegram

**Optional.** The Telegram bot is a mobile controller that complements the dashboard — useful for placing or monitoring trades from your phone. The bot runs perfectly fine without it; everything you can do in Telegram you can do in the dashboard.

Only the chat ID set in `TELEGRAM_AUTHORIZED_CHAT_ID` receives any response — messages from any other chat are silently dropped. There's no public-facing surface.

### Features

**Mobile controller** — `/menu` opens an inline-keyboard UI that mirrors the dashboard:
- Browse by sport → league → fixture
- View side-by-side SX Bet / Polymarket odds for each outcome
- Place trades with a routing preview (allocation split, weighted odds, slippage)
- Paginate trade history with tx hashes and fill prices

All navigation edits the same message in place — no scrollback clutter — and market screens auto-refresh as odds change.

**Slash commands**
- `/menu` — open the main inline-keyboard UI
- `/status` — summary of your most recent trade

**Trade notifications** — every trade execution sends a fill or failure summary to the authorized chat automatically, regardless of where the trade was placed (dashboard, Telegram, or REST). The notification includes market name, outcome, size, platform, fill odds, and tx hash. Failures include the rejection reason.

### Setup

1. Open a chat with [@BotFather](https://t.me/BotFather) and send `/newbot`. Choose a name and username; BotFather returns a token.
2. Get your Telegram chat ID — message [@userinfobot](https://t.me/userinfobot) and copy the numeric ID it replies with.
3. Set both values in `bot/.env`:
   ```
   TELEGRAM_BOT_TOKEN=<token from BotFather>
   TELEGRAM_AUTHORIZED_CHAT_ID=<your chat ID>
   ```
4. Restart the bot, then send `/menu` to your bot.

## Logging

Structured logs via [pino](https://github.com/pinojs/pino) — pretty-printed in dev, JSON one-line-per-event when `NODE_ENV=production` for piping to a log aggregator. Verbosity is controlled by `LOG_LEVEL` (default `info`); valid values are `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`. Sensitive paths (`*.privateKey`, `*.apiKey`, `*.secret`, `*.passphrase`, `*.token`) are auto-redacted before output.

## Safety and disclaimers

Personal trading tool, published as-is.

- **Real money.** Trades execute on Polygon (Polymarket) and SX Network (SX Bet) mainnets. No testnet.
- **Private keys live in `bot/.env`.** Never share, commit, or expose the API to the public internet without auth in front of it. The Telegram bot only responds to `TELEGRAM_AUTHORIZED_CHAT_ID`; the dashboard and REST API have no auth — bind them to localhost.
- **No warranty.** Bugs, RPC lag, slippage failures, stale data — all possible. Start small, verify each path on your own wallet before scaling.
- **Jurisdiction.** Prediction markets and sports betting are regulated differently across jurisdictions; confirm this is legal where you live.

## Contributing

Issues and PRs welcome. Before opening a PR, run `npm run typecheck && npm run lint && npm run test`.

## License

MIT — see [LICENSE](LICENSE). Use it, fork it, ship it, sell it; just don't sue me when an RPC blip costs you money.
