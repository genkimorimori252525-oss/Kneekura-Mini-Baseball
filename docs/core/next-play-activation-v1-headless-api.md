# Next-play activation fence v1 — headless API

This slice enforces the final transition between an officially closed live-ball play and activation of the next canonical play.

The required sequence is:

`OfficialPlayClosure`
→ official MatchState derivation
→ host durable persistence
→ Core persistence confirmation receipt
→ next play activation.

## Durable application receipt

`confirmDurableClosedLiveBallStateApplication(input)` is called after the host has durably stored the official post-play MatchState.

It re-derives the official MatchState from:

- the previous CanonicalMatchState;
- the completed physical timeline;
- the closed PlayAdjudicationLedger.

The caller-supplied persisted MatchState must exactly match that derivation. The resulting `OfficialStateApplicationReceipt` binds:

- application ID;
- OfficialPlayClosure ID;
- previous play ID;
- host durable revision;
- exact applied CanonicalMatchState.

This is a consistency/authority fence. Core does not perform database I/O or prove storage durability cryptographically; the host is responsible for truthful durable revision/application identity and atomic persistence.

## Next play activation

`activateNextLiveBallPlay(input)` requires:

- the play is officially closed;
- next start tick is at/after OfficialPlayClosure;
- a non-null durable application receipt;
- receipt closure ID matches the current OfficialPlayClosure;
- receipt previous play ID matches the prior CanonicalMatchState;
- receipt applied MatchState exactly equals a fresh derivation from closure/timeline.

Only then is a new CanonicalPlateAppearanceTimeline created from the already-applied MatchState.

The activation result carries the application ID and durable revision for provenance.

## Integrity

All activation and confirmation inputs are descriptor-cloned before property access. Active getters/accessors, functions, symbols, cycles, malformed arrays, non-plain objects and non-finite numbers are rejected without caller code execution.

Repeated pure calls with the same inputs return the same result. The Node 26 SQLite host transaction adapter is documented in `sqlite-official-state-store-v1.md`.

## Excluded

This slice does not implement:

- database writes or transaction management inside Core;
- HBP durable application;
- official scoring classification;
- Presentation/UI/rendering.
