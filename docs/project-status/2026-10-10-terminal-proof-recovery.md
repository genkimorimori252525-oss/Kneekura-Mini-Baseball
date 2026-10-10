# Terminal proof phase recovery checkpoint (2026-10-10)

This separate branch preserves a reviewed three-file change while local filesystem operations are stalled. The qualified integration branch and PR374 remain at `d4cd8067346d8ad1aa5eed9d1ccaa695d39ce791`. This preservation commit is separate from the unresolved local Git commit.

## Change

Adjudication and closure now own the existing immutable physical-proof scope across each pure read phase. Prewrite derivation, postwrite authentication, public reads and official validation use separate snapshots; INSERT/UPDATE, triggers, accepted callbacks and independent retries stay outside earlier proofs. Completed closure retries authenticate again after the accepted-Source callback, rejecting a receipt whose original evidence changed during that callback. Domain rules, Source shapes, CAS and genuine scenario assertions are unchanged.

## Evidence and remaining validation

- The author ran the three affected finite test files on Node26.10.0 with a 512MiB heap and a 35-second external cap: **26 cases passed in 5.19seconds**.
- Independent whole-batch review was **CLEAR**.
- These tests use real SQLite transaction/archive/retry boundaries with explicit seams for expensive physical evidence. They do not establish genuine physical acceptance or elapsed-time speedup.
- **Full compiler and final central verification have not run for this change.** They remain required after the filesystem recovers. The earlier qualified results retain their separate source attribution.
- The running National and IFR continuations retain their fixed older source and independent results; this branch supplies no new whole-scenario completion credit.

The exact final file bytes were recovered from retained review diffs and the known GitHub baseline, then matched to the frozen SHA256 values in memory without additional filesystem reads:

| File under src/host/world | SHA256 |
| --- | --- |
| SqliteActualLiveAdjudicationStore.ts | acb380baf4f20139c284e50d09ba8f505acf8e795fd053126ebc2d043d42495b |
| SqliteActualLivePlayClosureStore.ts | 40f3ce08d5ffd966648a95a3166aecf9347103eab0f9599808bdd755d886e250 |
| ActualAdjudicationClosureReadPair.test.ts | da61607c5062a4e3210724b2d94b5fff8a2f3d9ab2cf8704c5bd88d1f5503b6a |

Only source, tests and this explanation are preserved here. Private databases, WALs, logs and controls are excluded. No merge, deployment, home-PC CI or new game-model decision is part of this checkpoint.
