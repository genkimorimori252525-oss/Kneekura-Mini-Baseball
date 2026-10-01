# Native Club season transitions — 2026-10-01

## Approved scope

Current foundation `44b9f5de7b9d87e649f12f1af78c202f2b5ab44d`, frozen document18 sections9/21/22/26 and existing Core Club lifecycle. User authorization covers all confirmed nonvisual work. Design, Presentation, archived plans and merges remain excluded.

## Implementation

- `SqliteClubSeasonTransitionStore` reads a Source ID from an independent accepted boundary authority. The exact versioned record contains the existing Club command, restricted to CLOSE, OPEN or CLOSE then OPEN. It reads the actual accepted World Club journal/current head and invokes the existing Core lifecycle; callers cannot supply a replacement current state.
- One SQLite transaction appends the accepted Club event, advances the shared head by CAS and saves immutable before/result/closing-snapshot evidence. Snapshot season and identity are unique within their respective scopes. Failure rolls back all writes.
- Archive reads replay the shared history to the original before revision, rederive the exact Core transition and snapshots, compare the actual accepted event and archive, and validate the complete current World history. Original retries return the original result after later seasons or reopen without a live Source reader. Changed live Source, stale/backdated/nonseason commands, duplicate closing identity and corrupt archive fail.
- Next World season initialization previously compared the advanced current Club against its creation checkpoint, producing `initial Club checkpoint differs`. Existing heads now retain their original checkpoint and require a valid complete accepted history. New heads still receive their original checkpoint atomically. Damaged existing history rolls back next-season insertion.

## Verification

Separate missing-module RED and actual next-season consumer RED were captured before each corresponding implementation/fix. Focused lifecycle/economy/World/season gates passed: 4 files / 56 tests. The latest strengthened Native gate passed 5 tests; catalog compilation and typecheck passed. A fresh independent read-only reviewer reported no Critical/Important/Minor findings and independently passed 2 files / 14 tests.

Gates cover actual Native revenue before rollover, carried cash/debt/identity/current references, reset seasonal income, immutable historical snapshots, 24 Native years with an unpaid obligation and mid-run reopen, original retry after later years, separate CLOSE/OPEN, changed/accessor Source rejection, duplicate snapshots, SQLite head-update rollback and damaged-history initialization rollback. The explicit source data in tests is a verification fixture, not production calibration.

Final `npm run verify` succeeded: catalog compilation/typecheck and 527 test files / 3,136 tests passed in 620.43 seconds. The existing National actor/roster gates and fingerprints are preserved.

## Remaining approved work

Published as PR233 stacked on PR232 at `cfef573fb57729856319eaea138295694b503713`; P0 run36834768541 succeeded at that SHA. Attachment was attempted once; the app's 100-artifact limit rejected it.

This owner adopts independently accepted closing evidence and the approved next plan. It does not generate competition results, roster/fanbase summaries, new calibrated content or an autonomous Career loop. Those actual Source-generation/runtime orchestration gaps remain in the active overall goal. Historical closing snapshots never become runtime authority.
