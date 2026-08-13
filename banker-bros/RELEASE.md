# Banker Bros v0.3.1-rc.1 — Hardened Shared City

## Release contents

- complete crypto/test-asset Solidity protocol, deployment scripts, and chain manifests
- fixed 222-piece Genesis collection, provenance, deterministic ERC-6551 accounts, deal desk, and v4-compatible attribution hook
- freshly compiled wallet-connected web application in `apps/web/dist`
- performant 222-citizen isometric world with WASD, arrows, click-to-walk, touch controls, five districts, missions, progression, and reduced-motion support
- domain/URI/chain/token-bound wallet authentication with one-use challenges and 15-minute sessions
- mandatory NFT ownership verification whenever the service binds a shared interface
- hard 222-active-player capacity, district rooms, authoritative movement and missions, reconnect handling, and live leaderboards
- atomic durable single-instance profile recovery; sessions and challenges are never written to disk
- fail-closed shared deployment configuration, bounded request/state maps, rate limits, request timeouts, graceful shutdown, and container health check
- CI, security review, threat model, audit preparation, deployment ceremony, tokenomics boundary, and staged roadmap

## Verification snapshot

- current frontend strict TypeScript check: passing
- current production web bundle: passing
- realtime syntax and adversarial tests: 10 passing
- Solidity unit/fuzz/invariant tests: 22 passing
- collection count: 222 images and 222 metadata records
- duplicate trait combinations: 0
- accounting invariant: 128,000 calls with 0 reverts
- deployable contract sizes: under EIP-170 limits

## Release boundary

This is a closed-testnet production candidate, not a public-mainnet certification. The bundled profile store supports one capped service instance. Multiple replicas require a transactional shared database, distributed rate limits, and room event fan-out. Public launch also requires an independent contract/backend audit, 222-concurrent-user load and abuse testing, monitoring/on-call rehearsal, moderation/privacy tooling, and exact-chain fork tests.

Use test assets only. Tokenized stocks, RWAs, leverage, fiat, passive yield, production custody, and unlicensed securities activity are disabled or outside scope.
