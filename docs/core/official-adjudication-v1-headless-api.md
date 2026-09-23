# Official adjudication and closure v1 — headless API

This slice implements the separate post-physical adjudication ledger required by the world-first adjudication contract. It does not reopen or mutate the completed physical timeline.

Implementation: `src/core/adjudication/PlayAdjudicationLedger.ts`.

## Authority boundary

The runtime chain is:

`Physical Truth / PlayEnd`
→ `CorrectRuleSnapshot`
→ optional `OnFieldCall`
→ optional `ReviewDecision`
→ `FinalOfficialRuling`
→ `OfficialPlayClosure`
→ durable MatchState application.

These objects remain distinct even when they agree.

## Append-only ledger

`createPlayAdjudicationLedger` starts a ledger keyed by `playId` and `ruleProfileId`. A live-ball play supplies its immutable `PlayEndFact`; non-live plate appearances may use `playEnd: null`.

Every mutation requires the caller's expected ledger revision. Event IDs, call IDs, review IDs, snapshot IDs and window IDs are unique. Event ticks and correct-rule evidence revisions are monotonic. No event may be appended after `OfficialPlayClosed`.

The ledger is reconstructed by replay on every public operation. Stored closure basis is re-derived and must match; persisted closure data is not blindly trusted.

## Correct rule snapshots

`recordCorrectRuleSnapshot` records the latest rule interpretation as an evidence-bound gameplay ruling:

- official outs after the play;
- official base occupants;
- scored runner IDs.

A newer snapshot must use a strictly newer evidence revision. Existing on-field calls/reviews become stale if a newer correct-rule snapshot appears; closure then requires a fresh official ruling or falls back only when no stale call controls the result.

## Official-state windows

`openOfficialStateWindow` / `closeOfficialStateWindow` represent appeal, review and challenge opportunities.

`closeOfficialPlay` is blocked while any supported official-state-changing window remains open.

`openRuleProfileOfficialStateWindow` checks availability against the ledger's `RuleProfile`. `advanceRuleProfileOfficialWindows` applies configured expiration, next-play, and inning-ending defense-left-field boundaries. A next-play fence rejects any window that remains open. `evaluateRuleProfileOfficialWindowTiming` reports timely, expired, or unresolved same-tick attempts; it respects an earlier explicit closure before a later configured deadline.

The NPB 2026 profile enables appeals and its existing appeal closure conditions. Review and challenge are unavailable until a specific profile supplies their policy. A custom profile may configure review/challenge expiration in integer simulation ticks; this is not a claim about an NPB time limit. Hosts must explicitly open legitimate opportunities and close resolved or declined windows. No appeal or review is inferred merely because it “would have happened”.

## Calls and review

An `OnFieldCall` is allowed to differ from the correct rule snapshot without changing physical or correct-rule history.

A `ReviewDecision` references an existing call and the latest correct-rule evidence:

- `confirmed` / `stands`: preserve the call ruling;
- `overturned`: requires a replacement ruling.

The original call remains in append-only history.

## Official closure

`closeOfficialPlay` derives a final ruling, checks that all official-state windows are closed, and appends only the closure event/basis. Replay reconstructs `OfficialPlayClosure` from the authoritative history.

The closure includes an `OfficialMatchStateDelta`; it does not rewrite the physical timeline.

## Durable live-ball MatchState

`deriveClosedLiveBallMatchState(match, timeline, ledger)` is permitted only after official closure and only for a live-ball play with physical PlayEnd.

It verifies play ID and RuleProfile identity, clones all caller inputs before reading them, and delegates to the existing `applyResolvedLiveBallPlateAppearanceToMatchState` path. The source MatchState and physical timeline are not mutated.

Non-live walk and strikeout closure application is provided separately by `NonLiveOfficialApplication`.

## Integrity

All public ledger and closed-play application inputs are descriptor-cloned before property access. Active getters/accessors, functions, symbols, cycles, malformed arrays, non-plain objects and non-finite values are rejected without executing caller code.

This is consistency/integrity validation, not a cryptographic persistence layer.

## Host responsibilities

The host still owns:

- producing the correct RuleEngine snapshot from canonical physical/rule facts;
- deciding when a supported appeal/review/challenge opportunity actually arises, then using the profile-aware window API;
- actual appeal-attempt provenance;
- umpire/review policy and human-manager challenge intent;
- atomic persistence / global exactly-once semantics;
- official-scoring classification after closure;
- activating the next play only after closure + durable MatchState application.

Presentation/UI remain read-only and untouched.
