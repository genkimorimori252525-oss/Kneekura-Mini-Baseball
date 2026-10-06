# Actual-live substituted-reader fixture correction (held)

Base: `9bf4550d12a8d3c53164a89a8cea5c709f9ec9a1` (current main observed 2026-10-06 UTC).
This change is limited to test setup and this evidence note. It has not run a compiler or tests and makes no physical/Native or cumulative PASS claim.

## Observed failures, preserved at original source

The immutable c68 gate source is `c68a3dc47196b1aae2cd678470ebaad207992d1a`, source root `/workspace/shared/baseball-four-slice-current-integration-corrected`.
Original evidence stays under `/workspace/shared/baseball-cumulative-current-integration-continuation-preparation-v1/attempt1/`:

- `src-0527-terminal.json`: ActualLiveDomesticGameSettlement, 35 failed / 35 total
- `src-0531-terminal.json`: ActualLiveInningHandoff, 34 failed and 17 passed / 51 total
- `src-0529-terminal.json`: ActualLiveImmutableReceiptMetadata, 1 failed / 1 total

All three terminal receipts report unchanged source/dependencies/controls, verified launcher/worker runtime, safe completion, reaping and no surviving owned process. Their complete terminal/results/log/runtime/RSS/started/unhandled files are SHA-256 pinned in the separate held review package. They remain failed evidence; no prior result is promoted to a current pass. All three test files are byte-identical between c68 and this current-main base.

## Root cause and precise API seam

Both legal/World suites replaced the entire SqliteBattedWorldFieldExecutionStore module with a mock exposing only battedWorldFieldExecutionEvidenceFromSqlite.scope. ActualLivePlayClosureEvidenceFromSqlite.ts:22 calls withBattedWorldPhysicalReadTraversal, so Vitest rejects the missing export before the domain assertions can execute.

The real traversal at SqliteBattedWorldFieldExecutionStore.ts:141 delegates to withBattedWorldFieldReadTraversal, installs a private execution frame and encoding, restores the previous frame in finally, and promotes completed nodes only into the exact eligible parent field frame. The real field traversal at SqliteBattedWorldFieldStore.ts:46 owns a SQLite savepoint and query_only state, checks total_changes plus main/temp schema versions, restores state on errors, and merges only authenticated completed nodes. Partial importOriginal mocks retain these functions and all related field frame/authentication exports; no traversal is replaced with a no-op.

A second setup omission follows from that same transactional API: ActualPostPlayReviewClosureFromSqlite.ts:46 uses the adjudication owner's readWithClosureInputs on a real SQLite transaction. The legal/World fixtures previously supplied only read. Their substitute now supplies the paired reader shape using the same synthetic adjudication, end and base field, plus the exact terminal execution Source ID. End/base-field Source IDs are added to the fixture objects for the real closure's pair-cut checks at ActualLivePlayClosureEvidenceFromSqlite.ts:28. Both shapes remain synthetic physical evidence. Actual players/field/execution readers remain substituted; these suites exercise the legal handoff, real transaction guards and downstream World owners, not real physical authentication or dynamics.

## Existing immutable-receipt correction reused exactly

The metadata fixture file is copied byte-for-byte from test-only commit `6032fb6f479e73e0cf56c0845437e0a4145afdde` (parallel PR331). It supplies physicalPitchSourceId and the original-pitch index required by the shared rule-consumption writer before the hidden-ownership trigger runs. The ownership/claim error matcher, complete rollback and valid retry assertions are preserved. No foul-production change is copied.

## Held verification

A separate fixed-source package prepares the bounded current compiler plus all 35+51+1=87 cases, selected by exact observed assertion names and file counts. It pins this candidate, dependencies, Node26, historical failures and controls. Launch requires independent coordinator source review and explicit release of all three runtime locks. The package checks actual launcher and distinct worker identities/heaps, PID start times, subreaper ownership, zombie reaping, aggregate RSS including the supervisor, memory reserves, finite stage/overall time budgets, complete source/dependency/control audits and no skipped/todo/unhandled cases.

No runtime/compiler/database/lock acquisition was performed while preparing this candidate. No GitHub publication, merge, deployment, visual work or original c68 mutation is part of this change.
