# Internal Audit Report — v0.3.1-rc.1

Date: 2026-08-13  
Scope: protocol contracts, upgrade/proxy control plane, Shared City service, wallet login, game synchronization, movement/mission loop, web production bundle, CI, container, and deployment documentation.

This is an internal engineering security review, not an independent audit. All findings listed below are fixed in this release unless explicitly marked as a remaining launch gate.

## Fixed findings

| Severity | Area | Finding | Resolution |
|---|---|---|---|
| High | multiplayer capacity | An inactive profile could return after the city reached 222 active players and overflow the cap. | Re-entry now checks active capacity; adversarial regression test added. |
| High | authentication | Login intent was not fully bound to service URI, chain, and Banker Bro token ID. | One-use EIP-4361-style challenges now bind domain, URI, chain, wallet, expiry, and token ID; shared mode verifies current NFT ownership. |
| High | session parsing | Non-canonical base64url HMAC encodings could produce an alternate textual token with identical bytes. | Canonical encoding and exactly two token segments are required before constant-time verification. |
| High | token transfers | Low-level ERC-20 helpers could treat a call to an address without code as a successful no-return transfer. | Both transfer paths now reject code-less token addresses; vault regression tests added. |
| High | upgrades | `proxiableUUID` was callable through a proxy and the upgrade path did not explicitly reject the proxy itself. | UUPS implementation-context guard and proxy self-upgrade rejection added and tested. |
| Medium | mission integrity | Repeated `E` input, overlapping requests, and client-only position could create reward spam or visual/server desynchronization. | Offline and server cooldowns, repeat suppression, in-flight movement guard, authoritative correction, proximity checks, and request timeouts added. |
| Medium | durability/identity | A service restart erased multiplayer profiles, and wallet-keyed progress could follow a wallet to another character. | Atomic versioned snapshots key all 222 profiles by token ID, survive restarts, and follow legitimate NFT transfers; secrets, sessions, challenges, streams, and rate buckets are excluded. |
| Medium | resource exhaustion | Challenges, profiles, rate buckets, request bodies, and event streams lacked complete bounds. | Explicit caps, expiry cleanup, 16 KiB JSON limit, per-wallet stream cap, backpressure close, and request/header timeouts added. |
| Medium | deployment safety | A shared service could start with development-grade ownership, origin, transport, or persistence configuration. | Shared binding now fails unless HTTPS identity/origins match, the secret is strong, NFT/RPC verification is enabled, and durable storage is configured. |
| Medium | account refresh | Registry account refresh did not preflight that the replacement account contained code. | Code existence check added before ERC-6551 inspection; regression test added. |
| Low | claims | Broker commission claims accepted the zero recipient. | Zero-recipient claims now revert. |
| Low | controls/accessibility | Movement could remain held after focus loss; touch controls and reconnect/cooldown states were not sufficiently explicit. | Blur resets keys; directional controls, focus outlines, reduced motion, disabled states, reconnect labels, and accessible canvas/control labels improved. |
| Low | privacy/resilience | The UI fetched third-party web fonts at runtime. | External font import removed in favor of local system fonts. |

## Verification evidence

- `forge fmt --check`: pass
- `forge build`: pass
- deployable runtime sizes: pass, all below 24,576 bytes
- Solidity: 22/22 tests pass
- fee fuzzing: 256 cases pass
- collection royalty fuzzing: 256 cases pass
- accounting invariant: 128,000 calls, 0 reverts
- realtime: 10/10 tests pass, including tamper, token-transfer identity, capacity, movement, cooldown, and restart persistence cases
- frontend strict type check: pass
- frontend production build: pass
- realtime JavaScript syntax check: pass

## Remaining launch gates

1. Independent smart-contract and backend review; this report cannot replace auditor sign-off.
2. Exact-chain fork tests against the selected ERC-6551 implementation, PoolManager, approved adapters, and final NFT collection.
3. Canonical Uniswap v4 dependency pinning and hook-address permission verification on the target chain.
4. Storage-layout diff/rehearsal for every future upgrade and final multisig/timelock role transfer.
5. 222-concurrent-user load, reconnect, slow-client, rolling-restart, RPC-failure, and abuse tests.
6. Transactional shared persistence, distributed rate limiting, and event fan-out before more than one realtime replica.
7. Monitoring, backup/restore drill, incident response, moderation/privacy tools, security contact, and operator runbooks.
8. Browser/device visual QA using the actual production hosting, wallets, TLS proxy, and target testnet. Automated build checks passed; this sandbox could not expose a local preview port for interactive browser testing.

No real-value or real-world-asset launch is approved by this report. Keep crypto/test-asset allowlists and all RWA/tokenized-stock modules disabled.
