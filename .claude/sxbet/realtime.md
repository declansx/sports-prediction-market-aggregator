# SX Bet — real-time (Centrifugo)

REST is rate-limited (5,500/min on `/orders/*`, 200/min on `/trades/*`, 35,000/10min global). Anything resembling a stream comes through Centrifugo. Full reference: `api-reference/centrifugo-best-practices.mdx`.

## Patterns LLMs get wrong

- **Subscribe before snapshot.** Create the subscription first, fetch the REST snapshot inside the `subscribed` handler. Snapshot-then-subscribe leaks updates.
- **Both `positioned: true` and `recoverable: true`.** Either alone does nothing useful. Channels without history (`best_odds`, `parlay_markets`) need neither — re-seed from REST every reconnect.
- **Handle recovery.** On reconnect, check `wasRecovering` and `recovered`. `recovered === false` → 5-min history window expired → re-seed from REST.
- **Dedup on `ctx.tags.messageId`.** Delivery is at-least-once. Cap the seen-ID set (e.g. 1,000) to avoid leaks.
- **Don't block in publication handlers.** Server buffers ~1 MB per connection. Slow consumer → disconnect. Push to a queue, process out-of-band.
- **512 subscriptions per connection.** Beyond that, spin up additional client instances.

## Useful channels

- `order_book_v2:{baseToken}:{marketHash}` — full book for one market.
- `best_odds:{baseToken}` — best odds across all markets (no history; re-seed on reconnect).
- `active_orders_v2:{baseToken}:{address}` — your open orders' lifecycle.
- `recent_trades:global` — every trade; filter to your `bettor` address client-side.

## Token refresh

Use the `getToken` callback pattern in the Centrifuge client — don't fetch once and reuse. Tokens are short-lived.
