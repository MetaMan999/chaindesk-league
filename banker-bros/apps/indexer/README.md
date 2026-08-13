# Indexer

This service is a replaceable read model. It must never authorize trades, claims, or upgrades.

Recommended production implementation: Ponder or an equivalent reorg-aware EVM indexer writing PostgreSQL. Ingest from each deployment block, retain `(chain_id, block_number, block_hash, tx_hash, log_index)`, and make that tuple idempotent. Roll back orphaned blocks before applying a new canonical branch.

## Event coverage

- `BrokerRegistered`, `BrokerStatusChanged`, `SeasonChanged`
- `VaultCreated`, `Deposited`, `Withdrawn`, `StrategyTransfer`
- `RouteExecuted`, `AdapterAllowed`, `AssetAllowed`
- `FeeRecorded`, `BrokerClaimed`, `TreasuryClaimed`
- `ProgressRecorded`, `LiquidityChanged`, `SwapAttributed`
- `HookSwapAttributed`, `HookAttributionFailed`
- every role, pause, and upgrade event
- `AccountCreated`, `TransactionExecuted`, `EtherReceived`
- `DealOpened`, `DealSettled`, `DealCancelled`, `DealAssetAllowed`

Apply [schema.sql](schema.sql), then generate typed handlers from the compiled ABIs in `out/`. Materialize leaderboards by `(chain_id, season_id, district_id)` every 30–60 seconds and expose stale-at timestamps to the web client.
