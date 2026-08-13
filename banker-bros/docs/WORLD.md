# Liquidity City World

## What is playable now

The web application contains a responsive isometric city simulation designed to display the complete 222-character Genesis population at once. It has no 3D-library dependency and uses a resolution-aware canvas renderer so the world remains lightweight on ordinary browsers.

Players can:

- enter as Banker Bro #1–222
- move with WASD, arrow keys, on-screen controls, or click-to-walk
- see 222 independently moving citizens
- fast-travel between Old Exchange, Neon Heights, Market Gardens, Ledger Square, and Degen Wharf
- approach job buildings and press `E` to work
- complete swap routing, deal settlement, liquidity balancing, accounting, and volatile-order training loops
- earn local city credits, XP, reputation, office levels, and activity history
- retain progress across browser sessions
- switch to a 72-citizen performance mode on slower hardware

## Game-state boundary

The city is immediately playable without a wallet. Offline jobs and rewards are an educational simulation and are stored in browser local storage. City credits are not ERC-20 tokens, money, redeemable points, yield, or transferable value.

When `VITE_REALTIME_URL` is configured, a player can sign a human-readable login challenge and join a shared district room. The signature does not authorize a transaction. The service validates movement, fast travel, mission proximity, cooldowns, and training rewards; other authenticated wallets appear as blue avatars and live standings update through an authenticated event stream.

The mint, token-bound account, broker registry, router, commission accounting, deal desk, and Uniswap v4 hook are separate testnet contract surfaces. A wallet confirmation is required before those actions can change onchain state. Simulated jobs must not be indexed as real protocol work.

## Capacity and performance

The renderer keeps the entire deterministic population in memory, culls off-screen citizens, limits display resolution to 2× device pixel ratio, and draws the city in depth order. The population toggle allows slower mobile devices to render 72 nearby citizens while retaining the canonical 222-person world definition.

## Multiplayer release candidate and production path

The current release includes a durable single-instance multiplayer candidate capped at 222 active NFT owners. It deliberately keeps offline mode available. A public horizontally scaled shared world additionally requires:

1. transactional shared persistence and multi-instance room fan-out
2. continuous finalized-chain ownership refresh for long-running sessions
3. stronger distributed rate limiting and anti-cheat telemetry
4. indexer-derived onchain achievements
5. moderation, privacy, blocking, and reporting tools
6. load tests for 222 concurrent users, reconnects, rolling deploys, and reorg behavior

Do not represent the deterministic local citizen simulation as human users. Only the blue authenticated avatars and server-reported online count represent connected wallets. The service remains non-custodial.
