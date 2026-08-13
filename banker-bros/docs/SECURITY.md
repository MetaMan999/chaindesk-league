# Security

## Security properties

- Registration proves NFT ownership and exact ERC-6551 token binding.
- Controller authorization follows live NFT ownership.
- Vault withdrawal is TBA-only; vault router cannot be changed.
- Router limits tokens, adapters, deadline, output slippage, and fee rate.
- Fees are pull-claimed and liability-accounted before transfer.
- State-changing external value paths use reentrancy guards or checks-effects-interactions.
- Guardians pause; admins unpause; upgrades are separately delayed.
- Hook attribution fails open so game telemetry cannot freeze a v4 pool.

## Checklist before real value

- [ ] Replace or formally validate local proxy/access primitives against canonical audited implementations.
- [ ] Pin canonical Uniswap v4 core/periphery commits; compare every local ABI type and selector.
- [ ] Audit every adapter and malicious-token behavior.
- [ ] Add permit/signature nonce tests if gasless routes are introduced.
- [ ] Add fork tests against exact PoolManager and ERC-6551 deployments.
- [ ] Run Slither, fuzz 100k+ cases, invariant 10k+ runs, and mutation testing.
- [ ] Verify storage layouts for every upgrade.
- [ ] Verify roles, code hashes, fee caps, assets, adapters, and hook address bits onchain.
- [ ] Move admin/upgrader/guardian to separate multisigs and enforce timelock policy.
- [ ] Establish monitoring, incident response, bug bounty, and public security contact.
- [ ] Obtain legal review before any RWA, stock token, rewards token, referral, or fee-sharing launch.
- [ ] Audit the collection separately before a paid mint; validate reserve/community caps, Merkle tree construction, reveal source, provenance, payout, royalties, metadata pinning, and holder license.
- [ ] Audit token-bound account ownership transitions, ERC-1271 signatures, receiver callbacks, NFT ownership cycles, arbitrary-call scope, account/NFT marketplace disclosures, and deterministic address derivation.
- [ ] Block the predicted token-bound account as a parent-NFT destination in official UIs. Raw ERC-721 `transferFrom` bypasses receiver callbacks and can permanently lock control even though safe transfers are rejected.
- [ ] Audit deal escrow with malicious/reentrant/fee-on-transfer tokens, expiry boundaries, approval residue, cancellation, pause behavior, and registry deactivation.

## Multiplayer service

- Login messages state their purpose and never request transaction authority.
- Bearer sessions are short-lived and HMAC-signed; event streams use authorization headers rather than token query strings.
- Login challenges bind domain, URI, chain, wallet, and Banker Bro token ID; challenges are one-use and NFT ownership is mandatory on shared interfaces.
- Movement speed, world boundaries, fast-travel destinations, mission proximity, rewards, and cooldowns are server validated.
- Shared-interface binding refuses unsafe origins, HTTP identity configuration, missing ownership RPC, missing durable storage, and the development secret. Production secrets must be random, rotated, and held by a secret manager.
- Durable single-instance profiles use atomic replacement and never contain sessions or challenges. Public multi-replica deployment still requires a transactional shared store, distributed rate limits/event fan-out, moderation, observability, and load/security testing.

## Monitoring

Alert on pauses, role changes, upgrade schedules/execution, adapter/asset/deal-asset changes, broker deactivation, account deployment, high-value account execution, deal expiry/cancellation, failed hook attribution, accounting balance/liability mismatch, unusual fee rate, abnormal per-broker volume, indexer lag, and RPC disagreement.

## Responsible disclosure

Before public testnet, publish a `SECURITY.md` contact with an encrypted channel and response SLA. Do not advertise a bounty until scope, reward bands, safe-harbor language, and payment authority are finalized.

See [THREAT_MODEL.md](THREAT_MODEL.md) and [AUDIT_PREP.md](AUDIT_PREP.md).
