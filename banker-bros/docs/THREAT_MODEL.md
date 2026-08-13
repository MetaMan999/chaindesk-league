# Threat Model

## Assets at risk

User swap input/output, broker vault balances, accrued commissions, identity attribution, seasonal integrity, admin authority, and availability of routes/pools.

## Adversaries and mitigations

| Threat | Path | Mitigation | Residual risk |
|---|---|---|---|
| Fake broker/TBA | Register arbitrary account | Validate NFT owner plus TBA `token()` and `owner()` | Malicious upstream NFT/TBA implementation |
| Stale owner | NFT sold after registration | Read `ownerOf` at authorization time | Upstream NFT pause/bug |
| Malicious adapter | Steal input or fake output | Admin allowlist; declared output must equal the router's measured token balance delta; min output | Adapter can consume gas/DoS |
| Malicious ERC-20 | Reentrancy/fees/rebase | Allowlist; safe transfer; reentrancy guard | Nonstandard balance semantics require dedicated adapter |
| Fee insolvency | Record more than held | Router transfers before record; invariant checks liabilities | Compromised recorder role can over-account |
| Wash trading | Buy XP cheaply | square-root/capped XP, indexer detection, diverse score | Sybil coalitions remain possible |
| Hook-induced pool DoS | Attribution or metadata fails | best-effort `try/catch`; pause and malformed data return cleanly | PoolManager itself remains trusted |
| Upgrade takeover | Compromised upgrader | delay, multisig, monitoring | malicious upgrade after delay if governance compromised |
| Guardian griefing | Repeated pause | separate guardian; admin-only unpause | temporary availability loss |
| Front-running | Route copied or price moves | caller receives output; deadline and min output | public mempool MEV within user bounds |
| Cross-chain replay | Signed future routes | current router has no signatures | must add chain ID/nonces if signatures added |
| Indexer deception | UI displays false rank | replayable events; compare multiple RPCs | temporary UI inconsistency |
| Restricted-asset misuse | RWA adapter enabled casually | separate deployment/config gate, legal review, new audit | governance/process failure |
| NFT/account control surprise | User transfers NFT without realizing it controls assets | prominent UI/marketplace warnings; live `ownerOf` control; no hidden admin | third-party marketplace UX may omit account assets |
| Parent NFT ownership cycle | NFT sent into its own account | receiver rejects its own parent NFT | indirect multi-account cycles require further analysis |
| Malicious account target | Owner calls hostile contract | CALL only; no delegatecall; owner confirmation/simulation required | owner can still approve or transfer assets intentionally |
| Deal escrow insolvency | fee/rebase token underfunds a leg | allowlist and exact balance-delta checks on both legs | exotic callbacks require audit/fork tests |
| Cross-registry ID collision | StonkBroker #1 and Banker Bro #1 share downstream stack | separate registry/router/hook deployments | future aggregation needs collection-scoped IDs |

## Known audit targets

1. ERC-1967 upgrade authorization and storage layout.
2. ERC-6551 edge cases, NFT transfers, burned/frozen NFTs, and account implementation upgrades.
3. Adapter output verification and nonstandard token behavior.
4. v4 delta sign interpretation, permission bits, callback selectors, and malformed hook data policy.
5. XP normalization, overflow/saturation behavior, and manipulation economics.
6. Role revocation ordering and incident claim availability.
