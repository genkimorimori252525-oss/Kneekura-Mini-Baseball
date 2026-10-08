# Terminal scoring static review — 2026-10-08

Source-only review of the terminal deterministic scoring contract, its continuation proposal, the current terminal/application/scoring readers and writers, and the authored scoring tests. The source baseline is acknowledgement commit `2a0b33242d8a094f595e516f4ce83d23d4c06bd0`, src tree `801331b24872f3d9916da17d9a831bd3dba6d2e9`. Acknowledgement qualification and runtime admission remain with the coordinator.

## Findings addressed

- The assigned final ruling is the original ledger's `OnFieldCallRecorded.call.callId`, authenticated as `proposal.callSource.sourceId`. `callIntent` has no `callId`. The contract and S01 now preserve this distinction from the event ID and frozen oracle `proposal.scoring.basisRulingId`.
- S01 now installs its real INSERT witness before opening the scorer, so a writer that prepares statements during opening is observable.
- S02 now specifies separate raw-only competitor, unrelated write, no-op write, and actual mutate-then-restore faults. S03 compares the whole raw/schema census against exactly its committed peer Match revision change.
- M01 now puts the matching duplicate Source ID before an overwriting foreign value, exposing a lossy `JSON.parse` implementation. M04 additionally rejects an event suffix from the terminal Source-ID domain when the original application ID differs.

The reviewed contract requires mandatory original-evidence authentication on the INSERT connection, after transaction acquisition and after triggers; mode-specific pending hashing and complete receipt/mirror checks; strict existing storage admission; raw/transitive ownership discovery; and explicit rejection by legacy scoring and downstream consumers. It grants no workload, reset, history-replay, finalization, or next-play authority. No further source/contract blocker was identified in this static pass.

## Authored, never run

- `ActualFoulTerminalScoring.acceptance.ts`: S01 genuine-prerequisite gate, canonical INSERT, assigned ruling, immutable census, retry/reopen, legacy scorer rejection, and both next-play guards.
- `ActualFoulTerminalScoringRollback.acceptance.ts`: S02 AFTER INSERT fault matrix, S03 peer commit before acquisition, and S04 transaction replacement retirement.
- `ActualFoulTerminalScoringMetadata.test.ts`: 13 M01–M05 synthetic cases for duplicate/escaped/array metadata, versioned scoring and event identities, scope, transitive aliases, reference pairing, unrelated-play/domain exclusion, and malformed archives with cached identity. These describe rejection-only metadata behavior, never genuine provenance or a second origin.
- `ActualFoulTerminalScoringFixture.test-support.ts` and focused configuration: private-copy preparation and explicit schema delta. The required retained acknowledgement helper was not present at review time. Its absence, or any import/setup failure, cannot count as the intended S01 RED.

## Coverage still missing

Runnable Native cases remain to be authored for missing/damaged prerequisite owners and participant/policy dependencies; stage downgrade; full request/result/hash corruption; surviving aliases after owner or selected scoring-row loss; strict storage refusal and side-effect checks; downstream workload/history/actor mode rejection; and query-only, rollback, or restoration failure handling. Generic legacy parity and both null/bound-policy pending hash variants also require separately admitted verification. Synthetic metadata tests do not fill these gaps.

No compiler, project imports, test runner, SQLite open, physical producer, runtime, or production-source edit was performed by this review. No RED, GREEN, passing-test, prerequisite-qualified, or completed scoring behavior is claimed.
