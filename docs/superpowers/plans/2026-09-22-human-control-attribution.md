# Human Control Overlay / Decision Attribution Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Execute the user's approved nonvisual queue without reopening frozen design decisions.

**Goal:** Implement the next dependency-ready slice after PR #26: preserve the current underlying manager, distinguish human and manager decisions, and prevent human choices becoming manager self-chosen learning or competence evidence.

**Architecture:** A pure, immutable control policy routes existing baseball decision domains. An opportunity supplied by the authoritative action owner supplies the current manager appointment and one shared legal action set. Accepted decisions capture attribution at decision time; execution evidence is joined separately and never manufactured by selection.

**Tech Stack:** Existing TypeScript/Vitest; no new product dependencies.

**Spec:** Design snapshot `782f6b8ef2406839de5678b00040001111cd8f77`: doc32 §18; doc38 §§7–8,13; doc42 §§18–19,22; doc49 §§13–16,39–45. Source baseline PR #26 `062cf366db8a878c666b3d55bbc0e9e83c8e2d5f`.

## Global Constraints

- No UI, Work, presentation, artwork, buttons, renderer connection or social-management operation.
- Do not replace the Manager Agent or copy its skills, beliefs, memories, contracts or appointment lifecycle into overlay state.
- Current appointment comes from its owner on every opportunity; historical records retain their original manager.
- HUMAN_OVERRIDE cannot be overwritten by manager skill, used as manager self-chosen strategy evidence, or used as manager decision-quality/skill evidence.
- Actual world consequences remain canonical for every decision origin.
- User and manager share the same legal action IDs; action feasibility, action execution and rules remain with their existing owners.
- No invented outcome engine, probability/ability/mood modifier, manager selector, market simulator, or self-chosen-learning algorithm.
- Do not merge separate physics/swing work or modify existing source files.
- The host owns authentication, world/overlay compare-and-swap, immutable action/trace/event storage, transactions, and evidence deduplication.

## Review Focus

1. Switching clubs while a decision is pending: reject the obsolete control revision.
2. Manager retirement/replacement during human control: use the current appointment, reject stale proposals, preserve historical attribution.
3. One-shot human input on a delegated domain: keep the exact legal human action; never silently fall back to a manager.
4. Malformed/sparse/duplicated runtime lists or forged stored origin: reject, do not partially mutate or misattribute.
5. Selection without execution, mismatched event receipts, repeated receipt delivery: no invented outcome; reject cross-decision joins and provide deterministic replay-safe projections without growing state.

## File Map

- `src/core/world/control/ControlTypes.ts`: input/result/reference contracts.
- `ControlValidation.ts`: runtime validation and detached immutable snapshots.
- `HumanControl.ts`: policy restoration/change and authority routing.
- `ControlledDecision.ts`: legal selection, immutable attribution and restoration.
- `DecisionEvidence.ts`: actual-execution join and self-chosen evidence projection.
- `index.ts`: documented public surface.
- `ControlFixtures.test-support.ts`, `HumanControl.test.ts`, `ControlledDecision.test.ts`: native repository tests.
- `docs/core/human-control-v1-headless-api.md`: caller responsibilities and examples.
- `docs/project-status/2026-09-22-human-control-attribution.md`: execution ledger, verification, remaining queue.

## Task 1 — Control state and routing

**Consumes:** host-supplied controller ID, current controlled club, registered existing baseball domain IDs and manual domains; current manager appointment and legal action IDs.
**Produces:** `createHumanControlState(input)`, `changeHumanControl(state, change)`, `resolveDecisionAuthority(state, opportunity)`.

- [x] Write native tests before product source, including:
  ```ts
  const state = createHumanControlState(seed());
  const result = resolveDecisionAuthority(state, opportunity());
  assert.ok(result.ok);
  assert.equal(result.value.kind, 'HUMAN_REQUIRED');
  ```
- [x] Confirm missing-module/API RED before implementation. Local transport cannot clone GitHub; use dependency-free Node assertions with only the test-runner import adapted in a temporary copy. This does not replace full repository verification.
- [x] Implement detached frozen state, known domains, sorted set-like domain lists, revision checking, atomic/no-op changes, and explicit manual/delegated/autonomous routing.
- [x] Run all local control tests and strict compilation; publish tests and source together only after review.

## Task 2 — Decision and evidence attribution

**Consumes:** state/opportunity from task 1; `DecisionSubmission` with exact decision/context IDs, actor identity, exact selected legal action and expected revisions; manager proposals include appointment and decision-time trace reference.
**Produces:** `selectControlledDecision`, `restoreControlledDecision`, `attributeExecutedDecision`.

- [x] Write tests for exact human action, shared legality, authority/revision/appointment mismatch, manual-domain fallback rejection, immutable historical attribution, persisted-origin tampering, world-evidence retention and human exclusion from self-chosen manager evidence.
  ```ts
  const chosen = selectControlledDecision(state, opportunity(), humanSubmission());
  assert.ok(chosen.ok);
  const joined = attributeExecutedDecision(chosen.value, execution());
  assert.ok(joined.ok);
  assert.equal(joined.value.managerSelfChosenEvidence, null);
  assert.deepEqual(joined.value.worldEvidence.eventIds, ['world-event-1']);
  ```
- [x] Confirm RED; implement selection with no RNG, no manager callback and no execution side effect.
- [x] Restore attribution by checking its captured actor/control/appointment facts, not trusting a stored origin label alone.
- [x] Join only matching execution/context/action references; require nonempty canonical event references, reject evidence predating the decision. Keep replay deterministic and storage external.
- [x] Run tests, inline adversarial review and regression tests for every reproduced defect.

## Task 3 — Publication and integration evidence

- [x] Record exact source/test hashes and limits. Verify no existing simulation/rules/presentation file changed.
- [x] Publish on a dedicated continuation branch from PR #26; open a stacked PR, do not merge the shared branches.
- [x] Run existing `npm run verify` on the complete repository where available. Native connector has no workflow-dispatch action; any task-specific validation workflow must retain read-only permissions, exact branch routing and the repository-specific runner label. Never rerun an old commit and claim it validates new code.
- [x] Record actual results, not expected totals. If publication or full execution is unavailable, preserve the complete patch/bundle and disclose that boundary.
- [x] Keep physics and traits visible in the remaining queue; do not mark their independent work complete from memory.

## Completion ledger

Tasks 1–3 complete for this bounded slice. Source commit `bcced59c7255b5d539b8a9dc69191c1494c8767b` was verified by native run `35664397763` (job `106546766547`): typecheck and 247 files / 1,246 tests passed. PR #28 is stacked on #26, not merged. All 13 published file hashes match the local files. Documentation-only closure gets its own push verification; final results belong in the PR conversation. Dependency audit and runtime warnings are explicitly recorded in the project-status document, not silently repaired.
