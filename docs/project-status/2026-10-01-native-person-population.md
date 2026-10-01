# Native Person population — 2026-10-01

## Approved scope

Latest foundation `44b9f5de7b9d87e649f12f1af78c202f2b5ab44d`, frozen documents32/50/51/53 and their existing Core/Native owners. User-authorized confirmed nonvisual implementation. No design/Presentation connection, obsolete plan or merge.

## Implementation

- Existing `SqlitePlayerPersonLinkStore.acceptBatch` and `SqlitePersonGenesisStore.materializeBatch` persist ordered unique Source cohorts atomically using the existing schema. Single-record APIs use the same implementation and preserve existing retry semantics.
- All independently accepted new link Sources and pre-existing links are detached before writes. Every saved link is compared with its original fact before commit. Actual current global roster evidence is fully validated and indexed once per Career per transaction; later calls reload it. Pinned Career policy parsing is likewise scoped to one transaction, while the existing Core hidden-prior generator still owns policy validation, salted Person seeds and generation.
- The final guard rechecks all accepted links/priors and original roster/Career evidence before commit. A later write cannot make an earlier record or a cached validation stale. Any late invalid Source, uniqueness conflict, SQLite failure or evidence change rolls back the entire corresponding batch.
- Existing inert-data limits remain unchanged. Each accepted Source is independently cloned, and full hidden-prior cohorts are not serialized as one ordinary DTO. Hidden priors remain in World storage and are absent from the public roster.

## Verification

Separate missing-batch API RED and transaction-evidence RED were captured. One fresh reviewer identified an Important valid Source rewrite immediately after INSERT; parent and reviewer independently reproduced it. New facts are now checked against the original authority snapshot, and existing facts are captured before all writes. Regression tests cover both. Reviewer confirmed no remaining Critical/Important/Minor findings and independently passed 3 files /12 tests in 0.994s.

Final parent affected tests passed 10 files /26 tests in 27.82s. Typecheck and catalog compilation passed. The actual capacity gate creates all 234 Club heads, 11,700 global Players, unique accepted Person links and every hidden Person prior; it then accepts another actual intake, advances the global roster through a Manager decision, reopens without live Person authority and reproduces all original priors. The full capacity test passed in 26.567s. Counts of 50 Players/10 active per Club and the numerical prior policies are explicit synthetic verification inputs, not production quotas or calibration defaults.

Whole `npm run verify` passed 530 files /3,147 tests in 626.62s. Publication and exact-SHA P0 remain pending.

## Remaining overall goal

This slice establishes full accepted-population storage and generation from pinned policies. It does not fabricate regional intake facts, physical/body/skill/staff/facility/calibration content, actual effort measurements, injury/rehab or autonomous Career/Match orchestration. Those remaining confirmed nonvisual connections stay in the active overall goal.
