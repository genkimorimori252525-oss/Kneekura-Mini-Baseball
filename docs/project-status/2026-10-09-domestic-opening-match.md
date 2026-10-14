# Domestic opening Match and participant connection

This is a bounded continuation of area 9 in the
[original non-design checkpoint](2026-10-04-nonvisual-implementation-checkpoint.md#5-残る確定済み非デザイン計画).
It reuses the existing schedule, fixture, Match and participation owners.

`prepareDomesticOpeningMatch` removes the caller-authored initial scoreboard.
It constructs inning 1/top, zero outs/count/score and empty bases, matching the
unplayed invariant already enforced by `SqliteOfficialInitialWorldStore`.
The registered `ruleProfileId` and opening `playId` remain explicit identities.
Invalid input or an unsupported profile is rejected before fixture writes.
The existing fixture-first Match preparation retains interruption/reopen retry,
schedule revision binding and rejection of an already advanced Match.

`bindDomesticPregameParticipantFromWorld` accepts an explicitly selected
game/Club/Player and Player–Person source reference. It obtains the actual
day, competition, side, fixture, Person and roster revision through
`createDomesticParticipationAuthority`, then calls the existing
`SqliteOfficialParticipationStore.bindPregame`. Existing eligibility checks
remain authoritative. An exact retry authenticates and returns the original
binding without substituting the current roster revision. It rejects identity
changes and does not create a played appearance or choose a lineup.

## Evidence and limits

The focused author selection covers real SQLite World, schedule, Club, roster,
fixture, Match and participant owners. The participant tests explicitly supply
the accepted Player–Person reader as a test boundary; they do not qualify a full
population or physical game. Tests cover initial state, registered rules,
schedule revisions, interrupted writes, reopen, original binding after an
official Match advance and missing or caller-replaced evidence.

The new opening cases first failed because the production connection was
absent. The eight new participation cases likewise failed at the missing
connection while three existing cases passed. After implementation, the
combined four-file selection passed 24 tests with no skips. Node 26, one worker,
a 512 MiB heap limit, disabled cache, an external cache directory and a
35-second wall cap were used. Full compiler and combined qualification remain
with the parent batch.

## Inputs that remain explicit

- Rule identity: domestic schedules currently do not bind a RuleProfile. This
  path validates the explicitly supplied registered identity; it does not apply
  NPB rules to all Leagues. Canonical Foundation document 11 §23.1 assigns
  variable rules to versioned CompetitionProfile/RuleProfile owners.
- Initial physical World: `AcceptedInitialWorldSetup` still requires the actual
  `startedAtTick`, three `baseCenters`, and nine selected defenders with their
  `playerId`, `registeredPosition` and `position`. The new participant connection
  supplies identity bindings, not these choices or coordinates. Existing
  `SqliteOfficialInitialWorldStore` consumes that accepted setup.
- Actions and bodies: the existing physical actor/pitch owners still require
  their accepted original references, bodies, action requests and policies.
  Runtime contract 06 §2.1 treats actor position/velocity as canonical physical
  truth; schedule identities do not authorize fabricated physical state.
- Next season: `SqliteDomesticSeasonAdvanceStore` already connects accepted
  Club CLOSE/OPEN commands to the next World calendar. Its required budgets,
  objectives, registration/roster/fanbase references and calendar/event policy
  are not inferred from the previous season.

These remaining inputs are not classified collectively as user design
decisions. Existing accepted sources should be connected where available;
missing policy/content must remain explicit. No roster-design expansion,
numerical model, UI, new dispatcher or replacement persistence owner is added.
