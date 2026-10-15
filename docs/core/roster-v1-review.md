# Roster v1 — Inline Review Evidence

Scope: baseline `7af4dfd7fca518fbd2fac423a7d7c9077e402704` to PR #26. No independent reviewer agent was available; this is an inline implementation/spec review, not an independent audit.

## Verification

First full repository GREEN: `8992f01329e7e4b54cbd4cd2831195ff3ad35512`, P0 Core #1492 / run `35659463026` / job `106530989029`: **244 files / 1165 tests**, strict TypeScript passed.

Final source/test GREEN: **`72ededa600621e3f49265b2ad59a3c98c82f3dd2`**, P0 Core **#1496 / run `35660292695` / job `106533677150`**: **245 files / 1181 tests passed**, strict TypeScript passed. Native new roster coverage: 20 state + 19 command/query + 16 boundary = **55 tests**. Local standalone compile and **13/13 Node checks** also passed; local checks do not replace the full repository suite.

## Important findings and corrections

1. Registration upsert validated shape and capacity but not club ownership. A local command could create registration at unrelated B or rebind an existing edition to B. Two behavioral Node assertions failed before the fix. Existing registration club identity is now preserved; a new edition uses the assigned club or, if unassigned, the rights holder. Rebinding belongs to the external transaction owner. This is not a complete registration-law evaluator.
2. Sparse JS arrays skipped map callbacks and reached nested code as undefined, producing TypeError instead of structured rejection. Two Node regressions reproduced this before the fix. The shared array validator now rejects missing own-index entries before nested parsing.
3. Publication parity caught one transcription mismatch in the availability parser and corrected it before the reviewed CI dispatch. All ten source/test files now match the locally verified files after the connector's terminal-newline normalization.
4. Reviewed run #1494 / `35659942965` failed with test-only TS2352 at `RosterBoundary.test.ts:80`. The intentional malformed-input cast was corrected to pass through `unknown`. No compiler setting or test assertion was disabled. Run #1496 subsequently passed the complete suite.

`RosterBoundary.test.ts` also covers already-agreed external destinations, no loan termination through null assignment, per-club capacity, malformed commands/queries, immutable-rights mutation and revision overflow.

## Preserved boundaries and scope review

Rights, assignment, registration, availability and profile ownership remain separate. Capacity uses final batch state; old snapshots and returned events are immutable. Rejections return the original state. Retry protection is expected-revision rejection, not a durable successful-command receipt. The host owns transactional persistence, real registration rules and medical evidence.

The PR adds 14 files, with no existing files modified/deleted. Existing Presentation, simulation, RuleEngine and CI workflow subtree hashes match the baseline. New code has no renderer/UI/Match Core connection. No outstanding Critical/Important finding remains in this inline review of this slice.

## Residual limits

No global Person identity registry, national-team/multi-club registration exception system, contract/transfer/loan engine, database/save migration, whole season or development simulation is implemented. Broader legal participation must not be inferred from `ROSTER_ONLY`. Whole-world throughput has not been benchmarked. Profile state remains pinned, not refreshed from live external data.