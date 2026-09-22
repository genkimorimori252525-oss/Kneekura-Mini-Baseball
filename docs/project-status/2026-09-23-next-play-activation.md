# 2026-09-23 — Next-play durable activation fence

Base: PR44 `16c990d82d143e3a9fe02a08e76d7fba547f6dfd`.

The prior implementation already blocked next-play activation before OfficialPlayClosure. Review found that it still derived the post-play MatchState and opened the next timeline in one pure call, so it did not represent the design contract's separate durable-state-application fence.

This slice separates those responsibilities.

A host that has persisted the official MatchState must call `confirmDurableClosedLiveBallStateApplication`. Core re-derives the expected official state and returns a receipt only when the persisted state matches exactly. `activateNextLiveBallPlay` then requires that receipt and revalidates its closure identity, prior play ID and exact applied MatchState before creating the next timeline.

TDD:
- RED run `35795170442` failed because the confirmation API/application field did not exist.
- GREEN checkpoint `d89d502` run `35795514387`: **309 files / 2,463 tests passed**.
- next-play tests: 4 activation + 4 durable application + 2 integrity.

The host still owns actual durable database writes and persistent exactly-once semantics. The receipt is a consistency/provenance boundary, not proof that storage infrastructure behaved honestly.

Final exact-head verification is recorded on the stacked PR after evidence-workflow publication.
