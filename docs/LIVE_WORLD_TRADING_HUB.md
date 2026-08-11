# Living Wall Street trading hub

## Product direction

Banker Bros is a persistent social RPG where every player owns a transferable Broker License, operates a visible brokerage, meets clients and rival desks in a shared Wall Street district, services test or qualified order flow, and climbs a public tower ladder through verifiable work.

The game should feel inhabited before it feels financial. Players see brokers walking the Exchange floor, client mandates appearing, desks reporting fills, rival firms issuing challenges, offices changing, and district events moving through the tape. Wallet and protocol machinery lives inside the Broker Passport rather than replacing the world.

## Shipped foundation

- One-confirmation entry: `BrokerLicense.enterWallStreet` mints the ERC-721 identity and calls `BrokerRegistry.registerBrokerFor` to create the ERC-6551 account and isolated vault atomically.
- Existing licenses are detected automatically through `licenseOf(wallet)` and loaded into the Broker Passport.
- The Trading Hub drawer shows a resident broker ladder, the player's current floor, gap to the next desk, broker availability, and a rotating district pulse.
- Resident brokers now appear on the Exchange map and open the hub through in-world interaction.
- Player ladder score responds to reputation, commission, AUM, and office progression.
- Confirmed testnet orders still update the RPG, while regulated assets remain behind the qualified execution boundary.

The current district pulse is explicitly a deterministic local simulation. It is the user-experience contract for the online service, not fake multiplayer.

## Production architecture

```text
Wallet + Broker License
        |
        +--> Onchain identity and economic truth
        |      BrokerRegistry / BrokerVault / BrokerRouter / BankerHook
        |      events: registered, deposited, fill attributed, reputation changed
        |
        +--> Event indexer
        |      normalized broker profiles, desks, fills, seasons, ladder snapshots
        |
        +--> Realtime world service
        |      wallet-authenticated presence, scene, emotes, challenges, parties
        |      no custody, swapping, asset approvals, or settlement authority
        |
        +--> Game client
               map actors, district pulse, broker cards, offices, ladder, quests
```

Onchain events are the durable source for ownership and credited performance. The realtime service is allowed to make the district feel alive, but it cannot award permanent commission, AUM, or reputation. Those values change only from indexed contract results or explicitly simulated single-player quests.

## Ladder model

The local vertical slice estimates position from four inputs:

```text
ladder points = reputation × 450
              + commission × 5
              + sqrt(AUM) × 30
              + office level × 1,250
```

This keeps one whale deposit from completely dominating the ladder. Production standings should replace the local formula with season snapshots derived from `BrokerRegistry` and should include service quality, distinct clients, retained liquidity, compliant uptime, and bounded outcome measures. Self-routing, wash activity, sybil clients, and rapid regulated-asset turnover must not become viable progression strategies.

## Social interactions

The first online interaction set should be deliberately small:

1. See which district and building a broker occupies.
2. Inspect their public Broker License, desk, floor, recent credited activity, and office.
3. Send a meet request, emote, or finance-themed negotiation challenge.
4. Form a temporary floor party or persistent brokerage crew.
5. Share a fictional/test mandate and compare quotes.
6. Follow a desk and receive public district events.

Private chat requires block, mute, report, rate limits, safety review, and moderation tooling before launch. Never put sensitive identity, eligibility, client, or transaction data in presence payloads or public chat.

## Delivery phases

### Phase 1 — Testnet district

- Deploy Broker License and brokerage contracts on Robinhood Chain Testnet.
- Index registrations, vault deposits, routed test orders, and attribution events.
- Replace the local resident feed with indexed testnet activity.
- Add wallet-authenticated presence and map positions.
- Run short seasons with resettable, valueless standings.

### Phase 2 — Social brokerage MMO

- Public office visits and broker profile cards.
- Challenges, crews, client-request board, and district events.
- Seasonal tower floors, badges, office cosmetics, and replayable quest lines.
- Moderation console, abuse controls, telemetry, and incident response.

### Phase 3 — Qualified market integrations

- Named eligibility and execution partner.
- Canonical asset, halt, multiplier, and corporate-action synchronization.
- Jurisdiction-specific disclosures and consent outside the fictional game loop.
- Qualified fills may create bounded service reputation, but never simulated test-vault custody.

No production multiplayer or regulated integration should launch before contract audits, load tests, privacy review, moderation readiness, multisig controls, monitoring, and an incident runbook.
