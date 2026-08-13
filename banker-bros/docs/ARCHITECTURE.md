# Architecture

## Principles

1. **The StonkBroker is the identity.** No BankerPass is minted. `BrokerRegistry` binds a broker ID to an ERC-6551 account only after proving the caller owns the configured NFT and the account reports the exact chain, collection, token ID, and current owner.
2. **Ownership remains live.** Authorization reads `ownerOf` at use time, so an NFT transfer also transfers protocol control. Cached owner addresses are never authoritative.
3. **Routing is narrow.** `BrokerRouter` accepts only approved assets and adapter contracts, with an explicit deadline, minimum output, and 1% hard fee cap.
4. **Game state is derived.** Volume, fees, liquidity, XP, and reputation are emitted and indexed. The chain is authoritative; the indexer is disposable.
5. **RWA access is not implicit.** The core has no stock-token assumptions. Any future restricted asset integration is a separate adapter and policy surface.
6. **Character accounts are self-custodied.** `BankerBrosCollection` is a fixed 222-supply ERC-721. A dedicated registry can recognize its deterministic token-bound accounts as working brokers, but NFT ownership never grants protocol-admin roles or passive treasury claims.

## Contract boundaries

| Component | Responsibility | Upgradeable | Emergency control |
|---|---|---:|---|
| `BrokerRegistry` | NFT/TBA registration, active status, seasons | Yes | Pause registrations; deactivate broker |
| `BrokerVault` | Per-broker asset custody | No, immutable | Controlled by live TBA; router is fixed |
| `BrokerVaultFactory` | Deterministic vault creation | Yes | Pause creation |
| `BrokerRouter` | Slippage-safe adapter routing | Yes | Pause; remove adapter/asset |
| `CommissionAccounting` | Fee liabilities and pull claims | Yes | Pause new accounting; claims remain possible |
| `ReputationEngine` | Nonlinear XP and reputation | Yes | Pause writes |
| `LiquidityAttribution` | Pool/broker liquidity and volume ledger | Yes | Pause writes |
| `BankerHook` | v4 `afterSwap` event/state attribution | No, address permission bits are immutable | Pause callback |
| `BankerBroAccount` | NFT-owned asset custody and contract execution | No, deterministic immutable account | NFT owner only; no admin recovery |
| `BankerBroAccountFactory` | Deterministic per-NFT account deployment | No | None |
| `CityDealDesk` | Atomic escrowed broker deals in allowed assets | Yes | Pause new/accept actions; cancellation remains available |

## Data flow

### Registration

1. The NFT owner supplies a broker ID and already-deployed ERC-6551 account.
2. Registry checks `ownerOf`, `token()`, and `owner()`.
3. Registry stores the account and emits `BrokerRegistered`.
4. The owner may create one deterministic vault. The vault is controlled by the TBA, not the connected EOA.

### Routed trade

1. User signs a router transaction containing broker attribution, an allowlisted adapter, exact input, minimum output, fee rate, deadline, and pool ID.
2. Input moves directly from user to adapter.
3. Adapter returns output to the router.
4. Router transfers net output to the user, sends the fee to accounting, and records volume/XP.
5. If any accounting write fails, the whole route reverts; no partial liability is created.

### Direct v4 swap

`BankerHook.afterSwap` decodes `abi.encode(brokerId)`, derives output-side volume from the pool delta, and attempts attribution. Its external attribution call is fail-open so an indexer/role problem cannot freeze the underlying pool. The event records failures for alerting.

## Scaling

- Stateless RPC/web tiers can be horizontally scaled.
- Event ingestion partitions by chain and block range; read tables key by `(chainId, season, district, brokerId)`.
- Leaderboards should be materialized per district/season and updated incrementally, not recomputed from raw events.
- Districts are indexer/game configuration in early seasons. Move only settlement-critical district rules onchain.
- The router can add adapters without migrating identities or historical state.
- StonkBroker and Genesis 222 identities should use separate registry/router/hook stacks until broker IDs are collection-scoped.
- A subgraph/Ponder instance may lag without affecting trading or claims.

## Upgrade model

Upgradeable modules use ERC-1967 storage and require schedule/execute through `UPGRADER_ROLE` after `upgradeDelay`. The reference proxy/control implementation is intentionally small and testable, but must receive independent review. Production governance should be a multisig plus timelock, with guardian pause separated from upgrade authority. Immutable vaults and hooks reduce the most sensitive upgrade surface.

## Trust assumptions

- The configured StonkBroker NFT and ERC-6551 implementation behave correctly.
- Admins only allowlist reviewed assets/adapters and do not bypass the public deployment ceremony.
- Token behavior is conventional; fee-on-transfer/rebasing assets require dedicated adapters and accounting tests.
- The v4 PoolManager address and hook permission bits are verified before pool initialization.
- Normalized-volume inputs used for XP are economically sane; oracle normalization is an adapter responsibility.
