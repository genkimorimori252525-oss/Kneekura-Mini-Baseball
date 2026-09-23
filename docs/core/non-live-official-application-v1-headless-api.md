# Non-live official application v1 — headless API

This slice carries terminal non-live plate appearances through the same authority sequence used by live-ball plays:

`terminal CanonicalPlateAppearanceTimeline`
→ `OfficialPlayClosure`
→ derived official MatchState
→ host durable persistence confirmation
→ next plate-appearance activation.

Implemented contexts in v1:
- strikeout;
- walk.

## Derivation

`deriveClosedNonLiveMatchState(input)` requires:

- a closed adjudication ledger with `playEnd: null`;
- matching play IDs across MatchState, terminal timeline and ledger;
- matching RuleProfile identity;
- a context matching the terminal timeline kind;
- OfficialPlayClosure at or after the terminal timeline event;
- a final official ruling equal to the existing canonical strikeout/walk rule path.

The actual state transition delegates to the existing:
- `applyStrikeoutPlateAppearanceToMatchState`;
- `applyWalkPlateAppearanceToMatchState`.

No duplicate advancement/scoring implementation is introduced.

## Durable application

`confirmDurableClosedNonLiveStateApplication(input)` re-derives the official MatchState and confirms the host-reported persisted state matches exactly.

It returns the same `OfficialStateApplicationReceipt` shape used by live-ball next-play activation:
- application ID;
- closure ID;
- previous play ID;
- host durable revision;
- exact applied MatchState.

Core does not perform database I/O or cryptographically prove persistence.

## Next plate appearance

`activateNextNonLivePlateAppearance(input)` requires:
- valid non-live official closure;
- next start tick at/after OfficialPlayClosure;
- a durable application receipt matching closure/prior play ID;
- receipt MatchState exactly equal to a fresh official derivation.

Only then does Core create the next active CanonicalPlateAppearanceTimeline.

## Causality

A non-live adjudication ledger has `playEnd: null`, so the adapter explicitly requires:
`closure.closedAtTick >= timeline.lastEventTick`.

This prevents a forged/early OfficialPlayClosure from predating the pitch event that actually created the walk/strikeout terminal timeline.

## Integrity / exclusions

All public inputs are inert-cloned before property access. This v1 does not cover HBP or other non-live terminal types, RuleProfile-specific appeal/review availability, persistence transactions, official scoring classification, or UI/rendering.
