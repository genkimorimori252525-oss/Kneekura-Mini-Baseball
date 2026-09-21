# Club World Lifecycle and Accounting Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for the already approved, nonvisual queue. Do not reopen frozen game design or attach a UI.

**Goal:** Continue PR #28 with a working, immutable club lifecycle: one-time seeded initialization, event-backed institutional changes, monetary accounting, historical season closure and carry-forward.

**Architecture:** One versioned ClubWorldState owns identity, institutional state, season plan and current references/accounting. A pure atomic command reducer emits replayable accepted events and historical snapshots. Other systems retain ownership of players, appointments, rivalry, legal contracts, financial regulations and match outcomes.

**Tech Stack:** Existing TypeScript/Vitest, Node assertions, no new dependencies.

**Spec:** Frozen design snapshot `782f6b8ef2406839de5678b00040001111cd8f77`: doc16 §§3–6.1/9–11/24, doc18 §§1–23/26, doc19 §§3–10/15/17–19, doc26 §§1–8/12–15. Source parent: PR #28 `d75be49e584129b992ec710c813f8d8e7bae1739`. Existing RivalryLifecycle and RosterTypes were read; those owners must not be copied or replaced.

## Global Constraints

- No presentation, rendering, visual layout, UI, button, Work or match-simulation connection.
- Seed expansion only at career creation. Pin dataset/catalog/source/transform/monetary calibration versions; restore does not accept a current catalog.
- L0 identity never changes through ordinary commands; rename/relocation preserve origin/history.
- Money is safe-integer minor units in one explicitly supplied simulation currency. No invented real-world amounts or default conversion of S-rank into cash.
- Initial five-axis expansion is a named versioned calibration, not runtime authority. Monetary amounts and physical stadium geometry must be supplied independently.
- Structural changes require cause-event references. No random drift, giant/crisis/seed-rank buffs or unverified outcome engine.
- Club state holds references to global players, roles, rivalry and threat, not copies of their internal state. Historical opening manager is not the current manager.
- Version-pinned season policies are data, not a claim to implement real financial regulations. Recording an already-created obligation is not authorizing a signing.
- Immutable accepted events/checkpoints permit replay; the host owns event authenticity, canonical reference existence, event-ID uniqueness and atomic persistent commits.
- Full regional catalog ingestion (27–30), automated financial simulation, tax/revenue-sharing/registration enforcement, autonomous structural drift, current five-axis calibration and lineage events are outside this slice.

## Review Focus

1. Cross-career/club commands and stale/backdated replays must not mutate a different ledger.
2. Principal borrowing is not revenue; repayment is not an operating cost; negative/fractional/overflow amounts are rejected.
3. Reserving budget must not move cash. Partial payment/cancellation must not erase paid amounts or double-use budget.
4. Season closure/opening must preserve unpaid liabilities, current staff, identity, seed metadata and structural capital; history is not runtime authority.
5. Malformed/sparse/extra-key persisted input and mismatched cash/receipts must be rejected. No derived labels may leak into causal state.

## File Map

`src/core/world/club/`:
- `ClubTypes.ts`: identity, seed, institutional, seasonal, reference, state and result contracts.
- `ClubFinanceTypes.ts`: budget, obligation, receipt and summary contracts.
- `ClubValidation.ts`: detached schema readers and checked arithmetic.
- `ClubSchemas.ts`: strict persistent/initial schemas and cross-field validation.
- `ClubCommands.ts`: exact operation/command schema dispatch.
- `ClubSeed.ts`: one-time initialization with an explicit seed transform version.
- `ClubFinance.ts`: receipt/obligation accounting and read-only financial summary.
- `ClubLifecycle.ts`: atomic institutional/reference/season command coordination.
- `ClubSeasons.ts`: historical closure and next-period carry-forward.
- `ClubEvents.ts`: replay and current-manager selection.
- `index.ts`: public API.
- `ClubFixtures.test-support.ts`, `ClubSeed.test.ts`, `ClubFinance.test.ts`, `ClubLifecycle.test.ts`: native tests.

