# Roster v1 — Inline Review Evidence

Scope: baseline `7af4dfd7fca518fbd2fac423a7d7c9077e402704` to dedicated roster branch. No independent reviewer agent was available; this is an inline implementation/spec review, not an independent audit.

The first full repository verification passed at `8992f01329e7e4b54cbd4cd2831195ff3ad35512`: P0 Core #1492 / run `35659463026` / job `106530989029`, **244 files / 1165 tests**, strict TypeScript successful.

## Important findings and corrections

1. Registration upsert validated shape and capacity but did not preserve registration club ownership. A local roster command could create a registration at unrelated B or rebind an existing edition entry to B. Two behavioral Node regression assertions failed before the fix. The command now requires existing entry club continuity; a new edition may be registered only at the currently assigned club (or rights holder for an unassigned player). Cross-club rebinding belongs to the transaction owner. This is not a complete legal registration rule evaluator.
2. Sparse JS arrays skipped map validation and reached nested code as undefined, producing TypeError instead of structured rejection. Two Node regressions reproduced the failure before the fix. The shared array validator now rejects missing own-index entries before parsing nested data.

After the fixes, local standalone strict TypeScript compilation and **13/13 Node checks** passed. `RosterBoundary.test.ts` adds repository-native Vitest coverage for both defects plus external-destination registration, no loan termination via null assignment, per-club capacity, malformed commands/queries, rights mutation, and revision overflow. Full CI at the corrected head remains required; the earlier 244/1165 evidence is not substituted for that run.

## Preserved boundaries

Rights, assignment, registration, availability and profile ownership remain separate. Full-batch capacity uses final state. Old snapshots and returned events are immutable; rejected commands return the original state. Retry protection is expected-revision rejection, not a durable successful-command receipt. The host owns transactional persistence, real registration rules and medical evidence. New code has no renderer/UI/Match Core integration.

## Residual limits (not failures of this slice)

No global Person identity registry, national-team/multi-club registration exception system, transfer/loan transaction engine, database/save migration, full season or development simulation is implemented. Broader legal participation must not be inferred from `ROSTER_ONLY`. Whole-world throughput has not been benchmarked. All source and runtime rules continue to be pinned to explicit input state, not live external data.