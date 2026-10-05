# Post-play review journal and pinned closure qualification

The accepted post-play review/challenge owner is implemented as an additive Native session and event journal over the immutable original adjudication seed. It opens windows from the authenticated physical PlayEnd under explicit policy, stamps accepted actions on its bounded scheduler cursor, and reuses the existing Core window/review ledger. Original call, correct-rule snapshot and accepted intent provenance remain distinct.

Incomplete official policy, opening policy or entitlement produces zero persisted session/event/head rows. Human adoption checks the actual current control and Club appointment; historical replay uses immutable admitted facts and their hashes. Assigned-official requests have their own entitlement and null controlled attribution. The currently unsupported Manager route remains explicit pending with no journal advancement.

Official closure now accepts an optional exact session revision/head Source/head hash. It cannot omit an enrolled owner or consume a pending/stale revision. The existing transaction-scoped physical read pair remains owned by the real reader and is never accepted as caller input. Original v1 closure bytes remain unchanged when no review session exists.

## Source and evidence

The final tested stack is `40c39fee3ef0c4bfd385c1095c3d0578e85099c5`, based on runner/venue integration `6971ecb0923caa261e271d32ec9081afb927eba2`. Its full `src` tree is `f74da93306ce473c4cf1c3c56f82dfdf1942acb0`. The publication copy is based on sensory documentation head `a155d1f4`, whose source tree is unchanged from `6971ecb`; all its ancestor documents are retained. The review code and selected tests are copied exactly from the tested stack.

- Pure API contract: 30 intended missing-export failures preceded 30/30 GREEN.
- Assigned-official contract: eight intended rejections and one existing regression pass preceded 39/39 combined pure GREEN. Its initial RED controller receipt remains failed because Vitest truncated expected messages; a separate exact assertion/location evaluation preserved and explained that receipt. Initial union-narrowing compiler failures were fixed before the later full compiler passes.
- Native journal: 15 intended API failures after genuine focused control/Club/WAL setup preceded 15/15 GREEN and a full compiler plus 202-case regression pass at `5abc35d49c5ab7aa861931a2a2d37a41991f746f`.
- Closure pin: 17 cases produced 14 missing-selector failures, one unsupported-pin failure and two legacy/invalid-input passes before implementation. Those exact contracts passed in the current-source 256-case qualification at `93c1651317f1cb7b3d33f52f09dbf8b7ec058bff`.
- Final stacked qualification at `40c39fee`: full compiler passed in 30.742 seconds, then all 256 cases across 18 files passed in 20.830 seconds, with zero failures or skipped cases. This includes the unchanged paired-closure and physical-traversal regressions. Peak sampled process-group RSS was 1,399,860 KiB for the compiler and 400,616 KiB for tests. Source/control hashes stayed unchanged; both stages exited zero and all owned processes were reaped.

Final terminal SHA-256: `a82ae40b6d07f0c46775509893fa53b1d18aa001c2918ed25c15705064979827`.

## Remaining boundaries

The focused Native tests mock physical-domain readers. Their genuine SQLite transactions, current control/Club authority, rollback, historical replay and complete close/reopen prove the bounded journal/selector behavior; they do not prove a new unmocked physical-to-review-to-official application. That separate gate must use a fresh copy of the retained pre-adjudication physical-end artifact, with its own explicit accepted policy and Sources, leaving the original artifact and any existing immutable seed unchanged.

Registered `npb-2026` supplies appeal availability but no production review/challenge calibration. An explicit fixture supplement is not a product default. Deadline equality and unresolved review evidence remain pending. The current overturn path uses the authenticated correct-rule snapshot only after an explicit accepted decision; it does not implement general reviewer perception or choose a decision automatically. A real review-domain Manager belief/selection producer, broader play coverage, scoring/workload completion and whole-game event coverage are outside this qualification.
