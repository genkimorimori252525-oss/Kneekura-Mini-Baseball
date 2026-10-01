# Actual batted-ball flight persistence Implementation Plan

> Use superpowers:executing-plans inline, TDD and one fresh readonly branch review.

Goal: connect the existing Core contact/flight physics to an original Native physical pitch and actual batter, retaining flight evidence across restart without inventing a ruling.

Authority: latest Foundation 44b9f5de7b9d87e649f12f1af78c202f2b5ab44d confirmed32 same Match/player physics; latest Realism 4f0a60a3818926327b6bf5877ab3dec456a76530 contracts05/06/07 (unchanged from a399515). User authorizes all confirmed nonvisual execution/publication. No UI/design/merge or new production numeric defaults.

## Task 1 — accepted execution and actual flight

- Add src/host/world/SqliteBattedBallFlightStore.ts and src/host/world/SqliteBattedBallFlightStore.test.ts.
- Accepted Source contains sourceId/sourceVersion/physicalPitchSourceId/previousFlightSourceId (null for the initial flight), searchDurationTicks and explicit execution (venueId, availableAtDay, field, full BallFlightParameters including rolling deceleration). No contact, player, timeline, fair/foul, safe/out, score or outcome supplied by caller.
- Require original replayed final physical progress to have a pending BatBallContact and actual batter actor. Own SQLite validates complete actual action/history and parameter evidence; peer getter must agree. Venue must be the actual official fixture and execution must be available by actual gameDay. Require microsecond scale and the same actual ball radius. Validate finite fields and explicit rolling deceleration rather than falling back to defaults.
- Core derives contact flight and first-ground territory. Save original physical pitch/proof, execution and derived flight in canonical immutable Source/result rows with SQL mirrors/hashes. One ordered chain per physical contact: extensions reference the actual previous accepted flight, keep the original execution fixed and strictly increase the search horizon. Historical read replays only its original prefix and survives later legitimate flight/current heads without needing live authority. Do not forbid extending an initially airborne flight.
- A flight's predicted ground contact is a trajectory candidate, not permission to bypass earlier fielder/wall contacts. Preserve the pending timeline; do not append a canonical ground event or mutate Match/count/official/scoring/workload here. The next confirmed contact owner will consume flight and select the earliest actual contact.
- RED actual Native swing-contact/reopen and required actor/noncontact/mismatched/unknown Source; then implementation GREEN.

## Task 2 — ownership, retries and real WAL races

- Reject changed accepted Source, duplicate contact aliases, caller-derived fields, radius/time/venue/scope/availability mismatch, current Match/workload changes on fresh acceptance.
- Before and after transaction rederive original physical prefix and actor on the writer's own connection. Late Source/fixture/Person mutation rolls back execution and result; stale peer physical result cannot bless changed action hashes. Source/result/raw mirrors independently checked.
- Real disk WAL tests cover changed prefix before capture, during peer read and AFTER INSERT, offline reopen, changed original archives and later legitimate recovery preservation. No directory deletion.

## Task 3 — integration and publication

- Actual accepted physical swing -> durable flight -> reopened original contact/actor/flight. Short search remains airborne; extended flight derives ground candidate without caller fair/foul. Pending physical play cannot accept another pitch. No synthetic result or ground-event shortcut.
- One fresh readonly review, fix meaningful findings RED/GREEN, focused/typecheck and final npm run verify. Status records distinguish original physical evidence from future actual touch/adjudication integration.
- Normal commit/push/stacked PR on physical actor PR242; attempt app attachment once and dispatch exact-SHA P0. Continue actual contact/ground-ball/running closure and other confirmed goal work.

## Review focus

1. Peer callback changes own original evidence before acceptance.
2. AFTER INSERT changes fixture/actor/physical archive and must roll back.
3. Historical read compares original proof rather than current mutable workload.
4. Missing actor or duplicate Source cannot rebind contact to another player.
5. Ball flight forecasts must not become canonical ground/foul/catch evidence before earliest-contact resolution.
