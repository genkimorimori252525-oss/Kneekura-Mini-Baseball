# Moving occupied runners: rule and official endpoint connections

The caught action stays operative while an original runner is between bases. Its independently accepted batter OUT and original bases remain immutable. Final runner rights are derived later from the authenticated original Match, all four exact base-contact histories, original hold identities, first-fielder touch and any actually executed appeals.

A new optional `same_pa_occupied_fair_catch_runner_evidence_v1` sidecar feeds the existing fair-catch rule, PlayEnd, scoring and reserved review paths. Its `same_pa_occupied_fair_catch_runner_outcome_v1` result contains the complete `FinalRunnerLedger`. The former empty-base and stationary third-out archive shapes remain unchanged. The new rule-consumption applicability is `original_fair_catch_with_composed_runner_rights_v1`.

## Concrete rule sources

- `docs/game-design/06-world-first-runtime-contracts.md` sections 6–8 require physical touches to remain separate from awards, rule-supported base claims, unique occupancy and a complete final runner ledger.
- `BallWorldBattedRuleChronology` and `BallWorldFieldTerritory` establish the fair catch and batter retirement.
- Original Match occupancy plus `BallWorldTagUpCompliance` supply original entitlement and exact lawful release or retouch. `FairCatchRunnerOutcome` composes an uncontested original-base return or a complete forward sequence ending at a currently contacted base. Home requires every intervening base and compliant tag-up. This bounded composition supplies no award or general reverse-retouch rule.
- `BallWorldBaseContactPhysicalAdapter` validates complete contact/departure histories. Last/farthest touch, raw home contact and evidence-array order never independently supply a claim.
- `interpretOriginalLiveAppealRights` independently rederives eligibility from the actual execution, exact original compliance prefix, live-ball/window facts and forfeitures. The Native adapter reads each receipt's earlier immutable execution view. Later retouch cannot erase an already sustained original OUT; later Play cannot repair missing earlier live-ball evidence.
- `ThirdOutScoring`, `AppealOutScoring` and `RunnerPrecedence` supply caught-third-out and actual appeal consequences. `OfficialScoring` rederives the complete outcome and requires the closed official delta to match.

## End and official ownership

Moving controller history remains in the original census. PlayEnd additionally requires the actual replacement adoption, exact original command/latest-motion/response consumption references, each actor's stopped-body and producer proofs, completed information delivery, and the original retained quantizer seal. A newly pending controller generation invalidates the candidate. Appeal physical sources remain registered. Changed ball histories additionally require complete playable-region coverage, current live-ball evidence and classified appeal throws.

If final runner rights change the earlier correct snapshot, official opening records a newer correct snapshot without replacing the original caught call. Its stable identity derives from the original action and complete evidence. Only an explicitly accepted existing review decision can replace the call. The reserved review seed carries the complete versioned evidence, rederives the result and permits only its matching current snapshot; a naked placement payload is never accepted. The existing lifecycle outcome and official scoring consume this same sidecar.

Actual appeal execution and legal rights contribute to pre-end rule composition. The accepted post-play event `accept_live_appeal_result` supplies the separate official judgment. Its official intent names every original execution, the original caught call, assigned opportunity, and current snapshot/revision. It accepts only the complete authenticated rule result; arbitrary erroneous appeal judgments are outside this bounded input. The existing Native official-authority admission authenticates the assigned requester/reviewer and the session's game, play, physical pitch, policy and fixture side.

Acceptance requires all original attempts to have been imported and their exact rights admitted. Their attempt, compliance prefix, clock, execution identity, legal evidence and resulting disposition must match the complete immutable seed. An unused, timely assigned opportunity and a fresh accepted official intent are required. The reducer rederives and records the newer correct snapshot after rights admission, then invokes Core's existing `recordOnFieldCall` at the journal cursor and resolves that opportunity. The actual import and rights chronology, original caught call and earlier snapshot remain unchanged. Missing acceptance retains `original_live_appeal_official_judgment_required`; missing physical/legal prerequisites cannot be cured by the acceptance. No caller supplies a timestamp, contact, entitlement result or raw gameplay replacement.

Readiness follows the most recent actual on-field call, and existing official closure, Match application and scoring consume its result. Pure author cases exercise both sustained OUT and no-violation outcomes through import, rights, acceptance, closure and application. No new umpire model or generated call is introduced.

## Explicit unresolved evidence

Missing intermediate touch; unmet tag-up/retouch; unsupported reverse entitlement; surviving runner between bases; conflicting contacts, occupancy or precedence; unresolved appeal rights; simultaneous or unsupported appeal ordering/scoring; and extra OUTs requiring fourth-out selection remain pending. A suppressed home-attaining survivor remains pending when no supported surviving base entitlement exists. Malformed or mismatched evidence is rejected.

## Author verification and integration inventory

Light author checks only; one combined review/typecheck remains the integration owner's responsibility. No long Native fixture or home-PC CI was run.

- `SamePlateAppearanceCatchOfficial.test.ts`: 31 cases, including operative catch while runner placement is pending and explicit reserved review to advanced base or scored result; changed evidence rejection and original call preservation.
- `SamePlateAppearanceFairCatchEnd.test.ts`: 47 cases, including exact moving-command consumption, missing adoption/latest command, new-information invalidation, versioned rule/scoring handoff, and preserved archived terminal output.
- `ActualPostPlayReview.test.ts`: existing 22 cases passed after review connection.
- `ActualPostPlayLiveAppeal.test.ts`: existing 26 import/rights cases passed.
- `ActualPostPlayAppealAcceptanceAuthority.test.ts`: 69 focused parser/authority cases; old official-request shapes remain unchanged.
- `SamePlateAppearanceFieldRuleEvidence.test.ts`, `SamePlateAppearanceOccupiedRunnerTagUp.test.ts`, `SamePlateAppearanceCatchWorkStorage.test.ts`: affected projection/storage author checks.
- Related donor checks: `ActualFairCatchScoring.test.ts` (46 cases); original appeal rights/import tests (84 cases); moving received-hold/actor completion author checks documented in the corresponding donor.

Changed host paths to include in combined review: FieldRuleEvidence and its SQLite reader; RunnerAppealEvidenceFromSqlite; FairCatchRuleBasis; FairCatchEndFromSqlite; CatchOperativeRuling; CatchWorkFromSqlite; CatchOfficial; CatchReviewFromSqlite; ActualPostPlayReview, ActualPostPlayReviewState, ActualPostPlayReviewSource, ActualPostPlayReviewNativeAuthority and ActualPostPlayLiveAppealRuling. Existing CatchLifecycleOutcomeFromSqlite consumes the expanded end/seed through its existing typed path without a new writer.
