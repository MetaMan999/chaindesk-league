# Banker Bros: Genesis 222

This is the character and cosmetic collection for Banker Bros. It is intentionally separate from the liquidity identity layer: owning a Banker Bro does not replace a StonkBroker NFT/ERC-6551 account and grants no protocol administration, custody, commission, investment, brokerage, or profit rights.

## Visual system

- Original human voxel bankers based on the supplied cinematic private-banker reference
- Balanced skin-tone ranges, hair textures, ages, builds, and style presentations
- Art-deco trading city
- Deep emerald, acid lime, cream, and restrained gold
- Eight deterministic trait categories with weighted rarity
- Exactly 222 unique trait combinations

The key art is in `apps/web/public/collection/banker-bros-key-art.png`. The shipping tokens are deterministic SVGs so every collection asset can be reproduced and hashed before mint.

## Generate all assets

```bash
COLLECTION_SEED="keep-this-secret-until-provenance-is-committed" \
ASSET_BASE_URI="ipfs://REPLACE_ASSET_CID" \
node scripts/generate-collection.mjs
```

This writes:

- `generated/images/1.svg` through `222.svg`
- `generated/metadata/1.json` through `222.json`
- `generated/provenance.json`
- `generated/trait-report.json`
- `generated/contract.json`

The provenance commitment is SHA-256 over the ordered list of SVG SHA-256 hashes. Commit its `0x…` value onchain before any mint. Pin images, then replace metadata image URIs with the asset CID and pin metadata separately. Set the contract base URI to `ipfs://<metadata-cid>/`.

## Reveal

1. Generate and review the final ordered collection.
2. Commit `provenanceCommitment` before minting.
3. Upload/pin assets and metadata redundantly.
4. Set placeholder, base, and contract URIs.
5. Commit `keccak256(abi.encode(secret))` through the collection owner.
6. Reveal in a later block; token IDs rotate by the derived metadata offset.
7. Verify random token URIs and hashes, then freeze metadata.

The built-in commit/reveal is appropriate for a cosmetic testnet launch. For a high-value public mainnet mint, replace it with audited VRF and have the mint/reveal system reviewed independently.

## Rights and licensing

Before sale, publish explicit art and holder license terms. The repository MIT license does not automatically define commercial rights in collection artwork or brand marks.
