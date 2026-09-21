# Confirmed Headless Roster Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. The user explicitly requested execution in this session, not a new design approval cycle.

**Goal:** Implement the dependency-ready roster state/command/query slice of approved doc32 without connecting any design, UI, rendering, or game-client code.

**Architecture:** Immutable, serializable roster snapshots reference existing global player IDs; they never copy abilities or create players. Rights, assignment, registration, and availability remain separate. Pure state transitions validate the final batch and return either the entire next snapshot plus an event, or the unchanged state plus a structured reason. Queries expose only administrative roster information.

**Tech Stack:** Existing TypeScript strict Core and Vitest. Existing Windows self-hosted `P0 Core` / `npm run verify`. No dependencies or CI workflow edits.

**Spec:** `docs/game-design/32-roster-development-architecture-DRAFT.md` at design commit `782f6b8ef2406839de5678b00040001111cd8f77`, especially sections 2–6, 9, 11–12, 25 and 31. Approval verified through that exact document and `00-current-design-handoff.md`; the legacy filename is not an unapproved status. This implementation is a slice, not completion of all of doc32.

## Global Constraints

- Session principle: implement confirmed functions and tests; do not connect to design, rendering, UI, screens, buttons, or Work prototypes.
- Implementation base: `7af4dfd7fca518fbd2fac423a7d7c9077e402704` on `jolly/core-realism-2026-09-18`.
- Task branch: `jolly/confirmed-headless-roster-2026-09-22`; no direct writes to the shared implementation/design branches and no unrelated PR merges.
- One global player reference per membership record. No roster-tier player copies.
- Five assignment kinds are semantic categories, not five fixed storage slots. Multiple development levels are supported.
- An assignment change is not an automatic registration, recovery, contract, transfer, ability improvement, or match result.
- No real-league roster counts are invented. All numeric policy tests are explicitly synthetic.
- Historical competition-edition policies are stored in the snapshot. New external seed/profile data cannot silently alter an existing career.
- This is a roster-only participation gate, not full competition legality or a replacement for RuleEngine.
- Pure APIs; no clock, RNG, DOM, renderer, UI dependency, or new production state singleton.

## Review Focus

1. Full active-roster exchanges must validate the final state, not reject a legal batch because the incoming player was processed first.
2. An injury must not secretly deactivate registration, and an assignment must not heal a player or silently activate them.
3. A loaned player must remain one player with original rights while local assignment can change at the agreed destination.
4. Mutable input or later external profile updates must not rewrite snapshot/history or leak hidden player truth into roster queries.
5. Replayed/stale commands must not create duplicate history; malformed serialized/runtime inputs must fail explicitly.

## Task 1: Unique state and pinned policy boundary

Files: create `src/core/world/roster/RosterTypes.ts`, `RosterState.ts`, `RosterValidation.ts`, `index.ts`, `RosterTestFixtures.ts`, and `RosterState.test.ts`.

Interfaces:
- `createRosterState(input: RosterStateInput): RosterState`
- `RosterValidationError.issue: RosterIssue`
- Independent `PlayerClubState`, `AssignmentUnit`, `RosterCompetitionProfile`, and `RosterState` contracts.

- [x] Write tests using real synthetic snapshots; observe missing feature failure before production implementation.
- [x] Validate nonempty IDs, safe integer counters/limits, enum values, duplicate player/unit/edition IDs, registration references, unit/club consistency, and final active capacity.
- [x] Copy only defined roster fields and deep-freeze snapshots. Support save roundtrip, null assignment/rights, and represented authorized external assignments.
- [x] Run focused tests plus the project's full verification through the existing runner.

Concrete test contract (complete executable cases are in `RosterState.test.ts`):
```ts
const state = createRosterState(rosterFixture());
expect(state.units.filter(u => u.clubId === 'a' && u.kind === 'DEVELOPMENT'))
  .toHaveLength(2);
expect(Object.isFrozen(state.profiles[0].allowedAssignmentKinds)).toBe(true);
```

## Task 2: Atomic mutations and renderer-neutral queries

Files: create `src/core/world/roster/RosterCommands.ts`, `RosterQueries.ts`, and `RosterCommands.test.ts`; extend the new local `index.ts`.

Interfaces:
- `applyRosterChange(state: RosterState, command: RosterChangeCommand): RosterChangeResult`
- `evaluateRosterParticipation(state: RosterState, query: RosterParticipationQuery): RosterParticipationResult`
- `getClubRoster(state: RosterState, clubId: string): ClubRosterSummary`

- [x] Write executable cases for promotion without registration, final-state active swap, atomic rejection, injury/rehab policy, revision/day rejection, external transaction boundary, no-op, deterministic event, and detached command input.
- [x] Implement an expected-revision guarded pure batch reducer. A command can update assignment, availability, and explicitly supplied per-edition registration entries only. It cannot mutate rights or profiles.
- [x] Generate revision-derived event identity plus caller command/cause provenance; return an event only on success.
- [x] Reject cross-club assignment changes that require an unimplemented transfer/loan transaction rather than inventing that transaction. Existing agreed external assignments remain representable and locally mutable.
- [x] Expose roster-only participation with ordered reason codes and pinned profile reference. Keep assigned players separate from rights-held players in club summaries.
- [x] Run full `npm run verify` through `p0-core.yml` at exact branch SHA.

Concrete atomicity test (complete executable cases are in `RosterCommands.test.ts`):
```ts
const result = applyRosterChange(state, command([
  { playerId: 'p2', registrations: [active] },
  { playerId: 'p1', registrations: [{ ...active, status: 'INACTIVE' }] },
]));
expect(result.ok).toBe(true);
expect(result.state.revision).toBe(1);
```

## Task 3: Review and handoff

Files: `docs/core/roster-v1-headless-api.md`, `docs/project-status/2026-09-22-confirmed-headless-implementation.md`.

- [x] Review the whole change for input validation, immutability, final-state capacity semantics, and forbidden design integration.
- [x] Record exact RED/GREEN commands, SHAs, run IDs, test counts, and any review corrections.
- [x] Publish a PR against `jolly/core-realism-2026-09-18` and leave shared branches untouched.
- [x] Document API examples, reason semantics, scope limits, and the dependency queue. Never call all of roster/career simulation implemented.

## Execution rulings

- Native disposable workspace creation failed on an existing oversized visual artifact. Container GitHub DNS is unavailable. Use an exact-SHA dedicated GitHub branch, atomic commits, and the already-configured repository-specific self-hosted runner; do not delete or alter visual assets to make a workspace fit.
- Existing exact-base `P0 Core` run `35654541121` / #1483 is successful.
- No independent subagent reviewer is available in this session. Review is inline and must not be reported as independent review.

## Completion evidence

The first administrative slice is implemented in PR #26, without UI/Work integration. Source/test commit `72ededa600621e3f49265b2ad59a3c98c82f3dd2` passed `npm run verify` on the existing Windows runner: P0 Core #1496 / run `35660292695`, 245 files / 1181 tests. New roster tests total 55. Full sequence including RED, review fixes, the test-only typing failure and all scope limits is recorded in `docs/core/roster-v1-review.md` and the project-status handoff. No broader doc32 completion or merge is claimed.