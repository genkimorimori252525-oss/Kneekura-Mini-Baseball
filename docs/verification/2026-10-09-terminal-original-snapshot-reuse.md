# Reuse the completed terminal original within one immutable operation

One terminal completion read reconstructed the same historical proposal three times: first for its original acknowledgement ancestry, then for scoring, then for workload settlement. The first two original reads had completed before the next consumer began. The outer completion and post-foul actor were not repeated successful reads.

`readFoulTerminalOriginalArchive` now retains only a successfully authenticated historical proposal for an acknowledged or completed original archive, using the existing opaque outer Native snapshot identity. Every access still checks the real owner schema, Source identity and aliases, exact detached row bytes, archive stage, original ancestry scope, official mirrors, handoff claims and policy. Queue/applied-only stages and missing results are not retained. Current admission, scoring, workload and completion effects remain independent.

Publication follows successful original-reader child cleanup and parent validation. The existing snapshot guards reject mutation, rollback/rebegin and poisoned descendants; independent operations reauthenticate. This is an owner-specific map with no caller-supplied proof, new lifecycle policy or general cache API.

## Completed retained operation

Both versions successfully returned the full result of `foulTerminalPostPlayCompletionEvidenceFromSqlite(db).readWithEffects('national-foul:terminal')` on the same preserved, read-only SQLite input. Each run had a 60-second diagnostic stop and 75-second outer cap; neither reached the stop.

| Complete-operation evidence | Baseline | Candidate |
| --- | ---: | ---: |
| Fully completed original official projections | 3 | 1 |
| SQL prepares | 86,523 | 32,391 |
| Result size | 104,822 bytes | 104,822 bytes |
| Observed elapsed time | 37.582 s | 13.556 s |

The baseline ran while the original National scenario was active; the candidate ran after that scenario ended and after maintenance. Those elapsed times therefore do not establish a controlled wall-time speedup. Identical complete output and removal of two duplicate completed projections are the primary evidence. No capped/unequal partial work is compared.

Both result hashes are `06d301da2d9e2db36e2acc066555443f1d76a7d04d68b1b5279255944e0f540f`. The final diagnostic SQLite SHA-256 is `bf9808bf49485f745efcb68cc1af940275108c1018f67f9ad5bdcf56878aa247`, identical to the preserved seed used for its consistent backup. Both runs opened that same copy with Native `readOnly: true`. A separate post-baseline digest and per-run table/schema census were not captured; they are not claimed. Original databases, profiles and diagnostic files remain private and unchanged.

Baseline: commit `0dd728ccc2d22885d2db4e68f53ebcf1bd64d5b7`, source `fc6ed604f2588ca922b5fd6d781ce3109f3180c9`. Measured production: commit `483b50c4de3a3735da1438af212fdf3843339734`, source `5973fb3b3938f976e78c89d1e50f8e5f93e8b26d`. The production bytes were frozen throughout the candidate run and committed immediately afterward. Subsequent changes add tests/documentation and restore an explicit callback return type; the type annotation changes no emitted runtime behavior. No repeat measurement is claimed.

The pass-through observer counts completed `foulOfficialEvidenceFromSqlite(...).at(session, revision)` calls matching the genuine terminal Source. It neither substitutes results nor counts every internal function call. SQL prepares and complete output hashes are recorded independently.

## Bounded verification

Twenty-three public light controls pass: the existing original-ancestry, activation pairing and ancestry-stack selections, plus three Native controls for missing-owner freshness, caught-failure poisoning and namespace changes. The new cases use real SQLite and pass-through identity observation; they do not fabricate successful physical evidence or introduce a default artifact-dependent framework. Positive reuse is separately demonstrated by the completed genuine operation above.

Catalog generation and all 18 protected blobs pass. Affected TypeScript compilation identified the callback annotation fixed here and an inherited `SamePlateAppearanceLiveAppeal.ts:116` acquisition-member error in the branch base; final integrated compilation/testing remains part of the assembled batch. No full scenario, fixture reconstruction, new long gate or home-PC CI was started.
