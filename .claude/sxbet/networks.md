# SX Bet — networks & auth

Full reference: `developers/testnet-and-mainnet.mdx`, `developers/authentication.mdx`.

## Config swap

Store everything that differs in a `cfg` object switched by `SX_ENV`:

| | Testnet (Toronto) | Mainnet |
| --- | --- | --- |
| API base | `https://api.toronto.sx.bet` | `https://api.sx.bet` |
| WS | `wss://realtime.toronto.sx.bet/connection/websocket` | `wss://realtime.sx.bet/connection/websocket` |
| Chain ID | `79479957` | `4162` |
| USDC | `0x1BC6326EA6aF2aB8E4b6Bc83418044B1923b2956` | `0x6629Ce1Cf35Cc1329ebB4F63202F3f197b3F050B` |

Everything else (`executorAddress`, `EIP712FillHasher`, `TokenTransferProxy`, `domainVersion`, ladder step) is **fetched from `GET /metadata` at startup**.

## Auth tiers

| Operation | Auth |
| --- | --- |
| Read markets/orders/trades (REST) | none |
| Subscribe to Centrifugo channels, register heartbeat | API key (`x-api-key` on `/user/realtime-token/api-key`) |
| Post / fill / cancel orders | wallet signature |

API keys are network-scoped. Generate one per environment.

## Pre-flight on a fresh wallet

Betting will reject silently with "betting not enabled" until `TokenTransferProxy` is approved for the base token. Either bet once through the UI or call `POST /orders/approve`.
