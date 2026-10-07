# Shared official-state writer parity

The legacy official application SQL now has one connection-bound implementation in `SqliteOfficialStateWriter`. The existing `SqliteOfficialStateStore` keeps its public API, schema v2 constructor and transaction ownership. The shared writer never opens/closes a connection, changes schema or begins/commits/rolls back a transaction.

This is a bounded prerequisite for the terminal-bunt path. It does not apply a terminal queue, produce pending-post-play state, acknowledge a physical end, settle workload, reset the world, migrate to v3 or grant a next-play right. The existing terminal owner remains immutable `QUEUED`, `officialApplied: false`, `result: null`.

## Preserved behavior

- Live-ball and non-live activation keep the same request hash, row serialization, optimistic revision check, unique closure check, evidence phases and stored results.
- Game finalization retains its distinct `game_final` hash envelope and durable fixture validation.
- Activation retains early historical retry before derivation or finalized-state rejection. Finalization retains derivation before transaction entry and retry.
- The existing pure derivation functions move byte-for-byte, with the original module re-exporting all existing public types and functions.
- Initialization and fixture registration remain store-owned.
- A prepared write captures the inert request in an opaque closure and permits one invocation in an active transaction. Its result is still uncommitted. An active transaction alone is not proof of the future terminal owner's transaction identity.

The one public write entry point returns `{ readResult(): T }`. The legacy store commits before `readResult()` to preserve its existing in-transaction retry decoding/error boundary. A borrowed caller can decode inside its own transaction and roll back if decoding fails. There is no alternate write entry point or second consumed flag.

## Observed REDs

The first bounded stage ran the new contract against unchanged production at `031d942585c540f2764c5125bb248ca7c59d833b`. Three legacy byte-baseline cases passed; all eighteen shared-writer cases failed at the expected missing-writer assertion. No fixture/setup error or skipped case substituted for RED.

Independent review then found a real parity regression in the initial extraction: stored retry JSON was decoded before the legacy COMMIT. A separate real-SQL test used a malformed stored final result and a retry-guard witness. It failed because the extracted store rolled back the witness that the legacy ordering commits. That targeted stage had one intended failure and 21 excluded cases with zero credit. The unified deferred-result outcome corrects that boundary, and the same regression is included in GREEN.

Both RED stages returned supervisor exit 0 with expected Vitest child exit 1, unchanged inputs and no remaining owned process.

## Final bounded verification

All final stages tested source tree `40ed1e590c509f863f44cb19c3715c7b28df9afe`, staged tree `9c48f280e244d53a6a62a63e23da9d2f74efab19`, and input-source digest `f0a89a0fc0937aa77cbc4f453bdbbed5adad2b2a986b16a43b1e7c3404fae828`. Subsequent changes only update this report and plan checkboxes.

- Focused compiler: PASS using `tsconfig.official-writer-parity.json`, including the selected tests and transitive imports. Peak aggregate RSS: 459,528 KiB.
- Shared-writer parity: 24/24 PASS, no skipped cases. This includes the three fixed original byte fingerprints, live/non-live/final writes, source capture, retry races, conflicts, caller commit/rollback, real INSERT failure, written-guard trigger visibility, one-use preparation, and malformed retry result ordering. Vitest reported 0.597 seconds overall; selected tests took 101 milliseconds.
- Unchanged legacy adapter: 14/14 PASS.
- Unchanged `ActualLiveOfficialStage`: 3/3 PASS, including the real application-INSERT corruption rollback. The combined 17-case legacy/adjacent stage reported 2.08 seconds overall; selected tests took 70 milliseconds.

All three final supervisors and original children exited 0. The serial launcher itself exited 0. Each stage verified unchanged source, dependencies, controls and runtime; there were no unhandled/suite errors or remaining owned processes. All stages used the existing v6 supervisor, the three shared locks, Node 26.10.0, one test worker, a 180-second stage cap, 1,024 MiB old-space cap and 2,048 MiB aggregate RSS cap.

Terminal evidence digests:

- Compiler: `b4fcca36c29ab3e39da4053cc03f2312d3d2ae8fa05103e5e89dd1f0bc6bb037`
- Parity GREEN: `ba582844c22627436b44d8213f44ba4354253bf7c625aa73429bd3f011b36df1`
- Legacy/adjacent: `84905bab4ccbc526fecff691374760357afbd3754a2759dd4374e04aae205728`

The three pre-extraction logical raw-row fingerprints remain fixed assertions:

- Live-ball: `b08a214083d8b2de904017f62cfbff293d1ffe70861bc0d89cc19fe31ff380c5`
- Non-live: `d1a889b29ff892548673fadad8a8dbf39fb1873bd06a3de6876aa7c7b01f3721`
- Final: `ff39e3d64aa2428a2fb481baea2f6657b8460cf3d60a9439c5b9e11ff2698bc3`

No whole-project compiler, full project test-suite or genuine terminal application qualification is claimed. Private database/domain artifacts, raw logs and runtime controls are not included in this source change. No CI, publication, merge or deployment was performed.
