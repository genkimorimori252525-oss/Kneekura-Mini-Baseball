# Native Club season transitions

**Approved source:** current foundation `44b9f5de7b9d87e649f12f1af78c202f2b5ab44d`, unchanged frozen document18 sections9/21/22/26; existing Core ClubSeasons/ClubLifecycle and accepted World Club journal. User all-confirmed-nonvisual authorization applies. No reseeding, Presentation connection or merge.

**Gap:** Core already implements CLOSE_SEASON / OPEN_SEASON, including retained obligations, current Manager and detached history. Production Native writers currently adopt economy/appointment commands but do not expose a durable season transition owner. A pure Core 300-season regression does not prove actual Native year rollover.

**Architecture:** Native accepts a Source ID from an independent accepted season-plan/closing-summary authority. Its record contains a version and an existing exact ClubCommand restricted to CLOSE_SEASON, OPEN_SEASON or CLOSE then OPEN. It reads the actual World head and complete accepted journal, invokes the existing Core command, and atomically appends its event, advances the shared head and archives immutable transition evidence. No parallel Club state, new money/season rules or defaults. Closing summaries and next plans remain accepted Source inputs; this owner does not pretend to produce missing competition/roster/fanbase evidence.

Replay reconstructs the exact before revision from the shared journal, rederives the transition and detached closing snapshot, matches the journal event and stored result, and validates the current World history. Original Source retries return original results after subsequent years or reopen without a live authority. Changed accepted Source, stale revision, backdated/invalid plan, nonseason operations, duplicate snapshot identity and corrupt content fail. A failed head update rolls back both event and application. Historical snapshots are exposed as history only.

**Verification:** Native actual World head + economics -> close/open -> retained commitments and current cash/debt -> next actual World season initialization; original snapshots stay detached from subsequent seasons. Multiple Native years/reopen/exact retry; atomic injected SQLite failure; malformed/changed Source/CAS/identity/provenance rejection. Existing Core lifecycle and World/economy consumers remain green. Actual competition closure generation and complete autonomous Career orchestration remain later integration work.

- [x] Native RED tests before implementation; actual next-season consumer reproduced `initial Club checkpoint differs`.
- [x] Adopt existing Core transition into the actual shared World head/journal atomically.
- [x] Verify replay, snapshots, actual World next-season consumer and failure cases; preserve initial checkpoint and validate complete existing history.
- [x] Focused tests/typecheck, one fresh read-only review (no findings) and whole-suite verification (527 files / 3,136 tests, 620.43 seconds).
- [x] Published PR233 stacked on PR232 at `cfef573fb57729856319eaea138295694b503713`; attachment attempted once (app limit), P0 run36834768541 succeeded at exact SHA.
- [ ] Continue full Career Source generation and orchestration; do not claim this slice closes the overall goal.
