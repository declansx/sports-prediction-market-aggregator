# CLAUDE.md

## Project

Sports Prediction Market Router — a personal trading bot that browses sports markets on SX Bet and Polymarket, compares combined odds, and routes trades to the best price (or splits orders across both platforms based on available liquidity).

## Stack

- Runtime: TypeScript + Node.js
- Web dashboard: React + Vite + Tailwind CSS + shadcn/ui
- Database: SQLite + Prisma
- Telegram controller: grammY
- Web3 / wallet: ethers.js v6 (Polygon)
- Containers: Docker Compose (local-first, VPS-ready)

## Commands

```
dev:   npm run dev        # bot engine + API + dashboard concurrently
test:  npm run test       # vitest
build: npm run build      # tsc + vite build
lint:  npm run lint       # eslint
check: npm run typecheck  # tsc --noEmit
```

## Conventions

- All SX Bet and Polymarket API calls go through `src/adapters/` — never call platform APIs from feature code.
- Routing logic lives in `src/router/` — adapters return a normalized `MarketQuote` type, router handles allocation.
- All Prisma access goes through `src/db/` — never import `PrismaClient` directly in feature code.
- Telegram commands live in `src/telegram/commands/` — one file per command.
- Config loaded once at startup via `src/config.ts` — never read `process.env` outside that file.

---

# Building on the SX Bet API

The rules below apply to anyone working on the SX Bet adapter, signing code, or routing logic — and to anyone forking this repo as a starting point for their own SX Bet integration.

## Use the SX Bet API docs MCP. Do not assume you know endpoints, request params, or response shapes.

- Search concepts with `search_sx_bet_documentation`.
- Read full pages with `query_docs_filesystem_sx_bet_documentation` (`head`/`cat` on `/developers/*.mdx`, `/api-reference/*.mdx`).
- If a fact in this file conflicts with the live docs, **the docs win** — flag and update.

## Top rules (silent failures live here)

**YOU MUST** load network constants from `GET /metadata` at startup — `chainId`, `EIP712FillHasher`, `executorAddress`, `TokenTransferProxy`, `domainVersion`, odds ladder step. Never hardcode them in feature code. Wrong values produce `TAKER_SIGNATURE_MISMATCH` / `BAD_BASE_TOKEN` with no other clue.

**YOU MUST** treat `percentageOdds` as a big integer (JS `BigInt`, Python `int`, Rust `U256`, etc.). It's a `10^20` fixed-point implied probability, not a float. Floats silently lose precision.

**YOU MUST** keep stake amounts as integer wei strings (USDC = 6 decimals). No floats anywhere in pricing or signing code.

**YOU MUST** round maker `percentageOdds` **down** to the ladder step (from `/metadata`) before signing. Off-ladder orders are silently rejected.

**YOU MUST** prefer Centrifugo (WebSocket) channels over REST polling for `/orders`, `/orders/odds/best`, and `/trades`. Orderbook state moves fast — between polls, a price you saw can be filled, cancelled, or repriced, so you'd be acting on stale state. WebSocket subscriptions push updates the moment they happen. Polling is also rate-limited and burns the budget fast.

## Verifying SX integration work

If you make a change to the SX adapter, signing code, or routing logic, do not consider the work complete until you've:

1. Run the project's typecheck and test suite.
2. Exercised the affected flow against **testnet** (Toronto) with a small stake (1 USDC).
3. Confirmed the fill landed via `GET /trades?bettor=<wallet>&pageSize=1` on the testnet API.

If you can't run the flow end-to-end (no testnet funds, no API key in this env, no signing key), **say so explicitly** — don't treat a passing typecheck as proof.

## Deterministic checks belong in hooks

If your project uses Claude Code hooks, push these out of this file:

- Post-edit: typecheck + lint.
- Pre-write guard: block hardcoded mainnet/testnet chain IDs (`4162`, `79479957`) and USDC addresses outside the config module.

If a check can be a tool, make it a hook. This file is for judgment calls only.

## Detail (load on demand)

@.claude/sxbet/networks.md
@.claude/sxbet/signing.md
@.claude/sxbet/realtime.md
@.claude/sxbet/markets-and-orders.md
