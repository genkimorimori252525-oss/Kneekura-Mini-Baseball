# WBC completed-game outcome recovery — 2026-10-09

This extends the WBC retry-only boundary in `2026-10-09-completed-outcome-callers.md` for newly admitted runtime competitions. It does not retroactively enroll historical owner rows.

## Existing ownership and recovery

`initializeWorldBoundWbcKnockout` and `initializeWorldBoundWbcQualifier` bind the required player-outcome delivery commitment into each new knockout/pod owner's frozen `request_json`. The commitment retains the original WBC edition ID; qualifiers retain their distinct qualifier edition ID in the existing owner key. Initialization retries reuse the saved commitment. Historical requests stay unmarked and byte-identical.

The existing `world_wbc_finals_knockout` and `world_wbc_qualifier_pods` rows receive one nullable `outcome_delivery_json` column. No scheduler, second journal or new result authority is introduced. The receipt contains the exact authenticated original game finals, including fixtures; accepted plan and competition outcome bytes remain unchanged.

`listPendingCompletions` enumerates marked rows without a delivery receipt, including editions whose competitive outcome is already finalized. `resumePendingWorldBoundWbcFinals` and `resumePendingWorldBoundWbcQualifier` consume that enumeration and invoke the existing completion sequence. The qualifier resume checks the saved WBC-to-qualifier identity against the original qualification owner before proceeding. Incomplete tournaments remain pending and produce no completed result.

History, ranking, hosting and berth effects remain under their existing idempotent owners. Their completion precedes outcome delivery. The knockout/pod owner reauthenticates exact originals before and after delivery and commits the receipt using its original request, plan and outcome in the compare-and-set. A thrown delivery or missing required outcome authority leaves the row discoverable after reopen. Honest partial/unsupported per-play coverage is a delivered result and may complete the commitment.

Legacy rows retain explicit idempotent completion-method retry only. Read-only borrowed evidence facades neither migrate schemas nor expose delivery methods. Path-owned stores migrate their existing tables; they preserve original request, plan and outcome JSON.

## Bounded author evidence

The focused selection passed 17 tests across `WbcOutcomeCompletionRecovery.test.ts`, `CompletedNationalOutcomeCallers.test.ts` and `SqliteWbcGlobalQualifierPodStore.test.ts` in 1.31 seconds on Node 26, with Vitest cache disabled and an external cache directory.

After narrowing pending enumeration to marked requests, the six recovery cases passed again in 896 ms.

The six recovery cases use real Native competition rows and reopen/CAS behavior, with explicitly substituted Match finals and player-outcome sources. They cover both finals and qualifiers: failure after competition effects, pending enumeration after reopen, absent authority, resumed partial delivery, exact-original changes during/after delivery, retained edition identity and historical byte preservation. These tests do not qualify the separate National Native scenario or a scheduler. No full compiler or long Native gate was run by this author; central assembled verification remains separate.

## Review correction: completion write boundary

Independent review found that an `AFTER UPDATE` trigger could replace the delivery receipt or mutate the owner row after the pre-write check. Both owners now authenticate the exact persisted receipt and unchanged request, plan and competitive outcome after the update, then re-read the original finals in a new competition proof phase before commit. A mismatch rolls back the receipt and trigger effects, retaining pending discovery.

The two added Native-owner regressions reproduced the defect before the correction. Each owner exercises receipt replacement and owner-plan mutation, checks exact rollback, reopens the store and resumes successfully after removing the trigger. The final eight-case recovery file passed in 1.11 seconds. No compiler or long Native gate was added.
