# Audit Preparation

## Scope freeze package

- exact git commit and compiler settings
- deployed chain and dependency address/code-hash manifest
- architecture and trust assumptions
- privilege matrix and upgrade ceremony
- threat model, known issues, and prior findings
- test inventory and coverage report
- storage-layout diff for each upgradeable contract
- invariants and economic assumptions

## Invariants

1. For each token, `totalAccounted == sum(brokerClaimable) + treasuryClaimable`.
2. Accounting token balance is at least `totalAccounted`.
3. Platform fee never exceeds 20%; per-route fee never exceeds 1%.
4. Broker liquidity cannot become negative.
5. One broker has at most one factory vault.
6. Only the live TBA may withdraw from a vault.
7. An unallowlisted adapter or asset can never receive route input.
8. Paused modules reject their risk-creating operations.

## Required additional tests

- fork tests against exact NFT, ERC-6551, PoolManager, and approved adapters
- fee-on-transfer, rebasing, revert/no-return/false-return token matrix
- upgrade storage compatibility tests (implementation UUID/proxy-context/self-upgrade regression tests are included)
- role handoff and emergency runbook simulation
- hook tests using canonical v4 core/periphery test harness
- long-sequence stateful testing across claims, pauses, transfers, and upgrades
- differential fee/accounting model in a second language

## Known intentional limitations

- Local v4 types are an ABI subset for dependency-free testing; production must pin canonical packages.
- No meta-transactions, permits, session keys, or sponsored transactions are included.
- No oracle normalization contract is included; XP assumes adapter-normalized values.
- No RWA or tokenized-stock adapter exists.
- No DAO/reward token is launched.
