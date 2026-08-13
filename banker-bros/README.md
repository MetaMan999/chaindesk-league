# Banker Bros Protocol

**Release:** `v0.3.1-rc.1 — Hardened Shared City`

Banker Bros turns an existing StonkBroker NFT and its ERC-6551 token-bound account (TBA) into a persistent, onchain brokerage identity. The protocol attributes crypto liquidity, routed volume, fees, reputation, and seasonal progress to the broker without minting a competing identity NFT.

> **Status:** closed-testnet production candidate. Local security review and automated verification are complete, but this is not an independent audit or approval for real value. Public production still requires an external audit, load/abuse testing, operational rehearsal, and jurisdiction-specific legal review.

## What is included

- Upgradeable `BrokerRegistry`, `CommissionAccounting`, `ReputationEngine`, and `LiquidityAttribution`
- Deterministic per-broker vaults created by `BrokerVaultFactory`
- Pausable router with allowlisted adapters and explicit slippage/deadline protection
- Uniswap v4 ABI-compatible `BankerHook` for best-effort swap attribution
- Role separation, delayed upgrades, emergency pause, fee caps, and reentrancy protection
- Optional fixed 222-piece `Banker Bros: Genesis 222` ERC-721 game-identity collection
- Deterministic token-bound accounts so each Banker Bro can hold assets and perform owner-approved work
- Escrowed `CityDealDesk` for atomic broker-to-broker crypto/test-asset deals
- Playable isometric Liquidity City with 222 visible citizens, five districts, jobs, movement, progression, mobile controls, and local save state
- Wallet-authenticated shared district rooms with a hard 222-player cap, NFT ownership verification, durable single-instance progress, server-validated movement/missions, remote-player rendering, and live leaderboards
- Foundry unit, fuzz, and invariant tests
- Testnet-first deployment/config flow
- React/wagmi game shell, Ponder indexer schema, and optional API boundary
- CI, audit checklist, threat model, token/economy design, and staged launch plan

## Architecture at a glance

```text
StonkBroker NFT ── owns ──> ERC-6551 account ── controls ──> BrokerVault
       │                              │                          │
       └──────── BrokerRegistry <─────┘                          │
                         │                                      │
wallet/player ──> BrokerRouter ──> allowlisted adapter/pool <────┘
                         │
                         ├── CommissionAccounting
                         ├── ReputationEngine
                         └── LiquidityAttribution

Uniswap v4 PoolManager ──> BankerHook ──(best effort)──> LiquidityAttribution
```

Read [ARCHITECTURE.md](docs/ARCHITECTURE.md) before changing trust boundaries.
Read [AUDIT_REPORT.md](docs/AUDIT_REPORT.md) for the release findings, fixes, verification evidence, and remaining launch gates.

## Quick start

Requirements: Foundry, Node 20+, pnpm 9+.

```bash
cp .env.example .env
forge build
forge test -vvv
pnpm install
pnpm typecheck
```

Run the web shell:

```bash
pnpm --filter @banker-bros/web dev
```

Run the multiplayer service in a second terminal:

```bash
pnpm --filter @banker-bros/realtime dev
```

Open the local URL, choose **Enter the City**, then move with WASD, arrow keys, touch controls, or click-to-walk. Read [WORLD.md](docs/WORLD.md) for the current playable scope and the boundary between training gameplay and wallet-confirmed testnet actions.

## Testnet deployment

1. Use an approved crypto-only test asset and a test StonkBroker collection/TBA implementation.
2. Configure `.env` from `.env.example`.
3. Run `script/Deploy.s.sol` with `--broadcast` against a supported testnet.
4. Copy the emitted addresses into `config/addresses.<chainId>.json` and the web/indexer environment.
5. Run `script/WireRoles.s.sol`, verify every role and cap, then transfer admin to a multisig/timelock.
6. Keep all real-world/tokenized-equity flags disabled.

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full ceremony and rollback plan.

## Repository map

```text
src/                 Solidity protocol and local v4-compatible ABI types
test/                unit, fuzz, and invariant tests
script/              Foundry deployment and wiring scripts
apps/web/            wallet-connected game/dashboard shell
apps/realtime/       authenticated presence, district rooms, missions, leaderboards
apps/indexer/        event-derived read model (Ponder)
apps/api/            optional signed metadata/leaderboard boundary
collection/          generated SVG/metadata set, provenance, and trait report
config/              chain and deployed-address manifests
docs/                architecture, gameplay, deployment, security, economy, roadmap
.github/workflows/   reproducible CI
```

## Regulatory boundary

The default system supports crypto/test assets only. Tokenized stocks, RWAs, leveraged products, custody, order-book brokerage, fiat, and yield promises are **not enabled by this repository**. Any future RWA module must be a separately deployed, allowlisted adapter with transfer restrictions, geographic/access controls, legal review, and a new audit.

The optional Banker Bros collection is digital art plus an owner-controlled token-bound game account. It does not automatically replace StonkBroker identity and grants no passive fee share, yield, equity, brokerage permission, or protocol-admin power. When registered in its own collection-scoped registry, its account can actively earn commissions by servicing approved crypto routes. See [COLLECTION.md](docs/COLLECTION.md) and [BROKER_ACCOUNTS.md](docs/BROKER_ACCOUNTS.md).

## License

MIT. Third-party integrations remain subject to their own licenses and terms.
