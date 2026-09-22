# Next-play durable activation fence plan

**Base:** PR44 head `16c990d82d143e3a9fe02a08e76d7fba547f6dfd`.

**Goal:** prevent the next live-ball play from starting until OfficialPlayClosure has been translated into the exact official MatchState and the host has confirmed that state was durably applied.

## Tasks

- [x] Existing RED→GREEN next-play closure fence.
- [x] Hostile-input boundary validation.
- [x] RED test requiring a durable application receipt.
- [x] Add `confirmDurableClosedLiveBallStateApplication`.
- [x] Bind receipt to closure ID, prior play ID, durable revision and exact applied MatchState.
- [x] Require and revalidate receipt during next-play activation.
- [x] Preserve source MatchState/timeline/ledger immutability and deterministic replay.
- [ ] Exact-final-head native verification and artifact inspection.
- [ ] Publish stacked PR and leave unmerged.

Deferred: persistence implementation/exactly-once transaction, non-live official-state application, RuleProfile official windows, official scoring and broader career orchestration.
