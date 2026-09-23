# Non-live Official Closure/Application Plan

**Goal:** carry strikeout and walk through OfficialPlayClosure, durable MatchState confirmation and next plate-appearance activation using existing rule/state-transition code.

**Base:** PR45 head `b0ff6ec0cd7408942ce455f748b5064a97ced140`.

## Tasks

- [x] RED tests for strikeout/walk official application and durable fence.
- [x] Reuse existing strikeout/walk MatchState transitions.
- [x] Require closure final ruling to match the canonical non-live rule result.
- [x] Reuse OfficialStateApplicationReceipt for durable confirmation.
- [x] Gate next timeline on matching receipt and closure tick.
- [x] Public adjudication exports.
- [x] RED→GREEN regression: OfficialPlayClosure cannot predate the terminal non-live timeline event.
- [ ] Exact-final-head native verification + evidence artifact.
- [ ] Publish stacked PR and keep unmerged.

Deferred: HBP/other non-live terminals, RuleProfile-specific official windows, actual appeal/review orchestration, official scoring classification, persistence/exactly-once service.
