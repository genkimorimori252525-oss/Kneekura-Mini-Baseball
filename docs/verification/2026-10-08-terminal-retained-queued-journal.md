# Retained QUEUED original-journal qualification

2026-10-08. Three new retained-input acceptance cases passed independently:
Q07a fresh-event refusal, Q07b original journal retries/history, and Q07c
same-ID Source conflicts. These are current-source behavior qualifications.
They are not executions of the original PR355 fixture cases, and do not
increase PR355's retained original-source count of 14 qualified cases.

## Source and input boundary

- Isolated baseline: `fe4910e4154a50afe9799161e33a40cf2ebc4e21`.
- Q07a execution: commit `a24bb7b60a54db20e26e9237f4d38526c4a94287`,
  src tree `c4428f28c9871a606aba2752b9ee8419a3468d1a`.
- Q07b/c execution: commit `35822cdc24a034e53b56dbd3a59b7e1653f17d79`,
  src tree `50d1ac9017a11954ba24de1d72a4c45a63437808`.
- The changes add acceptance tests, one test-support adapter and dedicated
  compiler/Vitest configurations. Existing production owners and the original
  Q test files are unchanged from the baseline.
- The original closed queued producer remains SHA-256
  `8305d345aecd3ec15df6f6cea2870279bb93afe57bdf402ce2aac89731d177d5`.
  Its retained manifest is SHA-256
  `c9752f02197fd358f95bd180e9639ebd45b697cb83fe8708d31cb40a7f6764ec`.
  The producer receipt, original controls, terminal, report, stdout and stderr
  are pinned and authenticated by the existing `retainedTerminalProducer()`.

The original producer's owning receipt records exit 0 and exit+close. Its
outer historical acceptance run was an intended missing-runner RED with
child exit 1; that RED is not a GREEN application result.

Each gate calls the existing `prepareCapableQueuedCopy()` for its own
exclusively created private database. This preserves the original rows while
performing the established private version-2-to-3 and exact CHECK preparation.
The no-write assertion baseline follows this preparation. No later durable
state is reversed, no physical root is regenerated, no official application
is performed, and no successful reader result is synthesized.

## Independently executed cases

| Case | Selected acceptance file | Assertions qualified |
|---|---|---|
| Q07a | `ActualFoulTerminalQueuedJournalRetained.acceptance.ts` | After a real queue read and original journal authentication, fresh advance, new fence and old-head fence each throw exactly `foul official terminal ownership already claimed` before event/head writes. |
| Q07b | `ActualFoulTerminalQueuedJournalRetryRetained.acceptance.ts` | A separately opened official owner with no Source callbacks returns the exact original session and all three accepted event snapshots on retries; `readAt(0..3)` preserves the exact historical snapshots. |
| Q07c | `ActualFoulTerminalQueuedJournalConflictRetained.acceptance.ts` | Changing only the accepted-event callback's same-ID Source bytes throws exactly `foul official event Source is frozen differently`; changing only the accepted-intent callback throws exactly `foul official intent Source is frozen differently`. Both callbacks are restored. |

All files are under `src/host/world/`. Each gate freshly authenticates the
QUEUED Source through the actual queue owner, and the original session,
three-event journal and selected head through the actual official owner.
The queue remains QUEUED with a null result and no application receipt.
Archived event/intent bytes are reused only after Native journal replay and
the earlier historical snapshots have authenticated them.

The Q07a write witness observes the real event INSERT/head UPDATE path.
All three cases additionally check that read/retry/refusal operations attempt
no mutating SQL and do not change SQLite `total_changes`, full logical rows,
main/temp schema, transaction state or `query_only`. Every owned connection
is explicitly closed and then checked to reject further operations. The
retained producer remains hash-identical and sidecar-free.

## Execution and accounting

Each case ran in its own supervised Node v26.10.0 process with one Vitest
thread worker, 1024 MiB old-space cap, measured 1120 MiB V8 heap limit,
2048 MiB aggregate RSS cap, 1200-second test timeout and 1320-second outer
wall cap. Three private lock files isolate the lane. Immediate prelaunch
admission requires at least the RSS cap plus a 4096 MiB memory reserve.
Both focused compiler stages used the same memory controls and a 180-second
outer cap. No home-PC CI was launched.

| Stage | Result | Test time | Peak aggregate RSS (KiB) | Terminal SHA-256 |
|---|---|---:|---:|---|
| Q07a focused compiler | exit 0 | — | 499656 | `c13f59306b168feffed8ea8200b25d1e382bd64bb83f6a20fc340752464801d6` |
| Q07a | 1 passed, 0 failed/skipped | 113.400 s | 611144 | `060c0cbebd09864baf907eeb5c5e53ba6cb0e4155176d062fdca53103b74d61e` |
| Q07b/c focused compiler | exit 0 | — | 490496 | `4dc3e01ab16c42c009b8627cf7e3c1080a1a57d0e5e9a04239cc59813906cabd` |
| Q07b | 1 passed, 0 failed/skipped | 182.630 s | 608988 | `021d3e79aeaa2dda30bdf3b35d55d7c9006d9e810b424701dfa5f25489e84b4f` |
| Q07c | 1 passed, 0 failed/skipped | 99.168 s | 608344 | `6cf7cb2d083ee852cd796867f1337e34d6725d56762fc107c8b65e3d36ad4492` |

All five terminals record no failures, cancellation signals or remaining
owned processes, with identical before/after source, dependency, control and
runtime input groups. Each Native stage's root Node and esbuild processes
were observed exiting 0 and reaped. Q07b also observed one short-lived owned
descendant, and Q07c six, whose exits were already handled by their owners:
their exit codes were not observable by the outer supervisor and remain
explicitly unknown. This is not an all-descendant-exit-0 claim. No passing
case was rerun to change that accounting.

The exact test-report SHA-256 values are:

- Q07a: `6f61dc74efffa942604cc8445cb1d5d88802c8d079a5cf2c9d3885b623e64362`
- Q07b: `08ac742b76e6091fd723bd4f36c82c84c059fb4d074384382a1ab9783c955665`
- Q07c: `4715c77e73816524551160cffc2a7fc0b691a4c80e2eafe545b745358fd57170`

Private databases, raw logs and controller manifests remain local and are
not part of the published patch.

## Publication stack

The seven added files are stacked on final PR368 local source
`aab6f1662657660e9f46d324a74a58490a8a00dc` (published head
`e09dd3a762f94382ed07b82ed637660e826c1893`). This preserves its later
read-open test fixes and verification documentation. All production source
files and the retained-journal adapter's transitive local dependency blobs
match the qualified cuts above; the ignored generated catalog also matches
its pinned bytes and all 15 generator inputs. The three intervening source
changes are unrelated next-play readback tests/support and are outside that
dependency closure. No genuine gate is rerun or reattributed for this stack.

## Still held

Q07d/e, Q08a/b and the separate seven Q04 cases remain unrun. They need
genuine pre-queue/current-prefix inputs that this closed queued lineage
cannot supply. The independently genuine second origin remains absent.
Later application/acknowledgement retries, A-S02, or completed-history reads
are not substituted for these journal tests. Neither whole Task2A nor the
whole project test suite is claimed complete.
