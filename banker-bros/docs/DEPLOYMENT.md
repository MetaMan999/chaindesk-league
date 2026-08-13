# Deployment

## Supported first targets

Robinhood Chain Testnet is the preferred target (chain ID `46630`). Its public RPC is rate-limited, so production-like load tests and indexing should use a dedicated provider. Sepolia (`11155111`) is the fallback when a required PoolManager, NFT, or ERC-6551 dependency is unavailable.

## Preconditions

- Contract commit is tagged and CI is green.
- Deployer is a new testnet-only key with only enough gas for the ceremony.
- Admin is a multisig/timelock, guardian is a separate multisig, and treasury is verified.
- The selected identity collection is explicit: existing StonkBroker or Genesis 222. Deploy separate registries when supporting both.
- v4 PoolManager and canonical type/package versions are pinned for the target chain.
- `rwaModulesEnabled` is `false`.

## Ceremony

```bash
cp .env.example .env
forge test --profile ci
forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$TESTNET_RPC_URL" --broadcast --slow -vvvv
```

For Genesis 222, deploy the collection first, set `BROKER_IDENTITY_NFT` to its address, deploy the core stack, then deploy its deterministic account factory and deal desk:

```bash
forge script script/DeployCollection.s.sol:DeployCollection --rpc-url "$TESTNET_RPC_URL" --broadcast
forge script script/Deploy.s.sol:Deploy --rpc-url "$TESTNET_RPC_URL" --broadcast
forge script script/DeployCityExtensions.s.sol:DeployCityExtensions --rpc-url "$TESTNET_RPC_URL" --broadcast
```

Allowlist deal assets separately from router assets. Begin with disposable test tokens. Register two NFT accounts and complete an open, accept, settle, expiry, and refund drill before inviting users.

The deployment script uses the broadcaster only as a temporary bootstrap admin, wires the router's recorder roles atomically, grants admin/upgrader to `ADMIN_ADDRESS`, and revokes the broadcaster. Record every proxy and implementation in `config/addresses.<chainId>.json`, including deployment block and source commit. Verify source through the target explorer.

Hook deployment is separate because Uniswap v4 encodes callback permissions in the hook address. Mine a CREATE2 salt for `AFTER_SWAP_FLAG` only, deploy through an agreed CREATE2 deployer with `DeployHook.s.sol`, and independently verify `(uint160(hook) & ((1 << 14) - 1)) == (1 << 6)`.

After deploying the hook, grant its attribution recorder role through the admin multisig. `WireRoles.s.sol` is suitable for local/single-admin test environments; production should submit the equivalent `setRole` call through the multisig rather than exposing a multisig signer key:

```bash
forge script script/WireRoles.s.sol:WireRoles \
  --rpc-url "$TESTNET_RPC_URL" --broadcast -vvvv
```

Allowlist assets and adapters one at a time. Use a test adapter first, then exercise registration, vault creation, route, fee claim, pause, unpause, and a delayed upgrade rehearsal.

## Shared City service

For local multiplayer, configure `REALTIME_SESSION_SECRET`, `ALLOWED_ORIGINS`, and `VITE_REALTIME_URL`, then run `apps/realtime`. For a shared closed testnet, also configure matching HTTPS `REALTIME_AUTH_DOMAIN`/`REALTIME_AUTH_URI`, `REALTIME_REQUIRE_NFT_OWNERSHIP=true`, `BROKER_IDENTITY_NFT`, a dedicated `REALTIME_RPC_URL`, and `REALTIME_DATA_FILE` on a mounted durable volume. The health endpoint reports active players, the 222-player capacity, profile count, and persistence mode.

Build the included container from the repository root:

```bash
docker build -f apps/realtime/Dockerfile -t banker-bros-realtime .
```

Place the service behind TLS and a hardened proxy. Its atomic file store is suitable only for one capped service instance. Before public multi-replica use, replace it with a reviewed transactional store, distributed rate limits, and event fan-out. Keep finalized-chain ownership verification enabled so a wallet cannot claim a Banker Bro number it does not control.

## Testnet go/no-go

- 7+ days without critical alerts or unexplained accounting drift
- indexer survives a 500-block reorg simulation and full replay
- all liabilities equal held token balances
- pause completes within the operational SLA
- one complete multisig/timelock upgrade rehearsal
- load test meets p95 read target and RPC budget
- external review closes all high/critical findings

## Rollback

Pause the router first, then affected writers. Remove the compromised adapter/asset. Claims should remain available unless the token itself is compromised. Never upgrade during an active incident without a reviewed migration plan. Publish the incident block, affected components, and recovery instructions.

## Robinhood-specific notes

The chain is an Arbitrum-based EVM L2 using ETH for gas. Treat sequencer downtime and delayed L1 finality as explicit operational states. The public RPC is unsuitable for high-throughput production use; configure multiple provider endpoints and an archive endpoint for indexing.
