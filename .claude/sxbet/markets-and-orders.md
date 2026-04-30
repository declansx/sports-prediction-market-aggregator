# SX Bet — markets, odds, orders

Full reference: `developers/markets-and-sports.mdx`, `developers/odds-and-tokens.mdx`, `developers/odds-rounding.mdx`.

## Hierarchy

```
sports → leagues → fixtures → markets → orders
```

- `marketHash` is the primary key for everything orderbook-related.
- A **market** is one binary question. One fixture has many (moneyline, spreads at multiple lines, totals at multiple lines).
- `mainLine: true` → primary line for that market type. Use `onlyMainLine=true` unless you want alternates.
- Some endpoints take `eventId`, others take `sportXeventId` / `sportXEventIds`. Different fields. Check the endpoint reference.
- `liveEnabled: true` → market accepts in-play fills.

## Odds & tokens (the math)

- `percentageOdds`: implied probability × `10^20`. `BigInt` only.
- Maker perspective by default. Taker on the opposite outcome gets `10^20 - percentageOdds`.
- USDC: 6 decimals. `"50000000"` = 50 USDC. Integer wei strings only.
- Min maker order: 10 USDC. Min taker stake: 1 USDC.
- Best-odds endpoints return `null` per side when there's no liquidity — handle it.

## Maker → taker conversion

API responses describe the orderbook from the maker's side. To work it as a taker:

- **Odds**: `taker_implied = 10^20 - maker_percentageOdds` (on the opposite outcome).
- **Fillable stake against a maker order**: `totalBetSize` is the maker's max risk, **not** what a taker can stake. Max taker stake = `totalBetSize * (1 - maker_implied) / maker_implied`. Summing `totalBetSize` directly overstates fillable depth — at 60% maker odds, by 1.5×; at 70%, by 2.3×.
- **Walking the book**: convert each level individually before summing. Levels at different odds convert at different ratios.
- **Payout on a fill**: a taker staking `Y` wins back `Y / taker_implied` (stake + profit).

## Odds ladder

- Step lives at `GET /metadata` (currently `125` → 0.125% intervals → `step = 125 * 10^15` raw).
- Validate: `BigInt(percentageOdds) % step === 0n`.
- Round **down** before signing.
- Don't hardcode `125` — it can change.

## Order management

- Cancel scopes: `/orders/cancel/v2` (specific hashes), `/cancel/event` (one event), `/cancel/all` (everything for a maker on a token). Use the narrowest fit.
- `POST /heartbeat` is a dead-man switch — recommended for any market-making code. Stop pinging → orders auto-cancel.
- Open orders consume your exposure budget against `INSUFFICIENT_BALANCE`. Set short `apiExpiry` on volatile markets.
- Latency target from Montreal: order create p95 100ms, cancel p95 50ms.
