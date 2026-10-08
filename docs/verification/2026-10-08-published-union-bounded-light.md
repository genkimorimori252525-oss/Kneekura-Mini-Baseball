# Reconstructed published union: bounded source-attributed evidence

Current qualification on unchanged `src` tree `b3b4e9aa53c142d26a1534a8ffdb0f5b9fdaf1a7` is **117 unique cases in 14 complete files plus the full root compiler**. Five separate test batches are attributed below; this is not a single whole-suite run. The first 80 cases remain on their original source cut.

Initially, on 2026-10-08 UTC, **80/80 fresh cases passed in six complete files** on reconstructed union commit `1b71e1058111e5af6380d4bcd421ebb50e9b2797`, full tree `07cb62f84b17e9302e85626d3454cbab7c0cd157`, `src` tree `b3b4e9aa53c142d26a1534a8ffdb0f5b9fdaf1a7`. This initial result covers the prepared v2 selection's **B01 and B03**. Historical results receive no credit, and the lost combined candidate is not restored.

| Batch | Complete files and fresh cases | Result | Peak aggregate RSS | Process wall |
| --- | --- | --- | ---: | ---: |
| B01, pure Core | `ReceivedUmpireDefenderReplan` 52; `ReceivedUmpireDefenderRenewalEligibility` 3; `ReceivedUmpireDefenderReplanAvailability` 1; `PracticeDevelopmentLearningEpisode` 3 | 59 passed, four files | 279,484 KiB | 1.812 s |
| B03, light owner wiring | `ActualFoulOfficialMirrorDiscovery` 12; `OwnedPhysicalReadReuse` 9 | 21 passed, two files | 320,896 KiB | 3.233 s |

Both supervisor terminals passed: original child exit 0, no skipped cases, no unhandled or suite errors, no remaining owned processes, and exact selected names/counts/statuses. Source, dependency, control and runtime censuses were identical before and after each stage and were checked again before this documentation-only change. All 2,503 original tracked files matched the immutable union. This note is added after qualification; its commit does not change the qualified `src` tree.

## Inputs and controls

An isolated exact-source clone used the existing dependency tree and the matching materialized catalog. All 15 catalog generator/data inputs matched the donor; the copied catalog SHA-256 was `4a7452ba4b6d600cfca498f79759f678f4c85884add1d7eee866638e222c0263`. The catalog generator was not run.

The existing LIGHT supervisor, runtime probe, reporter and Vitest configuration were privately copied. Only the six-file allowlist and private lock names changed. Stages ran sequentially after explicit lane release and separate memory-headroom checks, with 512 MiB oldspace, measured 608 MiB V8 heap limit, 768 MiB aggregate RSS cap, 180-second stage cap, one threads worker and run-local caches. B01 closed and reaped before B03 launched. Shared Native locks/controls and the original LIGHT controls were untouched.

B01 uses pure Core kernels and explicit synthetic inputs. B03 uses an in-memory metadata schema or a fresh tiny SQLite database beneath its run directory, with physical outputs mocked. Neither invokes a genuine physical fixture or opens a private input database.

There were **no failed runtime attempts or retries**. One prelaunch bookkeeping assertion initially rejected the admitted `node_modules` symlink, which appears untracked because the repository's directory-only ignore pattern does not match symlinks. Its accounting was corrected before launch; no source behavior or test result was changed.

## Exact receipt identities

- B01 supervisor terminal SHA-256: `c6435d4d8b85f28f72df5e087458f346ab4af515ee1a14a4a776d6fa258bf73c`
- B01 configuration SHA-256: `165a648aceb6e8989477ba395c9a911ce42b3fe95be9cd0bdaa834dcb8a17a35`
- B01 Vitest JSON SHA-256: `eba55e8c3f8c5fb96f33d0adbbcfc25bf94a655374cba17b6f1d4d4923e54932`
- B03 supervisor terminal SHA-256: `46f214518916473a88bff84fa192000c99a16c47e77b10a81f27ce90a88c44b4`
- B03 configuration SHA-256: `ae1f793142af0007177f2be15c523a5dc9bf5a602cbdcc829e139cc1a268d945`
- B03 Vitest JSON SHA-256: `df31107f8d6775282de1d14e69c953daeb7bb35fd4721b3fb77d8f91a0e65071`
- Result index SHA-256: `0aafaf4259f46cc88ec17c2837fefc1daa96d657601b0dd8efca24b37e49b5a2`

The original raw receipts, source/control bindings, static fixture review, process telemetry and runtime probes are retained in the private execution evidence bundle. This repository note records their identities; it does not embed the raw bundle or constitute a standalone reproduction package.

## Full root TypeScript compiler

