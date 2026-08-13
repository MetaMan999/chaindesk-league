# Banker Bros Realtime

This service powers the Shared City closed-testnet release candidate. It has no custody authority and cannot execute blockchain transactions.

## Features

- wallet-signature challenge/verification
- 15-minute audience/issuer/token-bound HMAC sessions
- server-sent event district rooms
- up to 222 active authenticated wallets
- server-validated world boundaries and movement speed
- server-validated mission proximity and 15-second cooldowns
- authoritative training XP, city credits, reputation, and leaderboards
- per-IP, per-wallet movement, mission, challenge, body-size, and stream limits
- offline-player expiry with in-process profile retention

## Local run

Set the realtime variables in `.env`, then run from the repository root:

```bash
pnpm --filter @banker-bros/realtime dev
```

Set `VITE_REALTIME_URL=http://127.0.0.1:8787` for the web application. The default CORS list accepts local Vite origins only.

## HTTP surface

- `GET /health`
- `POST /auth/challenge`
- `POST /auth/verify`
- `GET /events` with a bearer session
- `POST /presence` with a bearer session
- `POST /travel` with a bearer session
- `POST /missions/complete` with a bearer session
- `GET /leaderboard?district=Old%20Exchange`

The event stream uses authenticated `fetch` rather than placing bearer tokens in query strings.

## Production boundary

Set `REALTIME_DATA_FILE` to a path on a durable mounted volume. All 222 token-keyed profiles, positions, mission cooldowns, and earned test-game progress use atomic file replacement and restore offline after restart. A legitimate NFT transfer carries that token's game profile to its newly verified owner. Signature challenges and sessions are intentionally never persisted. The bundled store fits the capped, single-service testnet release; use a transactional shared database and multi-instance event fan-out before running multiple realtime replicas.

Never reuse the development session secret. Binding a shared network interface fails unless `REALTIME_SESSION_SECRET` contains at least 32 characters.

Shared-interface startup also requires matching HTTPS auth/origin configuration, `REALTIME_REQUIRE_NFT_OWNERSHIP=true`, the selected `BROKER_IDENTITY_NFT`, a dedicated `REALTIME_RPC_URL`, and `REALTIME_DATA_FILE`. Set `REALTIME_TRUST_PROXY=true` only when direct access is blocked and a trusted proxy overwrites `X-Forwarded-For`.
