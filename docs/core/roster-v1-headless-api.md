# Roster v1 — Headless API / Integration Contract

Status: first administrative slice of frozen doc32. No UI or Presentation integration.
Design source: doc32 at `782f6b8ef2406839de5678b00040001111cd8f77`.
Public entrypoint: `src/core/world/roster/index.ts`.

## Ownership

This module stores player IDs and administrative membership only. It does not create a
Global Person, copy abilities, hold hidden development potential, choose a lineup,
heal injuries, negotiate a loan or execute a baseball game. Uniqueness is checked
within the supplied roster, not against a global Person registry that does not yet exist.

`clubRights`, `assignment`, `registrations`, and `availability` are separate fields.
Assignment kinds are semantic; any number of distinct DEVELOPMENT units can exist.
The same player can have rights at A and an agreed external assignment at B.
Registration is per competition edition, not automatically implied by contract or assignment.

## Public API

```ts
import {
  createRosterState, applyRosterChange,
  evaluateRosterParticipation, getClubRoster,
} from './src/core/world/roster';

// Construction / restore copies and freezes defined fields. No external live rules feed.
const state = createRosterState(savedRoster);

// Supplied changes are simultaneous. One bad entry rejects the entire batch.
const result = applyRosterChange(state, {
  commandId: 'promotion:42',
  causeEventId: 'baseball-decision:42',
  expectedRevision: state.revision,
  effectiveDay: 120,
  changes: [{ playerId: 'player-7', assignment: { clubId: 'club-a', unitId: 'a-first' } }],
});

// A promotion alone never activates registration or changes medical status.
const participation = evaluateRosterParticipation(result.state, {
  playerId: 'player-7', clubId: 'club-a', competitionEditionId: 'league-2026',
});
const summary = getClubRoster(result.state, 'club-a');
```

The example assumes existing validated IDs and an externally supplied savedRoster. Exact
real-league roster rules are NOT provided by this module; the tests use synthetic policies.

### Command result

Success returns `ok: true`, a complete immutable next snapshot and one
`ROSTER_CHANGED` event containing before/after revisions, command ID, cause-event ID,
and the changed players' before/after administrative records.
Failure returns `ok: false`, the exact original snapshot, and a structured `rejection`.
No partial updates, event, RNG use, asynchronous effect or state singleton is produced.
Unchanged commands return `NO_CHANGE` instead of manufacturing history.

Registration updates upsert only supplied editions and retain all other edition entries.
ACTIVE capacity counts registration entries, not healthy players or assigned units, per
club and edition. Deactivating one player and activating another is validated against the
final batch, including when the incoming player appears first in the command.

`expectedRevision` rejects stale retries. It is NOT a durable command receipt/idempotency
service: resubmitting a different command against a fresh revision is a new request.
Event IDs derive from career identity and resulting roster revision. The host must make
snapshot + event persistence transactional and use durable compare-and-swap at commit.
Two concurrent pure calculations are not two authorized database commits.

### External transaction boundary

Cross-club assignment changes and terminating an external assignment are rejected with
`EXTERNAL_TRANSACTION_REQUIRED`. Within an already-represented external destination,
local promotion/demotion is allowed and original rights remain unchanged.
Existing edition registrations retain their club identity. New edition registrations may
be added only at the assigned club, or the rights holder when unassigned. Rebinding an
edition's club requires its external transaction owner, not this local roster command.
This API does not negotiate/approve loans, transfer rights or rewrite a pinned policy.
Restoring/creating a snapshot is a trusted world-service boundary, not a public bypass
for contracts, medical clearance, migration or registration legality.

`applyFreeAgentContract` is a separate trusted transaction boundary for an unattached
player. It requires an `ACQUIRE` decision with current front-office appointment and
payroll evidence, a contract-owner acceptance cited by the club event, a replayable
club event recording the matching wage commitment and player reference, and an annual
wage schedule derived from that event. It changes only club rights. The host must
commit the club, wage schedule, roster and events atomically with revision checks.
The acceptance is supplied by the contract owner; this module does not negotiate
terms or adjudicate a league's free-agent eligibility rules.

### Query result

`evaluateRosterParticipation` returns `scope: ROSTER_ONLY`, `eligible`, ordered structured
`reasons`, and the evaluated edition profile reference. It checks assignment club/kind,
active registration, supplied eligibility evidence state, and availability/rehab policy.
An eligible roster result is necessary administrative evidence, NOT proof of every
competition/game rule, match-active selection, substitution legality or medical clearance.
The owning registration/medical services remain responsible for factual evidence.

`getClubRoster` returns distinct `rightsHeldPlayerIds` and `assignedPlayerIds`, plus
career/club identity and roster revision. It does not expose hidden skills, internal
potential or presentation decisions. A club with no stored entries returns empty lists.

## Errors / validation

Malformed construction throws `RosterValidationError` with a structured `issue`.
Malformed changes are returned as `INVALID_INPUT` with the original state.
Invalid participation queries return an ineligible result; invalid blank club-summary IDs
throw `RosterValidationError`. Invalid references never fall back to another player/unit.
Unknown command fields are rejected rather than silently treated as mutable rights/policy.

State snapshots detach/freeze nested data and preserve safe integer revision/day values.
Policies pin profile ID/version, season and competition edition. Initial seeds or changed
real-world regulations are not read while advancing an existing snapshot.
No universal active-roster count, quota, draft eligibility or professional transaction
rule is invented here. Numeric test values are explicitly NOT NPB/MLB/etc. regulations.

## Design/UI handoff — no integration performed

Future consumers can submit commands, inspect their result, query participation, and
read the separate ownership/assignment sets. Reason codes and canonical IDs are data;
localization, screen counts, buttons, notification policy, confirmation flows and visual
composition belong to the design/UI owner. No screen is required by this module.
Because the operation is pure, a caller may also evaluate a candidate batch and inspect
its rejection/next-state result without committing it. A preview must not persist its
returned event; use the same expected-revision check when the host actually commits.

## Not completed by this slice

Global Person population/generation, registration regulation evaluators, contract
negotiation and league eligibility, loan/transfer transactions, roster-building AI,
medical simulation, development,
Human Control Overlay, season scheduling, lower-tier games/statistics and database/save
migration are not implemented. All official games must eventually use the same existing
Canonical Match Core. No substitute random-results engine or growth buff is added.
