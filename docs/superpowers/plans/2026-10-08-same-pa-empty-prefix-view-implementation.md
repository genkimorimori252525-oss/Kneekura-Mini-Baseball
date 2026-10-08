# Same-PA Empty-Prefix View Implementation Plan

> For agentic workers: execute the reviewed finite TDD tasks below; source implementation and small isolated tests are authorized. Genuine fixture work requires its separate reviewed packet.

Goal: Accept one canonical empty prefix, ten explicit cumulative TOTALs and one immutable all-participant projected execution view without admitting physical work.

Architecture: Three additive SQLite owners share one private transaction/proof implementation. Each read-only proof authenticates the common reservation and prefix once and validates ten TOTAL rows against that context. Mandatory workload and causal-work guards independently discover surviving provisional claims.

Tech stack: TypeScript, existing Node Native SQLite and Vitest.

Spec: Parent-reviewed private empty-prefix contract `7f27d66a1dc07f59a7b94b341f558391c7f62f0d60458900758159be7c3ad8a2`; governing original plan `2026-10-05-owned-batting-intent-and-same-pa-foul-resume.md`.

## Constraints and review focus

- Preserve reservation/v1 bytes, blocked slot, actual global heads and all protected stance/runner files. No physical dispatch, release or nonempty-prefix admission.
- All ten effort values are accepted Sources; zero is constrained by authenticated empty coverage, never absence. Projection uses original reserved states once.
- Exact owner references and canonical uniqueness survive moved indexes and typed raw identity claims; disjoint causal PAs are not joined through Player alone.
- Three-table namespace is pristine only when all absent; first successful prefix acceptance bootstraps all three within one owned transaction. Reads never install or repair.
- Fresh writes reauthenticate before/after effects and after commit. Proof contexts do not cross those boundaries. Forced commit reports uncertainty and retires without repair.
- Small owner tests mock only actor authentication and use real Native schemas, workload histories and transactions. Genuine qualification is separate and never inferred from them.

## Task 1: Immutable empty-prefix/TOTAL/view contract and owners

Files: `SamePlateAppearanceWorkPrefix.ts`, `SamePlateAppearanceCumulativeTotal.ts`, `SamePlateAppearanceExecutionView.ts`, `SamePlateAppearanceExecutionStorage.ts`, `SamePlateAppearanceExecutionFromSqlite.ts`, `SqliteSamePlateAppearanceExecutionStore.ts` and three matching focused test suites.

API: `openSqliteSamePlateAppearanceExecutionStore(path, authority?)` exposes `acceptPrefix`, `acceptTotal`, `acceptView`, `readPrefix`, `readTotal`, `readView`, and `close`. Authority returns accepted Source or null by ID through `readAcceptedPrefix`, `readAcceptedTotal`, `readAcceptedView`. Missing unsupplied accepted Sources are typed pending; referenced missing/corrupt owners reject.

- [x] Write EV01–EV05 failing cases covering ten zero TOTALs, actual fatigue/revisions, missing versus foreign references, nonempty coverage, alias uniqueness, exact retry and normal reopen. Freeze a scaffold RED checkpoint under the bounded supervisor.
- [x] Implement strict inert Source types, independently owned records, canonical empty timeline/coverage and calculation-only MATCH projection.
- [x] Implement private read-only proof assembly, exact table/bootstrap accounting and owned transaction lifecycle. Preserve existing enrollment result bytes while obtaining its actual actor in the same authentication.
- [x] Verify GREEN and commit the source checkpoint.

## Task 2: Surviving provisional claims

Files: `SamePlateAppearanceExecutionStorage.ts`, new `SamePlateAppearanceProvisionalClaimGuard.ts`, existing `SamePlateAppearanceReservationGuard.ts`; guard cases in `SamePlateAppearanceWorkPrefix.test.ts`.

API: `assertNoReservedPaPlayerClaim(db, scope, ownEnrollmentSourceId?)` and `assertNoReservedPaWorkClaim(db, scope, ownEnrollmentSourceId?)` run before existing absent-reservation early returns. The existing own-enrollment parameter is restricted to dependency authentication; fresh writers gain no exemption.

- [x] Observe RED for orphan prefix/TOTAL/view claims with absent original tables, moved indexes/actor/baseline authorities, typed duplicate/NULL identity and disjoint scopes (EV08–EV09).
- [x] Implement fixed-type lineage discovery and exact namespace census. Provisional records remain distinct from completed charges.
- [x] Verify GREEN, both mandatory workload entry routes and inherited original-pitch route; commit.

## Task 3: Proof lifetime, compatibility and handoff

- [x] Add finite EV06/EV10 WAL/real-INSERT/commit/retirement faults and common-authentication count tests; preserve reached-write evidence and distinguish rollback from forced-commit uncertainty.
- [x] Run the three focused suites and directly affected reservation, workload, charge/fence and v1 compatibility suites through fresh finite supervisors. Preserve source-specific RED/GREEN receipts.
- [x] Run full compiler, using the reviewed 1664/1760/2304 MiB profile if required, with RSS plus 4096 MiB admission reserve and continuous reserve.
- [x] Obtain independent source review, fix observed findings through finite RED/GREEN cases, then freeze source.
- [ ] Prepare the exact genuine packet from the closed qualified reservation manifest. Do not open/copy the donor until that packet is released.

The immediate following reviewed scope is first-pitch dispatch plus all ten participant fatigue consumers. This dependency does not itself admit execution or complete same-PA continuation.
