# Initial official World and first-play workload Implementation Plan

**Goal:** Extend actual official action/workload causality to the initially prepared play, where no previous closure/activation exists. Preserve the existing activation/closure path and official state/appearance APIs.

**Authority:** Latest confirmed nonvisual foundation14/32/53/55 and existing canonical between-play World / Native official fixture / participation / scoring owners. User-authorized all remaining implementation, no design or merge. Independent explicit accepted lineup/field setup is required; do not fabricate production lineup decisions, coordinates, Players or Persons.

**Architecture:** New Native initial World Source owner accepts independently accepted pregame field setup, reads the actual initialized official Match at durableRevision0, binds all nine defender actors to actual accepted pregame Player/Person/game facts and derives the canonical World through existing prepareBetweenPlayWorld. It freezes initial match, fixture, source/version, all bindings, derived World and digest in one transaction. Reopen/read/retry validates these original facts without live lineup authority and does not replace the advanced Match head.

Existing Native participation gains a read-only accepted pregame binding reader, sharing the current accepted game/Person scope validator. History reads do not re-check later availability/registration, which may legitimately change after the binding was accepted. All original pregames remain immutable and actual fixture/person facts must still match.

**Files/interfaces:** `SqliteOfficialParticipationStore.readPregameBinding(gameId,playerId)` returns the detached accepted binding or null after scope validation. New `SqliteOfficialInitialWorldStore.accept(sourceId)` / `readAcceptedSource(sourceId)` / `readInitialPitcherPlay(sourceId,closureApplicationId)` archive and validate the accepted Source and initial actor/closure proof. Accepted field Source `{sourceId,sourceVersion,gameId,fixtureEventId,startedAtTick,worldSetup}` is supplied by an independent authority. Persist original MatchState, nine bindings and canonical World with the original accepted Source digest, one Source per game. First-play proof requires actual scoring input MatchState and tick equality, actual closure expectedRevision0/receiptRevision1 and exactly one initial P binding.

Fresh pregame state must be actual durableRevision0, inning1/top, zero outs/count/score and empty bases. No arbitrary already-played/resume state is promoted to pregame. Keep an own-transaction final guard against the original Match/fixture/all binding rows, so late changes in the same SQLite transaction cannot escape through another connection's committed snapshot. Valid historical retry after Match advance must still return the original setup without moving the Match head back.

Official pitch workload request adds a compatible exclusive alternative initialWorldSourceId to the existing activationApplicationId reference. Initial branch requires accepted scored Native closure at expectedDurableRevision0, full initial MatchState equality, actual derived unique P actor, pinned initial timeline start and accepted game/Person binding. Existing branch keeps its request/proof/Source identity semantics. Both use actual physical events and the same explicit effort policy/global workload owner; mere pregame presence never charges fatigue.

## Tasks

1. Missing read-binding / Native initial World APIs RED with real Native fixture and nine registered roster Players/Persons. All body, field coordinates, lineup choices and calibration are explicit synthetic facts, not production defaults.
2. Implement readonly binding and frozen initial Source owner. Reject missing fixture/person/registration, wrong side/game, incomplete/duplicate/non-P lineup, advanced Match acceptance, changed accepted Source/version; original retry after advance/reopen remains stable. Late Source/Match/binding tampering or SQLite failure rolls back acceptance.
3. Missing first-play Source branch RED. Initial actual World -> first physical Core pitches -> actual Native official closure/scoring -> generated MATCH activity -> actual global workload. Same first play cannot be charged twice through another identity/calibration. Initial branch proves exact initial Match state, tick and P scope. Later activation branch remains compatible.
4. Historical Source read after later Match/workload/recovery/reopen, malformed/corrupt/future/mismatched evidence and rollback regressions. Focused/typecheck, one fresh readonly review and corrective RED, whole verify, status/limits, commit/push stacked on PR237 and exact-SHA P0.

## Boundaries

This supplies initial actor evidence; autonomous Manager lineup choice, production setup/physical content, within-play effort charging and full Career/Match orchestration remain later active dependencies. No artificial activation receipt is created at revision0, no original Match/Person/skill history is rewritten, no configuration/lock/migration changes or design connection.
