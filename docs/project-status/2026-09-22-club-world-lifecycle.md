# 2026-09-22 — Club World lifecycle / accounting continuation

## Source and boundary

Continuation of the user's confirmed-plan execution queue, with no design/UI/Work/rendering connections.
Parent: PR #28 `d75be49e584129b992ec710c813f8d8e7bae1739`, tree `f53db0147d0c45f7b10bc816cc189df306250231`.
Frozen design: `782f6b8ef2406839de5678b00040001111cd8f77`, canonical docs16/18/19/26.
New head branch: `jolly/confirmed-headless-club-2026-09-22`, stacked on `jolly/confirmed-headless-control-2026-09-22`. No merge or shared-branch rewrite.

Read before continuation: `docs/core/club-world-v1-headless-api.md` and `docs/superpowers/plans/2026-09-22-club-world-lifecycle.md`.

## Working implementation

- Six pure public operations: creation, restore, command application, event replay, accounting summary and current-manager lookup.
- L0 identity continuity; creation-only version-pinned seed expansion; independent monetary/geometry calibration inputs.
- Detached frozen state; exact-shape serialized-data validation, source/reference separation and overflow-safe integer arithmetic.
- Atomic institutional/reference/accounting/season operations with explicit world/club/revision/day/cause binding.
- Approved allocation, real obligation, actual payment, cancellation, real revenue and principal debt remain distinct.
- A real liability is not discarded simply because it exceeds a budget; summary scope is ACCOUNTING_ONLY, not signing/registration authorization.
- Historical season closure, old unpaid obligation carry-forward and bounded live-period ledger. No reseeding or automatic structural penalty at rollover.
- Checkpoint replay verifies event consistency, including recomputed history; authentication and global deduplication remain host duties.
- Current manager comes from current Person-role references, not the opening manager snapshot. Existing player/roster/rivalry owners are unchanged.

## Test and review ledger

1. Task1 inert API assertion RED: 12 failing tests out of26; GREEN after implementation:26/26.
2. Task2 assertion RED:19 failing tests out of53; GREEN:53/53.
3. Task3 assertion RED:24 failing tests out of80; GREEN:80/80.
4. Inline whole-slice review reproduced three defects: a net-zero structural batch lost its provenance; receipt reconstruction accepted an impossible intermediate negative cash balance; receipt chronology could be reversed while preserving totals.
5. Regression run before corrections:87/90 passed, three failures. After fixes:90/90.
6. Additional existing-behavior endurance test advances 300 accounting seasons, carries one unpaid obligation and replays from a mid-career checkpoint. Final local run:91/91, no failures.

No independent reviewer agent was available; review was inline and must not be described as independent.

Local environment is a source-only isolated workspace, not a complete clone. Node22.16.0 / TypeScript5.8.3 compile temporary copies with ONLY the Vitest runner import replaced by node:test. Node assertions and product source are unchanged. Strict/no-unused/no-fallthrough/isolated-module checks pass. This supplementary evidence is not the repository-native Node26 / locked TypeScript5.6 / Vitest full suite.

Native verification is commit-scoped on the PR for the named head branch. Its PR result/comment records the exact published SHA, workflow run/job IDs, full-suite counts and warnings after execution. Do not infer native success solely from these local numbers. The additive workflow targets only this branch, uses the existing Windows/minibaseball self-hosted runner, grants contents:read and has no pull_request trigger. Existing source, CI, package and lock files are not modified.

## Published native verification

PR #29 is stacked on #28. Product/source commit: `481f4533ad4999c3dde87dc16fb565e182c97384`.
GitHub Actions run `35668545976`, job `106559599227`, completed successfully on 2026-09-22 JST.
The checkout log confirms that exact source SHA. Native `npm ci` and `npm run verify` succeeded:

- Node26.9.0 / npm11.19.1 / Vitest2.1.9 on the existing Windows/minibaseball runner.
- `tsc --noEmit`: success.
- Full suite: **250 files / 1,337 tests passed**, including **91 new club tests** (26 seed, 27 finance, 38 lifecycle).
- Published diff:19 additions only, no deletions or edits to existing files. Rebuilding the tree from all19 local blob IDs reproduced published tree `2e42385fd5bc9ccc01f862954c6bb056bd7dca41`.

`npm ci` still reports **5 vulnerabilities:3 moderate,1 high,1 critical**. Their individual causes/exploitability were not investigated and no forced upgrades were made. Separate warnings concern esbuild install-script approval, action-host Node20 deprecation/Node24 fallback and punycode deprecation; no new approvals or warning bypasses were added.

A documentation-only follow-up updates this ledger/plan. Its exact final SHA and fresh native verification are recorded in the PR verification comment; do not confuse first-source validation with final-head validation. No merge or game/UI integration is performed by this slice.

## Limits and next queue

This is the club lifecycle/accounting boundary, not all of docs16/18/19/26 completed and not live game-service integration. No real financial source values are fabricated. Richer seed-to-structure calibration, economy-generated effects and current derived views remain explicit work.

The next continuation in this same nonvisual group is **canonical 234-club dataset ingestion / identity resolution and new-career seed assembly** (21/26–30), reusing the existing directed RivalryLifecycle adapter rather than duplicating it. Read the actual canonical IDs/source matrices before mapping rows; keep historical rivalry separate from current threat. Never apply new datasets to existing careers. Real monetary initialization still needs an explicit versioned simulation calibration, not invented precise real-world finance.

After those prerequisites, automatic club economic/structural updates and regulation services must have scoped calibrated inputs and verifiable event causes; do not treat labels as actions or invent policy thresholds silently.

Physics/live-ball closure and swing remain independently progressing work: inspect their exact latest PRs before integration. Psychology/special abilities (05/08/09/37/38), team traits (34/35), competitions/calendar, scouting, development and manager AI/market remain queued, not implemented or merged by this slice.

PR #26 and #28 remain separate review/integration work. No new UI/design task is authorized by this continuation.
