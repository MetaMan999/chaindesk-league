# Robinhood Chain Testnet deployment

This runbook deploys the Banker Bros brokerage loop to **Robinhood Chain Testnet only**. It creates a dedicated Broker License ERC-721, an ERC-6551 account implementation, the asset registry, valueless `bbUSD` and `bbETH` faucets, `BrokerRegistry`, `BankerHook`, and `BrokerRouter`.

The StonkBroker address `0xe934e36A439C94017B64a3FecE66AF12099aBF50` is kept as a read-only ecosystem-token reference. It is a fungible token on Robinhood Chain mainnet and is never used as the Broker License NFT or deposited into the test vault.

## 1. Release gates

Before broadcasting:

- run `npm test` and `npm run build` from the repository root;
- confirm chain ID `46630` from the RPC;
- confirm code exists at the canonical ERC-6551 registry address;
- use a newly created testnet deployer funded only with test ETH;
- set `TREASURY` to the intended testnet admin wallet;
- inspect the dry-run addresses and ownership transfers;
- do not set `ALLOW_UNSAFE_CHAIN=true`.

Never paste a private key into chat, commit it, or put it in a frontend `VITE_` variable.

## 2. Local configuration

Copy `.env.example` to an ignored `.env` and fill these deployment-only values locally:

```dotenv
PRIVATE_KEY=<FUNDED_TESTNET_DEPLOYER_PRIVATE_KEY>
TREASURY=0x...
ROBINHOOD_TESTNET_RPC_URL=https://rpc.testnet.chain.robinhood.com
STONKBROKER_TOKEN_ADDRESS=0xe934e36A439C94017B64a3FecE66AF12099aBF50
BROKER_IDENTITY_NFT_ADDRESS=0x0000000000000000000000000000000000000000
BROKER_IDENTITY_NFT_CHAIN_ID=46630
ERC6551_REGISTRY_ADDRESS=0x000000006551c19487814612e58FE06813775758
ERC6551_ACCOUNT_IMPLEMENTATION=
ERC6551_ACCOUNT_SALT=0
TEST_SWAP_FEE_BPS=30
```

Leaving `ERC6551_ACCOUNT_IMPLEMENTATION` blank deploys the included `BrokerTokenBoundAccount`. `TEST_SWAP_FEE_BPS` may not exceed 100 (1%).

Load the ignored environment without printing it:

```bash
set -a
source .env
set +a
```

## 3. Preflight and dry run

```bash
cast chain-id --rpc-url "$ROBINHOOD_TESTNET_RPC_URL"
cast code 0x000000006551c19487814612e58FE06813775758 \
  --rpc-url "$ROBINHOOD_TESTNET_RPC_URL"
cast balance "$(cast wallet address --private-key "$PRIVATE_KEY")" \
  --rpc-url "$ROBINHOOD_TESTNET_RPC_URL"

forge script contracts/script/DeployBrokerLiquidity.s.sol:DeployBrokerLiquidity \
  --rpc-url "$ROBINHOOD_TESTNET_RPC_URL" \
  -vvvv
```

The first command must return `46630`, the registry must return non-empty bytecode, and the deployer must have enough test ETH before continuing.

## 4. Broadcast

```bash
forge script contracts/script/DeployBrokerLiquidity.s.sol:DeployBrokerLiquidity \
  --rpc-url "$ROBINHOOD_TESTNET_RPC_URL" \
  --broadcast \
  -vvvv
```

Record all eight deployed addresses from the broadcast artifact under `broadcast/`:

- Broker License
- Broker token-bound account implementation
- Robinhood asset registry
- `bbUSD`
- `bbETH`
- Broker registry
- Banker hook
- Broker router

The canonical ERC-6551 registry is reused; it is not redeployed.

## 5. Verify the deployment

For each address, confirm the code and constructor transaction on `https://explorer.testnet.chain.robinhood.com`. Then verify:

- `BrokerLicense.brokerRegistry()` equals the deployed Broker Registry;
- `BrokerRegistry.router()` and `bankerHook()` equal their deployed addresses;
- `BrokerRegistry.accountImplementation()` has bytecode;
- `BrokerRouter.testSwapFeeBps()` equals `30` (or the reviewed value);
- all owner-controlled contracts report `TREASURY` as owner;
- both faucet assets are active direct assets;
- no Robinhood Stock Token is registered for direct routing;
- `BrokerRouter.qualifiedPartner()` is zero.

## 6. Frontend configuration

Only public values belong in the frontend environment:

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

Build again after setting those values. Never expose `PRIVATE_KEY` or other secrets through a `VITE_` name.

## 7. End-to-end acceptance test

In the RPG Chain Desk:

1. connect a Robinhood Chain Testnet wallet;
2. choose **Enter Wall Street** to mint the Broker License and atomically create its ERC-6551 account and isolated vault;
3. claim both valueless test assets;
4. deposit `bbETH` into the vault as simulated output liquidity;
5. approve `bbUSD` to the router and route a simulated swap;
6. confirm the transaction in the testnet explorer;
7. confirm trades, lifetime volume, commission, reputation, and AUM changed in `BrokerRegistry`;
8. reload the game and confirm the RPG save restores the onchain result.

This test does not trade, custody, or route a tokenized stock. Stock Token order submission remains disabled until the production gates in `ROBINHOOD_STOCK_TOKEN_INTEGRATION.md` are satisfied.

## 8. Rollback and incident response

There is no destructive rollback for deployed contracts. Before public testing, confirm the treasury can pause the router. If a defect appears, pause routing, remove the frontend addresses, publish a notice, preserve transaction logs, and deploy a reviewed replacement. Do not reuse a compromised signer or silently point the UI at new contracts.
