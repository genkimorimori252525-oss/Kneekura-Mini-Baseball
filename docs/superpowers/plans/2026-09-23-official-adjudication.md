# Official Adjudication and Closure Implementation Plan

**Goal:** implement the approved append-only post-PlayEnd adjudication ledger, OfficialPlayClosure boundary, and durable live-ball MatchState application without rewriting physical history.

**Base:** PR43 head `384945b725e81b6751033edb712b77929cd5204b`.

## Constraints

- Physical timeline is immutable after PlayEnd.
- Correct rule result, on-field call, review and final official ruling remain separate.
- Official-state windows block closure while open.
- Event/evidence/revision chronology is monotonic.
- A newer correct-rule snapshot makes older call/review bases stale.
- MatchState changes only after OfficialPlayClosure.
- No UI/rendering or official-scoring classifier in this slice.

## Tasks

- [x] RED tests for physical-vs-official closure separation and state lifecycle.
- [x] Append-only revisioned adjudication ledger.
- [x] Correct-rule snapshots and official-state windows.
- [x] On-field call and review provenance.
- [x] OfficialPlayClosure with final ruling and official delta.
- [x] Live-ball durable MatchState application through the existing MatchState adapter.
- [x] Reject stale revisions, duplicate IDs, appends after closure and malformed stored ledgers.
- [x] Replay derives closure basis and rejects forged stored closure evidence.
- [x] Inert input validation at ledger/application boundaries.
- [x] Public adjudication module seam.
- [ ] Exact-final-head native verification + evidence artifact inspection.
- [ ] Publish stacked PR and keep unmerged.

Deferred: RuleProfile-specific appeal/review availability policy, actual appeal attempt orchestrator, non-live closure→MatchState adapter, official scoring classification, persistent exactly-once transaction, next-play activation orchestration.
