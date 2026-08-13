# Banker Bros: Genesis 222 Collection

## Product definition

`Banker Bros: Genesis 222` is a fixed 222-piece ERC-721 character collection for profiles, districts, community events, season storytelling, and owner-controlled onchain work. Existing StonkBroker NFTs remain supported through their own registry. A dedicated Banker Bros registry can recognize each character's deterministic token-bound account as a broker.

The collection promises no equity, passive fee share, yield, repayment, custody service, investment return, broker-dealer status, access to regulated securities, or governance power. A registered account may actively earn route commissions for services actually performed. Market it as entertainment, digital art, and an onchain game character—not an investment.

## Supply

- 200 community mint slots
- 22 team/community reserve slots
- hard maximum: 222
- default wallet cap: 5; owner may configure 1–20
- default royalty: 5%; immutable ceiling: 10%

The reserve cannot spill into community allocation or exceed 22. The community mint cannot consume the reserve.

## Sale controls

- closed, allowlist, and public phases
- allowance-aware Merkle proofs
- exact-payment requirement
- independent mint pause
- two-step owner transfer
- payout address separated from owner
- no upgradeability after deployment

## Metadata and fairness

The generator deterministically produces 222 unique human voxel banker combinations and SVG assets. Commit the ordered provenance hash before the first mint. A later commit/reveal produces a circular metadata offset, preventing the minter from knowing which ordered artwork a token ID will receive.

The included blockhash reveal is a transparent cosmetic-testnet mechanism, not high-value randomness. A public mainnet sale should use audited VRF and independent review. After reveal and URI validation, the owner can irreversibly freeze metadata.

## Art pipeline

Run `pnpm collection:generate` to reproduce the collection. The character system balances skin-tone ranges, hair textures, facial presentation, age, build, professional styling, and accessories without assigning racial labels or stereotyped traits. The current draft output uses a public development seed and placeholder IPFS URIs; it is suitable for review and testnet. Before mainnet:

1. choose and securely record a final seed
2. generate once in a controlled environment
3. review rarity, visual defects, and prohibited content
4. publish provenance and trait counts
5. pin image and metadata directories to at least two independent services
6. update all placeholder URLs and holder-facing license terms
7. do not regenerate after provenance is committed

## Rights

Commission counsel to draft the collection terms, privacy notice, mint terms, art license, acceptable-use restrictions, sanctions/access policy if applicable, and consumer disclosures. The repository's MIT code license does not settle art or trademark licensing.
