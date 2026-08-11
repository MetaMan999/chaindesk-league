# Robinhood Chain and Stock Token integration

## Outcome

Banker Bros can deploy its external-NFT/ERC-6551 brokerage layer to Robinhood Chain Testnet and can recognize Robinhood Stock Tokens without treating them as ordinary game tokens. The shipped direct route remains limited to valueless `bbUSD` and `bbETH` test assets. Stock Token orders use a separate non-custodial interface that stays inactive until a qualified provider is configured.

The supplied [StonkBroker address](https://robinhoodchain.blockscout.com/token/0xe934e36A439C94017B64a3FecE66AF12099aBF50), `0xe934e36A439C94017B64a3FecE66AF12099aBF50`, is a fungible 18-decimal ERC-20 on Robinhood Chain mainnet. It is an ecosystem token, not the ERC-721 required by ERC-6551. The frontend may show its connected-wallet balance read-only, but the deployment script rejects using the same address as the identity NFT.

This separation is an architectural control, not a claim of regulatory compliance. Robinhood describes Stock Tokens as tokenized debt securities that provide economic exposure without legal or beneficial rights in the underlying issuer, and says they are unavailable to U.S. persons and restricted in additional jurisdictions. See [Robinhood's Stock Token disclosures](https://robinhood.com/rhj/stocktokens/).

## Supported flow

```text
Broker identity NFT ownership
  → resolve/create deterministic ERC-6551 account
  → register brokerage
  → deploy isolated BrokerVault
  → claim and deposit valueless test assets
  → route same-unit test order
  → BankerHook records volume, commission, reputation, and retained-fee AUM
  → RPG save displays confirmed progression
```

The ERC-6551 calls follow the standard `createAccount` and `account` registry interface in [EIP-6551](https://eips.ethereum.org/EIPS/eip-6551). The default registry address in `.env.example` is the standard's singleton address, but every target-chain deployment and account implementation must still be independently verified.

## Two execution lanes

| Lane | Assets | Custody | Required checks | Game attribution |
| --- | --- | --- | --- | --- |
| Direct test route | Explicitly allowlisted six-decimal crypto/test assets | Per-broker `BrokerVault` | active, not halted, direct enabled, deadline, slippage, liquidity | immediate after confirmed transaction |
| Qualified Stock Token route | Canonical Robinhood Stock Token only | Never in `BrokerVault`; provider-specific | canonical UID/address, active state, no halt, fresh metadata, wallet eligibility, expiry, approved provider | only after provider fill callback |

`BrokerRouter.routeTestSwap` explicitly reverts if either side is classified as a Stock Token. `BrokerVault` applies the same allowlist boundary to deposits and withdrawals. `submitQualifiedOrder` does not transfer a Stock Token; it forwards a typed request to the configured partner after eligibility checks. Only that partner can call `recordQualifiedFill`, and every partner order can be attributed once.

## Canonical asset synchronization

Robinhood's [Stock Token APIs](https://docs.robinhood.com/chain/stock-token-apis/) expose:

- `/assets` for stable UID, symbol, per-chain contract address, status, and current/pending multiplier;
- `/prices` for bid/ask, generated time, and trading-halt state;
- `/corporate-actions` for splits, dividends, mergers, and other multiplier-affecting events.

The official [contract directory](https://docs.robinhood.com/chain/contracts/) warns that a matching name or ticker is not enough; canonical contract address is what identifies a Robinhood Stock Token. An authorized synchronization service should therefore:

1. select the deployment whose chain ID matches the connected chain;
2. verify its checksummed contract address and token UID;
3. write the UID, class, symbol, and direct-routing-disabled flag to `RobinhoodAssetRegistry`;
4. write active/halt/multiplier/source timestamp state;
5. pause or deactivate the asset when data is missing, stale, conflicting, or a corporate action is unresolved.

Qualified state expires after one hour by default. The registry owner may set a value from five minutes to seven days, but production policy should be based on the source cache window, partner SLA, market-halt response time, and independent risk review.

The API price is for the underlying and is not multiplier-adjusted; the official docs require applying the current multiplier when converting it. Banker Bros does not perform price discovery in the contracts—the qualified partner owns quoting, execution, settlement, and reconciliation.

## Network configuration

Robinhood's [connection guide](https://docs.robinhood.com/chain/connecting/) lists:

| Network | Chain ID | Public RPC | Explorer |
| --- | ---: | --- | --- |
| Robinhood Chain | 4663 | `https://rpc.mainnet.chain.robinhood.com` | `https://robinhoodchain.blockscout.com` |
| Robinhood Chain Testnet | 46630 | `https://rpc.testnet.chain.robinhood.com` | `https://explorer.testnet.chain.robinhood.com` |

Public endpoints are rate-limited and not recommended for production. The repository's liquidity deploy script permits only local chain `31337` and Robinhood Chain Testnet `46630` by default. Mainnet requires deliberately overriding the guard and must not happen before audits, a qualified provider, legal approval, monitoring, multisig control, and an incident plan.

## Testnet deployment

Required environment values:

```dotenv
PRIVATE_KEY=
TREASURY=
ROBINHOOD_TESTNET_RPC_URL=https://rpc.testnet.chain.robinhood.com
STONKBROKER_TOKEN_ADDRESS=0xe934e36A439C94017B64a3FecE66AF12099aBF50
BROKER_IDENTITY_NFT_ADDRESS=0x0000000000000000000000000000000000000000
BROKER_IDENTITY_NFT_CHAIN_ID=46630
ERC6551_REGISTRY_ADDRESS=0x000000006551c19487814612e58FE06813775758
ERC6551_ACCOUNT_IMPLEMENTATION=
ERC6551_ACCOUNT_SALT=0
TEST_SWAP_FEE_BPS=30
```

Set `BROKER_IDENTITY_NFT_ADDRESS` to the zero address to deploy the included Broker License NFT. If an external NFT is supplied, it must be readable on the same execution chain. If the source NFT is on another chain, stop: use an independently audited bridge or ownership-attestation design. Do not put a remote NFT address into this deployment and assume local `ownerOf` will work.

Dry-run, review, then broadcast:

```bash
forge script contracts/script/DeployBrokerLiquidity.s.sol:DeployBrokerLiquidity \
  --rpc-url "$ROBINHOOD_TESTNET_RPC_URL"

forge script contracts/script/DeployBrokerLiquidity.s.sol:DeployBrokerLiquidity \
  --rpc-url "$ROBINHOOD_TESTNET_RPC_URL" \
  --broadcast
```

The script deploys the dedicated Broker License when the external identity field is the zero address, the asset registry, two valueless faucet assets, broker registry, attribution hook, and router. The license is connected to the registry so its onchain metadata resolves the ERC-6551 account and vault dynamically. It configures the direct test assets and transfers admin ownership to `TREASURY`. It intentionally does not register Stock Tokens or a qualified provider.

## Frontend configuration

```dotenv
VITE_CHAIN_ID=46630
VITE_RPC_URL=https://rpc.testnet.chain.robinhood.com
VITE_STONKBROKER_TOKEN_ADDRESS=0xe934e36A439C94017B64a3FecE66AF12099aBF50
VITE_BROKER_LICENSE_ADDRESS=0x...
VITE_BROKER_IDENTITY_NFT_ADDRESS=0x...
VITE_ERC6551_REGISTRY_ADDRESS=0x000000006551c19487814612e58FE06813775758
VITE_BROKER_REGISTRY_ADDRESS=0x...
VITE_BROKER_ROUTER_ADDRESS=0x...
VITE_BANKER_HOOK_ADDRESS=0x...
VITE_ROBINHOOD_ASSET_REGISTRY_ADDRESS=0x...
VITE_DIRECT_TEST_TOKEN_A=0x...
VITE_DIRECT_TEST_TOKEN_B=0x...
```

Open the RPG's Broker Passport and choose `Enter Wall Street`. One transaction mints the Broker License and creates its ERC-6551 account and vault; the license ID is selected automatically. Returning license holders are detected without minting again. Both test assets can then be claimed from their faucets; deposit the output token into the new vault before routing the input token. Once the swap receipt confirms, the RPG increases commission, reputation, and AUM and records the transaction intent.

## Production gate

Do not enable Stock Token order submission until all of the following are named, implemented, and tested:

- eligible user locations and a provider-owned identity/eligibility lifecycle;
- sanctions, transfer restriction, market-halt, and position-close-only handling;
- disclosures and explicit consent separated from the fictional game economy;
- canonical asset and corporate-action synchronization with stale-data fail-closed behavior;
- quoting, best-execution, custody, settlement, cancellation, failed-fill, and reconciliation rules;
- surveillance, complaints, records, reporting, privacy, and retention ownership;
- multisig administration, pause runbooks, monitoring, key rotation, and incident response;
- contract audit, partner sandbox and fork tests, load testing, and jurisdiction-specific legal approval.

The game must never award progression merely for holding or rapidly trading a regulated asset. A qualified fill may produce a bounded service reputation signal, but it must not create simulated custody or AUM inside the test vault.
