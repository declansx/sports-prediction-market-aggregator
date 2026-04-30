# SX Bet — signing

**Two different schemes.** Don't mix them. Full reference: `developers/posting-orders.mdx`, `developers/filling-orders.mdx`, `api-reference/eip712-signing.mdx` — copy struct definitions verbatim from there, do not reorder fields, do not paraphrase from search snippets.

## Maker orders (`POST /orders/new`)

- Scheme: `personal_sign` (EIP-191) over `solidityPackedKeccak256`.
- Field order in the packed hash is load-bearing — fetch from `posting-orders.mdx`.
- `expiry` is **deprecated** and must always be `2209006800`. Real expiry is `apiExpiry` (unix seconds).
- `executor` comes from `/metadata.executorAddress`.
- `salt` and `apiExpiry` are required to make orders unique; reuse → `ORDERS_ALREADY_EXIST`.

## Fills (`POST /orders/fill/v2`)

- Scheme: EIP-712 typed data (`signTypedData` / `Account.sign_typed_data`).
- Domain: `{ name: "SX Bet", version: <metadata.domainVersion>, chainId: <network>, verifyingContract: <metadata.EIP712FillHasher> }`. Wrong `chainId` or `verifyingContract` → `TAKER_SIGNATURE_MISMATCH`.
- `desiredOdds` is **taker** implied probability = `10^20 - bestMakerOddsOnOppositeOutcome`.
- `oddsSlippage` is an **integer 0–100** (percent), applied to the **weighted average** across matched orders, not per-order.
- `market` and `message` fields are user-facing — set both to `"N/A"`.
- `fillSalt` must be a fresh 32-byte random value per fill.

## Slippage guidance

| Market | `oddsSlippage` |
| --- | --- |
| Pre-game | 0 |
| Pre-game, large fills | 1–2 |
| In-play | 3–5 |
| Fast-moving in-play | 5–10 |

## Common errors

`TAKER_SIGNATURE_MISMATCH` (domain mismatch), `ODDS_STALE` (no liquidity in tolerance), `INSUFFICIENT_SPACE` (pending fills consuming liquidity), `META_TX_RATE_LIMIT_REACHED` (queue your fills — max 10 in flight), `MATCH_STATE_INVALID` (fixture suspended). Full table: `developers/error-codes.mdx`.
