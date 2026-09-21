# Confirmed Headless Roster Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. The user explicitly requested execution in this session, not a new design approval cycle.

**Goal:** Implement the dependency-ready roster state/command/query slice of approved doc32 without connecting any design, UI, rendering, or game-client code.

**Architecture:** Immutable, serializable roster snapshots reference existing global player IDs; they never copy abilities or create players. Rights, assignment, registration, and availability remain separate. Pure state transitions validate the final batch and return either the entire next snapshot plus an event, or the unchanged state plus a structured reason. Queries expose only administrative roster information.

**Tech Stack:** Existing TypeScript strict Core and Vitest. Existing Windows self-hosted `P0 Core` / `npm run verify`. No dependencies or CI workflow edits.

**Spec:** `docs/game-design/32-roster-development-architecture-DRAFT.md` at design commit `782f6b8ef2406839de5678b00040001111cd8f77`, especially sections 2–6, 9, 11–12, 25 and 31. Approval verified through that exact document and `00-current-design-handoff.md`; the legacy filename is not an unapproved status. This implementation is a slice, not completion of all of doc32.

## Global Constraints

- Session principle: implement confirmed functions and tests; do not connect to design, rendering, UI, screens, buttons, or Work prototypes.
- Implementation base: `7af4dfd7fca518fbd2fac423a7d7c9077e402704` on `jolly/core-realism-2026-09-18`.
- Task branch: `jolly/confirmed-headless-roster-2026-09-22`; no direct writes to shared implementation/design branches or unrelated PR merges.
- One global player reference per membership record. No roster-tier player copies.
- Five assignment kinds are semantic categories, not five fixed storage slots. Multiple development levels are supported.
- Assignment changes are not automatic registration, recovery, contracts, transfers, ability improvements, or match results.
- No real-league roster counts are invented. Numeric policy tests are explicitly synthetic.
- Historical competition-edition policies are stored in the snapshot; new external seeds cannot silently alter an existing career.
- This is a roster-only participation gate, not full competition legality or a RuleEngine replacement.
- Pure APIs; no clock, RNG, DOM, renderer, UI dependency, or production state singleton.

## Review Focus

1. Full active-roster exchanges validate the final state, not the transient incoming-player step.
2. Injury must not secretly deactivate registration; assignment must not heal or activate a player.
3. A loaned player stays one player with original rights while local assignment can change at the agreed destination.
4. Mutable input and later external policy updates cannot rewrite historical snapshots or leak hidden player truth.
5. Stale commands cannot create duplicate history; malformed runtime inputs fail explicitly.

## Task 1: Unique state and pinned policy boundary

Files: `src/core/world/roster/RosterTypes.ts`, `RosterState.ts`, `RosterValidation.ts`, `index.ts`, `RosterTestFixtures.ts`, `RosterState.test.ts`.

Interfaces:
- `createRosterState(input: RosterStateInput): RosterState`
- `RosterValidationError.issue: RosterIssue`
- Independent `PlayerClubState`, `AssignmentUnit`, `RosterCompetitionProfile`, `RosterState`.

- [ ] Write real synthetic snapshot tests and observe missing-feature failure before implementation.
- [ ] Validate IDs, safe counters/limits, enums, duplicate references, registration references, unit/club consistency and final active capacity.
- [ ] Copy defined roster fields and deep-freeze snapshots; support save roundtrip, null assignment/rights and represented agreed external assignments.
- [ ] Run tests and full project verification through the existing runner.

Concrete test contract (complete executable cases: `RosterState.test.ts`):
```ts
const state = createRosterState(rosterFixture());
expect(state.units.filter(u => u.clubId === 'a' && u.kind === 'DEVELOPMENT')).toHaveLength(2);
expect(Object.isFrozen(state.profiles[0].allowedAssignmentKinds)).toBe(true);
```

## Task 2: Atomic mutations and renderer-neutral queries

Files: `RosterCommands.ts`, `RosterQueries.ts`, `RosterCommands.test.ts`; extend the new local `index.ts`.

Interfaces:
- `applyRosterChange(state: RosterState, command: RosterChangeCommand): RosterChangeResult`
- `evaluateRosterParticipation(state: RosterState, query: RosterParticipationQuery): RosterParticipationResult`
- `getClubRoster(state: RosterState, clubId: string): ClubRosterSummary`

- [ ] Test promotion without registration, final-state capacity swap, atomic rejection, injury/rehab policy, revision/day rejection, external transaction boundary, no-op and deterministic detached events.
- [ ] Implement an expected-revision guarded pure batch reducer; change assignment, availability and supplied edition registration entries only, never rights or profiles.
- [ ] Emit revision-derived event identity and caller command/cause provenance only on success.
- [ ] Reject new cross-club assignments requiring an unimplemented loan/transfer transaction, while allowing local changes at an already-agreed destination.
- [ ] Expose roster-only participation reasons and pinned policy reference; distinguish rights-held from assigned player lists.
- [ ] Run full `npm run verify` through `p0-core.yml` at exact branch SHA.

Concrete atomicity contract (complete executable cases: `RosterCommands.test.ts`):
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

- [ ] Review the complete diff for validation, immutability, final-state semantics and forbidden design integration.
- [ ] Record exact RED/GREEN commands, SHAs, run IDs, test counts and review corrections.
- [ ] Publish a PR against the implementation branch; leave shared branches untouched.
- [ ] Document API examples, limitations and the remaining dependency queue. Do not claim all roster/career simulation complete.

## Execution rulings

- Native workspace creation failed on an existing oversized visual artifact; container GitHub DNS is unavailable. Use a dedicated exact-SHA GitHub branch, atomic commits and the configured repository-specific self-hosted runner. Do not delete or alter visual assets to fit a workspace.
- Exact-base `P0 Core` run `35654541121` / #1483 succeeded.
- Review is inline; no independent subagent reviewer is available.