## Task 1 — Seed and save boundary

Consumes: externally resolved catalog row, five targets, independently supplied money/geometry and current global references.
Produces: `createClubFromSeed`, `restoreClubState`, immutable `ClubWorldState`.

- [x] Write the initial tests, then observe missing-feature RED and assertion RED with an inert API stub.
  ```ts
  const result = createClubFromSeed(bootstrap());
  assert.ok(result.ok);
  assert.equal(result.value.identity.clubId, 'club-a');
  assert.equal(result.value.live.finance.cash, 1000);
  ```
- [x] Parse exact shapes, unique references, safe numbers and pins; project seed axes into separate institutional components only at creation.
- [x] Reject started careers, duplicate club IDs, invalid provenance and fabricated financial state; verify detached deep freezing and JSON restore.
- [x] Run local assertion suite and strict typecheck. Commit the task locally.

## Task 2 — Accounting

Consumes: valid state and club/career/revision/day-bound commands.
Produces: atomic revenue, commitment, settlement, release and principal-debt changes; `getClubFinanceSummary`.

- [x] Write failing tests for cash-neutral commitments, partial settlement/release, budget allocations, duplicate receipts, currency mismatch, insufficient cash and safe-integer overflow.
  ```ts
  const result = applyClubCommand(state(), command([{kind:'DRAW_DEBT', receiptId:'r1', amount:50, currency:'SIM'}]));
  assert.ok(result.ok);
  assert.equal(result.state.live.finance.cash, 1050);
  assert.equal(result.state.live.finance.revenue.ownerFunding, 0);
  ```
- [x] Keep current-year receipt reconciliation and separate opening balances; use exact integer accumulation.
- [x] Already-contracted obligations may exceed budgets: retain the liability and expose negative budget headroom; do not silently erase reality or authorize a contract.
- [x] Rejections return the exact input state, no accepted event and no history snapshot. Observe GREEN; commit locally.

## Task 3 — Structural/season events and replay

Consumes: task 1/2 state and validated operations.
Produces: `applyClubCommand`, `replayClubEvents`, `getCurrentClubManager`, accepted events and historical season snapshots.

- [x] Write failing tests for rename/relocation continuity, cause references, stale commands, manager replacement, directed relation references, arbitrary-label rejection and replay.
- [x] Close from current finance/person/structural state; retain opening and closing managers separately. Require current-period closure before opening the next consecutive season.
  ```ts
  const next = applyClubCommand(closed, openCommand());
  assert.ok(next.ok);
  assert.equal(next.state.live.finance.cash, closed.live.finance.cash);
  assert.equal(next.state.live.finance.commitments[0].paidBeforeSeason, 100);
  ```
- [x] Carry unpaid commitments, cash/debt and current role references; reset only period accounting. Do not reread a seed/catalog or run an automatic structural penalty.
- [x] Replay complete accepted command events against a checkpoint and compare exact state. Reject tampered/cross-world/out-of-sequence events atomically.
- [x] Run full new-suite checks and an inline adversarial review; regression tests for reproduced defects.

## Task 4 — Publish and verify

- [x] Document the API, authority boundaries, exact validations and example lifecycle. Record remaining plans without marking entire doc16/18/19/26 complete.
- [ ] Publish additions onto a dedicated branch stacked on PR #28; create a PR without merging or modifying shared branches.
- [ ] Run native `npm ci` / `npm run verify` on the exact published commit using the existing repository-specific runner; record actual output and warnings.
- [ ] Check published blob hashes, changed-file scope, PR base/head and final verification. Package report and exact additions.

## Execution rulings

- User explicitly requested continuous execution of already-frozen plans. This document decomposes implementation; it does not approve new gameplay policy.
- The local container has no GitHub/npm network access. It is an isolated partial review workspace, not a full clone. Native test imports are adapted only in temporary local copies to Node's runner. Full repository verification must occur remotely; do not label the supplementary run as the full suite.
- Regional catalog values remain with their canonical datasets. This slice consumes resolved catalog entries rather than silently assigning new canonical IDs to 234 clubs.
