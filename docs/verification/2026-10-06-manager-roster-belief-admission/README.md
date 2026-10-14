# Manager roster belief source admission

The existing roster opportunity writer now authenticates the original Manager belief history before admitting a new opportunity and rechecks it after INSERT, on its own transaction connection. An unchanged current head and observation count no longer conceal a damaged earlier observation. Writer-local source mutation rolls back with the consuming INSERT.

The implementation adds six lines to `SqliteManagerRosterDecisionStore.ts` and reuses `readManagerBeliefBoundary` / `assertManagerBeliefBoundary(..., 'current')`. It preserves the explicit pre-history bootstrap/reconciliation path, legal candidate and medical guards, supplied Manager/appointment binding, serialized opportunity shape, and existing execution owner. No scheduler, new owner, calibration or policy default was added.

## Source-pinned verification

The genuine prerequisite starts from existing public owners and a real accepted roster execution. Its learned Manager selects `rest-p1` from two legal choices while the original agent selects `keep-p1`; the choice is durably applied, observed, retried and reopened. Exact historical execution retry still works after a later real Manager observation.

Before the repair, the prerequisite passed and three separate admission assertions failed for the intended missing rejection: direct issue, belief-derived issue, and mutation on the real writer connection after the actual opportunity INSERT. The corruption changes only an old observation while leaving current Manager head/count unchanged; existing replay independently rejects it.

After the repair, all four new cases and all 34 cases in the four adjacent Manager roster/history/boundary suites passed. This includes actual mutation rollback, historical/current-boundary separation, original Club/Mood evidence, explicit bootstrap, authority/revision checks and durable retry/reopen. Full TypeScript compilation and catalog checks passed. Both gates had zero skipped/pending/todo cases and zero unhandled errors; source/dependency/control hashes remained unchanged and all owned processes were reaped.

| Gate | Tested commit | `src` tree | Result |
|---|---|---|---|
| RED prerequisite and regressions | `913ef9d6ac2c424a67213013d15c08ddda457f0f` | `3d6e390d6d576be8c2610727cf5b4bac644c2dfa` | 1 prerequisite PASS; 3 precisely classified expected assertion failures |
| GREEN and adjacent compatibility | `3d5823785da8dd2eacd907b889f64577ee344d93` | `5b9dc8b4a82b502b2d6f91be30747cbc331d5c38` | 38 PASS, 0 failed |

Complete per-stage and per-test result metadata is retained in [red-result.json](red-result.json) and [green-result.json](green-result.json). These are small, explicitly derived summaries of the original controller receipts; original receipt hashes identify the evidence without publishing local paths, databases or raw telemetry. The GREEN receipt completed at `2026-10-06T21:46:02.723541+00:00`.

The publication cut retains the exact tested GREEN `src` tree. A different publication commit or parent identifies packaging history, not a new runtime execution. This bounded 38-case result does not establish autonomous Career completeness, whole-project success, archived-source compatibility or unrelated physical/visual work.
