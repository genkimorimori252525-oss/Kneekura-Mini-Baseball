# Issued Manager roster selection into actual execution

This closes a determinate area 9 connection under the [original nine-area checkpoint §5](2026-10-04-nonvisual-implementation-checkpoint.md#5-残る確定済み非デザイン計画). Canonical [Manager contract §§16–17](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/blob/44b9f5de7b9d87e649f12f1af78c202f2b5ab44d/docs/game-design/49-manager-architecture-v1.md) separates an admitted legal opportunity, observed beliefs, selection and actual execution. The existing Core selection and Native roster writer already implement those rules; the missing connection was producing the execution request from their retained originals.

## Connected producer

`SqliteManagerRosterDecisionStore.executeIssued` accepts only Career/Club/decision references, trace and execution IDs, and optional explicit mood consequence evidence. It reads the issued original, uses `selectManagerControlledDecision` with its retained Manager belief and admitted candidate subset, and derives the exact selected action binding and execution request. It does not replace either the belief or legal candidate payloads with a current caller reconstruction.

The existing Native `apply` remains the writer. It rechecks the actual Club, roster, medical, control and World decision revisions, replays selection, and commits the roster event, optional mood consequence, execution receipt and World revision together. The next World decision revision is exactly the issued revision plus one, as already required by that writer. This is not elapsed time or Career date advancement. A later manual takeover or unrelated World revision makes a first execution stale; it does not rebase the issued action.

Exact retries regenerate the same request. The expected mood revision comes from the authenticated original request on completed retry, so later accepted Manager/control history does not turn the original into a new action. Different trace, scope, decision or consequence evidence under the same execution identity is rejected through the existing receipt comparison. Existing request/receipt bytes and the full-input `apply` entry point are unchanged.

`dispatchDomesticCalendarDay` exposes an explicit `roster[].managerExecution` option containing trace/execution IDs and optional mood evidence. It first issues or authenticates the requested original opportunity, then invokes the producer. Supplying both full `execution` and `managerExecution`, or foreign extra scope fields in the compact input, rejects before day effects. Omitting both retains the existing incomplete result. An interrupted execution retains its successfully issued opportunity for retry. Existing season-scope admission is unchanged.

## Lower-tier implementation and remaining prerequisites

`prepareDomesticOpeningMatch` and `bindDomesticPregameParticipantFromWorld` already form the generic opening and participant path. They do not branch on first-team labels. The latter uses the accepted edition's `RosterCompetitionProfile` and `evaluateRosterParticipation`, including profiles permitting `RESERVE`, `DEVELOPMENT` or `ACADEMY`. Creating another lower-tier Match/participation owner would duplicate these implementations.

A usable lower-tier edition still requires an accepted calendar with member Clubs and game identities, compatible current Club season/venue evidence, the edition's roster/registration policy and eligible assigned Players, explicit lineup/Person links, rule identity, physical setup, bodies and action inputs. These generic APIs do not produce those source inputs or select a lineup. The roster-only eligibility result does not claim complete Match-active or medical clearance. Full lower-tier physical game/season execution and its actual statistics remain scenario proof to establish through the shared Core, not completed evidence from this adapter.



## Remaining production boundaries

This producer executes an already issued legal opportunity. Autonomous opportunity timing, legal candidate discovery and their observed forecast values are not manufactured. The existing recruitment owner adopts accepted scouting observations, fit/market assessments, choices and terms; generating those observations, negotiations or bilateral acceptance remains separate. No numerical appraisal, audience, Star, body or WBC bootstrap defaults are introduced.

Global Career epoch/season mapping, the actor that advances time and the completion/pause rule remain pending product decisions. This work neither defines nor circumvents them.

## Bounded evidence

`ManagerRosterExecutionFromOpportunity.test.ts` exercises actual SQLite owners for admitted-subset selection, autonomous/delegated attribution, roster and World effects, rollback/retry, exact reopen after later history, manual takeover, original-belief corruption, input rejection, and accepted-day issuance/execution recovery. Existing accepted-day dispatch/admission tests retain compatibility coverage. These are lightweight author checks; consolidated review, compiler and broader qualification belong to the combined batch. No full lower-tier physical-game or season result is claimed.

Author validation at this donor: 3 files / 34 cases passed in 8.20 seconds under Node 26 with one worker; all 18 protected blobs matched. No compiler or long physical game was run.

## 統合後の結果

[統合バッチのreview・compiler・有限選択結果](2026-10-10-practice-capability-roster-batch.md#一括検証と修正範囲)を参照。author時点の途中結果は履歴として残し、最新の資格付けと区別する。
