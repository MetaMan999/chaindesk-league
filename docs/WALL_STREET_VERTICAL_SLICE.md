# Wall Street District vertical slice

## Player fantasy

You arrive on Wall Street as a rookie with a cheap suit, a red briefcase, and a tiny brokerage called Ledger & Co. The district is the interface: walk to the coffee shop for rumors, meet a client in the bank, challenge a rival inside the Exchange, inspect the routing terminal at your office, and discover locked expansion routes in OTC Alley and the subway.

The slice is intentionally game-first. Finance and chain infrastructure appear as consequences of play instead of dashboard navigation.

## Included locations

| Location | Playable purpose |
| --- | --- |
| Wall Street overworld | Tile movement, collision, street NPCs, ticker, navigation |
| The Exchange | Opening Bell quest, simulated tapes, rival negotiation |
| First Bull Bank | Client mandate quest and BrokerVault placeholder |
| Ledger & Co. | Brokerage status, routing terminal, office upgrade board |
| Bull & Bean | Coffee item, rumors, fund-manager dialogue |
| OTC Alley | Grey-market atmosphere and explicit regulated-module gate |
| Broad Street Station | Fast-travel placeholder for later districts |

## Controls

| Input | Action |
| --- | --- |
| Arrow keys or WASD | Walk one tile |
| E, Enter, or Space | Interact with the facing object |
| Q | Open the quest log |
| I | Open the briefcase and office upgrades |
| Escape | Close dialogue or a side panel |

Touch controls appear below 790px.

## Vertical-slice progression

1. Visit Bull & Bean and collect the Double Espresso.
2. Report to the Opening Bell inside the Exchange to earn reputation and a Market Pass.
3. Meet Ms. Ledger in First Bull Bank and win her fictional $25K mandate.
4. Challenge Chadwick from Apex & Co. on the Exchange floor.
5. Spend earned demo commission on office upgrades at Ledger & Co.
6. Inspect the office routing terminal to view the game-to-chain adapter.

Negotiations replace creature combat. The player applies market knowledge and risk control through four moves:

- **Tight Quote:** strong pressure; consumes accumulated insight.
- **Source Liquidity:** reliable, variable client impact.
- **Read the Tape:** builds insight for a later quote.
- **Hedge Risk:** reduces incoming pressure.

## Persistence

The browser save key is `banker-bros-wall-street-v1`. The app autosaves after state changes and includes a manual Save Game button. A saved game stores location, player position, facing direction, reputation, commission, AUM, office level, briefcase contents, quests, visited locations, and a timestamp.

This save is a vertical-slice convenience, not a source of truth for valuable or competitive state. Production seasons should project authoritative onchain/indexed state into the client.

## Game-to-chain adapter

The current build records demo intents without submitting transactions. This keeps the RPG fully playable before deployments are configured. When `VITE_PROFILE_ADDRESS` and `VITE_GAME_ADDRESS` are configured, the Chain Desk becomes a live read-only projection of the connected wallet's existing banker records.

The live reader resolves every `BankerProfile` owned by the wallet and displays the selected profile's handle, level, score, tower floor, latest rank, office rating, credit balance, desk name, tier, commission, and lifetime volume. Wallets holding more than one banker get an in-game profile switcher. Reads fail closed: missing addresses, missing profiles, network errors, and unconfigured future modules never disable the local RPG.

| Game action | Planned boundary | Placeholder method |
| --- | --- | --- |
| Resolve the active banker | ERC-6551 Identity | `resolveBrokerAccount(tokenId)` |
| Complete identity/office milestones | BrokerRegistry | `registerBroker(tokenId)` |
| Win or inspect a client mandate | BrokerVault | `deposit(asset, amount)` |
| Inspect the office routing terminal | BrokerRouter | `routeOrder(order, brokerId)` |
| Attribute a won brokerage negotiation | BankerHook | `afterSwap(pool, brokerId)` |

### Frontend configuration

| Variable | Current behavior |
| --- | --- |
| `VITE_PROFILE_ADDRESS` | Enables owned-profile, identity, tower, and office reads |
| `VITE_GAME_ADDRESS` | Enables credit and desk reads |
| `VITE_STONKBROKER_TOKEN_ADDRESS` | Enables read-only display of the verified ERC-20 ecosystem token on chain 4663 |
| `VITE_BROKER_LICENSE_ADDRESS` | Enables the dedicated Broker License mint and automatic ID selection |
| `VITE_BROKER_IDENTITY_NFT_ADDRESS` | Configures the separate ERC-721 identity used by ERC-6551 registration |
| `VITE_ERC6551_REGISTRY_ADDRESS` | Marks ERC-6551 account resolution configured |
| `VITE_BROKER_REGISTRY_ADDRESS` | Marks future broker registration configured |
| `VITE_BROKER_VAULT_ADDRESS` | Marks future vault integration configured |
| `VITE_BROKER_ROUTER_ADDRESS` | Marks future routing integration configured |
| `VITE_BANKER_HOOK_ADDRESS` | Marks future post-swap attribution configured |

The last six addresses expose readiness only in this iteration. They do not grant approvals, custody, or write access.

The repository's current `BankerProfile`, `BrokerGame`, `BankerDesk`, `PaperAsset`, crew, deal-room, work-floor, and optional v4 hook contracts remain available. The adapter gives the RPG a stable seam for evolving those contracts toward the StonkBroker/ERC-6551 architecture without coupling map and dialogue code to one deployment.

## Market and compliance boundary

Default labels are fictional (`NOVA`, `QUANT`) or crypto-test (`WETH`, `USDG`, `TEST-USD`). No live real-stock order entry is exposed. The regulated tokenized-stock module is disabled and marked as gated in OTC Alley and the Chain Desk.

Turning that gate on is not a UI flag. It requires a jurisdiction and eligibility design, licensed execution and custody boundaries where applicable, verified contracts, disclosures, monitoring, and independent legal and security review.

## Originality and asset direction

The new title artwork was generated for this repository using the built-in image-generation workflow. The in-game map, tiles, UI chrome, sprites, dialogue, names, encounter rules, and code are original to Banker Bros. The visual goal is nostalgic readability, not reproduction of any particular game's intellectual property.

No Pokémon characters, monsters, maps, sprites, music, logos, interface assets, or proprietary content are included.

## Run and verify

```bash
npm ci
npm run dev
```

Open the local URL shown by Vite. To run the checked vertical-slice suite and production build:

```bash
npm run test:web
npm run build
forge test -vvv
```

## Recommended production path

1. Convert high-value local state into an indexed projection of contract events.
2. Bind the selected ERC-6551/StonkBroker identity to the player sprite and office.
3. Implement allowlisted crypto-test routing behind `BrokerRouter` and `BankerHook` on a public testnet.
4. Add signed quest content, deterministic encounter seeds, and server/chain anti-cheat boundaries.
5. Add more districts through the existing scene registry: Midtown Funds, Harbor Finance, London, Tokyo, and Crypto District.
6. Commission an original full tileset, directional animation sheet, sound effects, and score under clear commercial licenses.
7. Run accessibility, mobile-device, smart-contract, economic, and legal reviews before public production.
