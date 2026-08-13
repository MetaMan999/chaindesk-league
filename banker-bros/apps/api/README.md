# Optional API boundary

The protocol and dashboard do not require a trusted backend. Add this service only for expensive read aggregation, moderation, signed cosmetic metadata, notification preferences, or anti-abuse review queues.

Rules:

- never custody keys or relay arbitrary calldata
- never decide balances, claims, ownership, or route validity
- authenticate mutations with SIWE, short sessions, domain/chain binding, and CSRF protection
- derive all gameplay facts from finalized indexed events
- expose indexer height/staleness in every leaderboard response
- rate-limit by account, IP bucket, and route
- keep RWA eligibility out of the default API; any future gate is a separate reviewed service

See [openapi.yaml](openapi.yaml) for the intentionally small read surface.
