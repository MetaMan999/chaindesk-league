# Banker Bros 3D City

The 3D city is the default way a new banker enters Wall Street. It is an original low-poly, pixel-inspired career world built with React and Three.js. It does not copy any existing game map, character, sprite, logo, music, interface, or proprietary content.

## Player controls

| Input | Action |
| --- | --- |
| `WASD` or arrow keys | Walk |
| `Shift` | Run |
| Mouse drag | Look around |
| `Q` / `E` | Rotate the camera |
| `V` | Switch first-person / third-person |
| `F` or `Enter` | Open the nearby workplace menu |

Touch direction, run, camera, and work buttons appear on smaller screens. The `Pixel District` menu button switches back to the complete top-down RPG without losing the main game save.

## The playable city

The initial district contains the Exchange, First Bull Bank, Ledger & Co. brokerage, Bull & Bean coffee shop, Broad Street subway entrance, a simulated OTC area, rival towers, streets, traffic, roaming NPCs, signs, and collision boundaries. Glowing markers indicate programmable locations.

The career layer currently includes eight programs:

| Program | Workplace | Result |
| --- | --- | --- |
| Clock In | Exchange | Starts the day and earns early career XP |
| Service Order Flow | Exchange | Simulates routed flow and records a BankerHook intent |
| Client Meeting | Bank | Builds AUM and reputation |
| Work the Desk | Brokerage | Earns commission, AUM, reputation, and a BrokerVault intent |
| Research a Market | Brokerage | Trades energy for XP and reputation |
| Buy Espresso | Coffee shop | Restores energy |
| Ride the Subway | Subway | Fast-travel placeholder with career XP |
| Simulate an OTC Block | OTC area | High-energy simulated negotiation with a BrokerRouter intent |

All market labels and rewards are fictional or test-only. The OTC action is explicitly simulated. Regulated real-stock and tokenized-stock execution remains behind the optional qualified-partner boundary described in `ROBINHOOD_STOCK_TOKEN_INTEGRATION.md`.

## Programmable function model

City jobs live in `apps/web/src/lib/cityPrograms.ts` as data rather than hard-coded menus. A program declares:

- stable program ID and workplace;
- display name and player-facing description;
- energy cost or recovery;
- career XP, reputation, commission, and AUM rewards;
- cooldown duration;
- optional chain intent such as `BrokerVault`, `BrokerRouter`, or `BankerHook`.

`runCityProgram` is deterministic when supplied a program ID, career state, and timestamp. It rejects unavailable locations, exhausted energy, and active cooldowns before returning the next state and reward record. The React game applies valid rewards to the RPG save and queues any chain intent for the Broker Passport console. Career state is saved separately in browser local storage.

This makes the city easy to extend: add a program definition, place or reuse a location marker, and connect the optional onchain adapter. Future programs can include staffing a trading floor, escorting a client, delivering research, pitching a fund, joining a broker meeting, competing for a mandate, upgrading an office, or completing a timed market event.

## Onchain boundary

The intended progression remains:

```text
StonkBroker identity reference
→ dedicated Broker License NFT
→ ERC-6551 brokerage account
→ BrokerRegistry
→ isolated BrokerVault
→ test-asset deposit
→ BrokerRouter simulated/testnet order
→ BankerHook attribution
→ reputation, commission, and AUM
→ visible city/RPG progression
```

The StonkBroker contract at `0xe934e36A439C94017B64a3FecE66AF12099aBF50` is treated as a read-only ERC-20 reference, not as an ERC-721 identity. The dedicated Broker License ERC-721 is the token bound to ERC-6551. Public deployment should remain on a local chain or testnet until contracts, economic rules, abuse controls, and any regulated integrations have been audited and approved.

## Verification

The city program rules have unit coverage for valid rewards, cooldowns, energy, and location gating. The web application is also compiled with strict TypeScript and production-built through Vite. Visual QA covers the title-to-city launch, default third-person view, first-person toggle, WebGL rendering, and browser console health.
