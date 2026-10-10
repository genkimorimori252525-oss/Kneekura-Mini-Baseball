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

## Recovered central qualification

At 12:56 UTC the executor responded again, but the former scratch checkout, shared Git directory and private checkpoints were absent. A fresh clone recovered this exact three-file checkpoint and verified all hashes above. Node 26.10.0, the original lockfile dependencies and the generated catalog were restored. No missing private database or interrupted commit was inferred to have completed.

The first full compiler run failed at the closure validator's connection type: the existing official guard exposes `Pick<DatabaseSync, 'prepare'>`, while the local proof helper required the full Native type. The correction retains that public type and checks `instanceof DatabaseSync` before using transaction methods. The real official writer supplies its Native connection; unexpected connections reject. Independent review of this correction was clear.

Final tested code is `3f45955f486df0f89a3bcbba4388fb9cabbb20c0`, src tree `728b6e36cee03cc0667904b6ada2ea7661d5b427`:

- Full TypeScript, including the original long entries: **PASS, 32.506 seconds**, peak RSS 2,172,136 KiB.
- The three affected finite files: **26/26 PASS, 7.351 seconds**, peak RSS 533,028 KiB. The formal report SHA256 is `2417e7fc8d94ecabcea4ce069b760ef5d2493973473e0bcf1d2ea76ecacbdd9c`.
- Source, dependency, runtime and control snapshots stayed identical. No child processes survived. The known generated Vitest results cache is excluded only at its specific output path; test caching is disabled.

The initial compiler failure remains separate from the successful final run. These finite transaction/retry checks still do not establish the long genuine scenarios or an elapsed-time speedup.
