# Roadmap

## Phase 0 — Local and design freeze

- ship the playable 222-citizen city alpha and validate desktop/mobile frame rate
- complete canonical v4 dependency pinning and fork harness
- review all 222 draft artworks, finalize license/provenance, and VRF decision
- validate StonkBroker collection/TBA contracts and ownership transitions
- close unit/fuzz/invariant gaps and commission balance-delta checks
- publish threat model, roles, monitoring, and legal boundaries

Exit: green CI, frozen scope, no known high/critical findings.

## Phase 1 — Closed testnet

- deploy on Robinhood Chain Testnet, or Sepolia fallback
- crypto/test assets only; one reviewed adapter and one pool
- invite 25–100 brokers; exercise vaults, routes, claims, pause, replay, and season reset
- add authenticated presence, shared district rooms, server-authoritative job cooldowns, and indexed public profiles
- run indexer/RPC failover and reorg drills

Exit: 7-day clean soak, accounting invariant holds, emergency rehearsal succeeds.

## Phase 2 — Public testnet season

- districts, quests, achievements, and public leaderboards
- load-test to 10k registered brokers and high event volume
- independent audit and bug bounty
- mobile/responsive polish and transaction simulation

Exit: audit findings closed, monitoring live, product/legal/security go/no-go.

## Phase 3 — Guarded crypto mainnet beta

- low caps, limited assets/adapters, multisig/timelock, public status page
- gradual TVL and route caps based on incident-free epochs
- immutable season configuration snapshots

Exit: multiple stable seasons and demonstrated operator maturity.

## Phase 4 — Scale

- more crypto markets and specialized districts
- sponsored transactions/session keys after separate security work
- permissionless adapter proposals with delayed governance and code-hash review
- multi-chain identity aggregation without cross-chain custody shortcuts

## Optional RWA track

This is not part of any phase above. It begins only after separate regulatory, transfer-restriction, jurisdiction, partner, oracle, corporate-action, and audit work. RWA adapters stay independently deployable and off by default.