The unchanged root compiler subsequently **passed with exit 0 and no diagnostics** on commit `9e91549fc3c093de5303f5b5d8ff75bcea1feabe`, full tree `f98c7c43316fe42eaf9db641d14710e4ee96472a`, and the same `src` tree `b3b4e9aa53c142d26a1534a8ffdb0f5b9fdaf1a7`. This is separate static compiler evidence; the 80 LIGHT cases retain their original attribution above and were not rerun.

Pinned Node v26.10.0 and TypeScript 5.6.3 ran `tsc --project tsconfig.json --noEmit --pretty false --incremental false`. The root config includes all `src`. The compiler completed in **20.245 seconds**, with peak aggregate RSS **1,553,204 KiB**. Its caps were 300 seconds, 1,408 MiB oldspace, a measured 1,504 MiB V8 heap limit, and 2,048 MiB aggregate RSS. Serial admission required 8.25 GiB available memory, accounting for a 6 GiB reserve, the compiler cap and 256 MiB supervisor allowance; minimum observed available memory was 7.262 GiB.

The private compiler supervisor opened the original shared locks read-only and held exclusive nonblocking locks, forbade child processes, and retained runtime probes, resource telemetry and input snapshots. Its sole compiler process exited and was reaped, with no remaining owned process. Source, dependency, control and runtime snapshots were conserved and independently checked afterward. No tests, database opens, catalog generation, source-behavior edits or held-stream runtime checks occurred.

- Compiler supervisor terminal SHA-256: `d7166e29c0019eacf82d67b7340d49b724349d6aa196c076d6e33d331b18614a`
- Compiler configuration SHA-256: `cc3e71f8c8eeb7217aa5702b1ee11644c3ed69958a63db112dd82970c87e8c79`

## Explicit remaining limits

The additional B02/B04/B05 results below reduce the remaining v2 selection to **237 planned cases in 32 files**. B22's one-shot physical prerequisite is separately excluded and unqualified with zero credit. Its unchanged source is included only in the static root compiler check. No later PR350–361 layer is added or qualified here.

Every held stream remains unchanged, including runner semantic capture and batting inherited-Proxy repair. These results do not establish genuine physical/official foul completion, Native received-call decision/replan/motor wiring, whole-current, full Positive, real SAFE/review, same-PA resume, root completion, general autonomy or Career completion. Publication, merge and deployment are outside this local verification task.

## Additional existing batches, 2026-10-08 03:20 UTC

B04, B02 and B05 ran on documentation-only successor `38f4919675127d5f2f6bd34ade5cb74b816d24fa`, full tree `bf4066ae6b52092f5a26419f2aa0f88e4ef45827`, with the same source tree. All **37 cases in eight complete files passed**, without skips, failures, cancellation or surviving owned processes. Source/dependency/control/runtime censuses stayed unchanged; report hashes and exact selected names/counts were independently checked. The five batch inventories are disjoint, yielding the current 117-case total without rerunning or reattributing the earlier 80.

| Batch | Actual coverage | Cases / files | Supervisor terminal SHA-256 |
| --- | --- | ---: | --- |
| B04 | Runtime input, real SQLite fence/registration/end transaction behavior and pure scheduled-event projection | 26 / 5 | `ad0dfba85d43cc5382d7546c2fb1e0ab6900e7c14023509f9ac5bad0d9563e4e` |
| B02 | Real two-choice Manager history, durable selection/application/retry/reopen, historical corruption and writer-local INSERT rollback | 4 / 2 | `892da6e3a3cf15f022bbb79ef2b291df102b4fce1c38aa38f19830ec74d1ff65` |
| B05 | Actual practice-origin timing adoption, separately measured NORMAL/QUICK practices, historical revision ceilings and writer-local rollback/reopen | 7 / 1 | `5fe541b7d8bb1183c138f435d43e638adbf194c26d6a02215e2122c8ef7e6789` |

Each private stage used only new SQLite files under its own run directory, unchanged established test fixtures and explicit accepted fixture inputs. No retained private database or batted-world root fixture was used. B04's physical owner transaction fixtures retain their explicit mocks; B02/B05 use their real Manager/practice owners and do not imply a completed baseball game or Career. B05's declared synthetic assessment/calibration values are test inputs, not automatic production policies.

The unchanged 512 MiB oldspace / measured 608 MiB heap / 768 MiB aggregate RSS / 180-second caps were retained, with one worker, private locks/caches, 7 GiB available-memory launch admission and a 6 GiB runtime reserve. B04/B02 peaked at 339,384/279,372 KiB; B05 peaked at 333,644 KiB and completed its process in 137.70 seconds. All three first attempts passed. Existing controls, shared Native locks, workflow files and source behavior were not changed. Raw reports and private control records remain outside the repository.
