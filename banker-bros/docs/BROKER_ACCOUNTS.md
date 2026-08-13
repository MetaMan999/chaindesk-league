# Banker Bro Accounts and City Work

Every Genesis 222 NFT can control a deterministic token-bound account created by `BankerBroAccountFactory`. The account is a self-custodied smart-contract wallet: its current controller is always `BankerBrosCollection.ownerOf(tokenId)`. There is no protocol-admin recovery key.

## What the account can hold

- native ETH
- conventional allowlisted ERC-20 crypto/test assets
- ERC-721 collectibles
- ERC-1155 game items
- vault positions or position NFTs issued by reviewed integrations

The account may call contracts through owner-only `execute`. It deliberately supports CALL only; delegatecall is disabled so an external target cannot rewrite account storage. It also exposes ERC-1271 signature validation and ERC-6551-style `token`, `owner`, `state`, and `isValidSigner` surfaces.

## Activation

1. Mint or acquire Banker Bro `#N`.
2. Call `BankerBroAccountFactory.createAccount(N)`. Anyone may deploy the deterministic account, but only the NFT owner controls it.
3. Register `#N` and its account in a `BrokerRegistry` configured for the Banker Bros collection.
4. Create a broker vault if needed.
5. Through the account, approve only the exact reviewed router, deal desk, or position manager and only the required amount.

Transferring the ERC-721 changes the account owner immediately. The account and its assets remain at the same address. Marketplaces and wallet UIs must warn buyers and sellers that the NFT controls a potentially valuable account. The parent NFT cannot be safe-transferred into its own account.

Do not use raw `transferFrom` to send the parent NFT into its own account. ERC-721 unsafe transfers skip the receiver check and can permanently lock control. Production collection UIs must block that destination and display the predicted account before transfers.

## City Deal Desk

`CityDealDesk` supports escrowed spot swaps between registered broker accounts:

- maker account escrows an approved asset and posts exact terms
- deal may name one taker broker or remain open to any active broker
- taker account supplies the exact counter-asset
- both legs are balance-delta checked and settle atomically
- maker may cancel while open; anyone may trigger refund after expiry

There are no loans, leverage, partial fills, arbitrary callbacks, fiat, RWAs, securities, or passive yield. Nonstandard fee-on-transfer/rebasing assets fail the exact-balance checks and should not be allowlisted.

## Uniswap v4 work

The account can perform two types of liquidity work:

1. Call `BrokerRouter.route` after approving an allowlisted crypto asset. Volume, commissions, and reputation are attributed to its registered broker ID.
2. Call a reviewed canonical v4 router/position manager directly. Supply `abi.encode(tokenId)` as `hookData` for pools initialized with `BankerHook`. The hook records best-effort volume attribution and never takes custody.

`BankerHook` is an attribution hook, not a pricing oracle or compliance system. Hook data can be submitted by public callers, so its volume is a signal that requires anti-wash-trading analysis; commissions remain governed by the router/accounting path.

## Integration boundary

Use a dedicated `BrokerRegistry` instance configured with `BankerBrosCollection` for Genesis 222 brokers. A separate registry may remain configured with the existing StonkBroker collection. Do not mix numeric broker IDs from different registries in one router/hook deployment without adding collection-scoped IDs.
