CREATE TABLE chain_event (
  chain_id bigint NOT NULL,
  block_number bigint NOT NULL,
  block_hash bytea NOT NULL,
  tx_hash bytea NOT NULL,
  log_index integer NOT NULL,
  contract_address bytea NOT NULL,
  event_name text NOT NULL,
  payload jsonb NOT NULL,
  block_time timestamptz NOT NULL,
  PRIMARY KEY (chain_id, tx_hash, log_index)
);

CREATE TABLE broker (
  chain_id bigint NOT NULL,
  broker_id numeric(78,0) NOT NULL,
  nft_address bytea NOT NULL,
  account_address bytea NOT NULL,
  controller_address bytea,
  season_joined integer NOT NULL,
  active boolean NOT NULL,
  registered_block bigint NOT NULL,
  PRIMARY KEY (chain_id, broker_id)
);

CREATE TABLE broker_season (
  chain_id bigint NOT NULL,
  season_id integer NOT NULL,
  broker_id numeric(78,0) NOT NULL,
  district_id text NOT NULL DEFAULT 'global',
  xp numeric(78,0) NOT NULL DEFAULT 0,
  reputation integer NOT NULL DEFAULT 0,
  trades bigint NOT NULL DEFAULT 0,
  normalized_volume numeric(78,0) NOT NULL DEFAULT 0,
  liquidity_points numeric(78,0) NOT NULL DEFAULT 0,
  updated_block bigint NOT NULL,
  PRIMARY KEY (chain_id, season_id, broker_id, district_id)
);

CREATE TABLE broker_asset_balance (
  chain_id bigint NOT NULL,
  broker_id numeric(78,0) NOT NULL,
  asset_address bytea NOT NULL,
  claimable numeric(78,0) NOT NULL DEFAULT 0,
  lifetime_fees numeric(78,0) NOT NULL DEFAULT 0,
  updated_block bigint NOT NULL,
  PRIMARY KEY (chain_id, broker_id, asset_address)
);

CREATE TABLE pool_broker (
  chain_id bigint NOT NULL,
  pool_id bytea NOT NULL,
  broker_id numeric(78,0) NOT NULL,
  attributed_liquidity numeric(78,0) NOT NULL DEFAULT 0,
  attributed_volume numeric(78,0) NOT NULL DEFAULT 0,
  updated_block bigint NOT NULL,
  PRIMARY KEY (chain_id, pool_id, broker_id)
);

CREATE INDEX broker_season_rank_idx
  ON broker_season (chain_id, season_id, district_id, xp DESC, broker_id);
CREATE INDEX chain_event_replay_idx ON chain_event (chain_id, block_number, log_index);

CREATE TABLE broker_account (
  chain_id bigint NOT NULL,
  collection_address bytea NOT NULL,
  token_id numeric(78,0) NOT NULL,
  account_address bytea NOT NULL,
  created_block bigint NOT NULL,
  execution_nonce numeric(78,0) NOT NULL DEFAULT 0,
  PRIMARY KEY (chain_id, collection_address, token_id)
);

CREATE TABLE city_deal (
  chain_id bigint NOT NULL,
  deal_desk_address bytea NOT NULL,
  deal_id numeric(78,0) NOT NULL,
  maker_broker_id numeric(78,0) NOT NULL,
  taker_broker_id numeric(78,0),
  maker_asset bytea NOT NULL,
  taker_asset bytea NOT NULL,
  maker_amount numeric(78,0) NOT NULL,
  taker_amount numeric(78,0) NOT NULL,
  expires_at timestamptz NOT NULL,
  status text NOT NULL,
  updated_block bigint NOT NULL,
  PRIMARY KEY (chain_id, deal_desk_address, deal_id)
);

CREATE INDEX city_deal_status_idx
  ON city_deal (chain_id, status, expires_at, maker_broker_id, taker_broker_id);
