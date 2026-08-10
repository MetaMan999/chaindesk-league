# Reference product and UX analysis

Observed from the live [stonkbrokers.io](https://stonkbrokers.io/) site on August 8, 2026. This is a product-pattern summary, not a code or visual clone.

## Core loop observed

1. **Acquire the identity asset.** The user obtains a fixed-supply broker NFT through an NFT AMM rather than a conventional mint.
2. **Discover embedded utility.** Each broker is described as having a token-bound wallet with seeded or later-distributed assets.
3. **Activate into a tier.** Paying a tiered protocol-token fee makes the broker eligible for weighted reward distributions. A transfer clears eligibility.
4. **Generate shared flow.** Trading, launcher activity, fees, and related modules contribute to protocol reward pots.
5. **Community-trigger the event.** When the visible meter fills, any wallet can trigger the next onchain distribution.
6. **Receive and manage rewards.** Eligible broker wallets receive or claim their weighted allocation.
7. **Expand through adjacent desks.** Trading, distributions, loans, referrals, launcher, liquidity locks, exchange, and options are presented as connected modules.

The strongest retention mechanism is not a single trade. It is the repeated cycle of identity ownership, activation, visible shared progress, event triggering, reward delivery, and tier progression.

## UX patterns worth preserving

- A terminal/desk metaphor that turns protocol modules into understandable destinations.
- A persistent ticker and live activity tape that make the system feel active before wallet connection.
- Numbered “get, trade, claim, activate, trigger” onboarding rather than an undifferentiated dashboard.
- Fee splits and inventory/status figures shown immediately beside the transaction action.
- A sharp separation between global discovery pages and focused transaction tabs.
- Status tags such as live, new, soon, clock in, and overtime.
- A mandatory experimental-risk acknowledgement before transactional pages.
- Onchain transaction links and history rows that let users verify activity.
- Visible tier weights and transfer-reset behavior, creating an understandable progression system.

## Patterns intentionally excluded from this MVP

- Real or tokenized stocks, real stock-price oracles, corporate-action representations, or dividend-like rewards.
- Collateralized loans, covered options, bonding-curve launches, gambling/multiplier mechanics, and cash-out paths.
- Yield language, expected-return claims, stablecoin settlement, and revenue-sharing rights.
- Mainnet-by-default deployment.
- Arbitrary execution from NFT-controlled accounts.

## Original ChainDesk adaptation

ChainDesk reframes the broker identity as access to a fictional league. Clients use daily faucet credits to take paper positions in invented companies. Choosing an active banker on each order creates a fixed credit commission. The banker share rises by tier, while volume and commission update dynamic NFT metadata and score. Transferring the profile deactivates the desk until its new owner restakes.

This produces the desired broker/banker fantasy while keeping the entire economy legibly inside a simulation.

