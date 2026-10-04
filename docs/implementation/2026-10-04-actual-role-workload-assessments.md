# Actual total-play workload assessments

## Approved boundary

This connects the existing accepted-input workload architecture in `docs/superpowers/plans/2026-10-01-player-workload-recovery.md` to authenticated actual live-play closure. Each independently accepted assessment states one original participant's **total MATCH effort for the entire closed play**. It is not an automatic movement, running, throwing, swing, pitching, or metabolic effort generator. No component weights, production calibration defaults, fatigue thresholds, placement recovery, or elapsed-tick recovery are introduced.

## Ownership and interfaces

- `AcceptedActualRoleWorkloadAssessment` contains Source ID/version, closure reference, exact authenticated physical-end reference, the entire original physical manifest hash/convention, original participant binding/Person hashes, finite nonnegative effort units, and explicit accepted assessment/calibration provenance
- Native derives Career/game/play/day and Player/Person/Club from `actualLivePlayClosureEvidenceFromSqlite`; caller identity replacement, result, position and readiness fields are rejected
- Missing effort or baseline is explicit pending. An independently accepted zero is a real MATCH activity, not a missing-value default
- `openSqliteActualRoleWorkloadStore(path, personLinks, authority)` exposes `acceptAssessment`, same-closure atomic `acceptAssessments`, `initializeBaseline`, `freeze`, `settle`, `readSettlement`, and `close`
- Baseline initialization and every MATCH state mutation delegate to the existing `SqlitePlayerWorkloadRecoveryStore`. Core `advancePlayerWorkloadRecovery` remains the only fatigue calculation. Recovery remains a separately accepted actual activity
- Canonical charge ownership is `(careerId, gameId, playId, playerId)`, independent of Source aliases. The legacy pitch producer and the new total-play producer exclude each other symmetrically

## Freeze and resumable application

Every original active actor must have an assessment and existing accepted workload baseline. One durable settlement plan freezes the complete assessment hashes and every exact BEFORE state, revision and policy before the first effect. These are explicitly **settlement-time** BEFORE snapshots, not a retrospective claim that current states were captured at pitch/play start.

Application uses the existing workload owner's CAS, immutable activity BEFORE/AFTER archives, historical revision selection and retries. Interrupted settlement can resume; an independently advanced unapplied player's head fails the original CAS instead of silently recapturing it. Same-connection guards validate before writes, after INSERT-trigger effects, and on retry. Historical completion verifies the original required effects without requiring that each global head remain at its old revision forever.

`actualRoleWorkloadEvidenceFromSqlite(db).readSettlement(closureSourceId)` returns pending, applying or complete. Complete means all required immutable state effects exist; it makes no medical or fatigue-threshold judgment. The official stage remains separately owned and consumes this evidence for next-physical-play admission.

## Evidence safety

Raw SQLite metadata discovery examines indexed and Source/snapshot identity mirrors, including escaped and duplicate JSON keys. Canonical serialized archives, hashes, original physical/actor references, Person linkage and current-write state are checked independently. Unrelated payload is not hydrated. Historical workload replay bounds its payload to the selected revision; later valid activities do not rewrite the archived BEFORE/AFTER.

## Verification state

Local TDD covers accepted zero versus absence, shape/provenance/reference validation, canonical aliases, complete role coverage, explicit settlement-time state capture, no implicit recovery, original Person linkage, historical prefix opacity, metadata aliases/duplicates, absent-owner behavior, real disk/WAL open/close/reopen, and symmetric legacy charge conflict/rollback. Existing legacy pitch-workload tests are included in the focused gate.

The positive original-chain all-role settlement, interrupted/stale-CAS and full transaction-corruption integration require the separately produced authenticated physical-end/official artifact. They are a scheduled integration gate, not claimed by the lightweight tests or by source availability. No automatic effort generation or production-calibration claim is made.

## Post-recovery validation note

The original text above records the pre-replacement implementation. On 2026-10-04 the recovered role source and independently reviewed charge guards were integrated with the recovered official owners and physical dependency `54d47fc8a2e94c47eff74a91a0afc43e75f97b3b`. The missing post-INSERT competing-charge regression was reconstructed and observed RED before the legacy hook, then GREEN after it. The final integrated gate passed 156 tests in 26 files and full typecheck at 1408 MiB. Synthetic recovery is isolated from the playable artifact. Original-chain workload application remains unrun after recovery; these checks do not replace that required positive gate.

## Participant transaction and constructor corrections

Independent review reproduced an activity INSERT trigger corrupting another required participant's current head while the charged participant's transaction committed. The writer now authenticates every participant's complete current chain on its SQLite connection. Unapplied participants must remain at the frozen BEFORE. Applied participants must retain the required AFTER prefix; separately accepted later activity is allowed. Each actual charge captures the complete current-head set before mutation and verifies afterward that only the charged participant changed, exactly to its expected AFTER. Final completion authenticates the whole current set in one read transaction. Historical settlement reads continue to authenticate their original frozen prefixes without depending on later current heads.

The regression covers first, second and final charge corruption, an already changed unapplied head, and even a valid-looking recovery activity injected into another participant's history during the charge transaction. Each offending transaction rolls back without discarding earlier legitimate charges. A partial settlement followed by separately accepted recovery still resumes exactly once and preserves its historical result across all-close/reopen.

A separate real-disk malformed-schema reproduction exposed handles retained when workload construction failed. The artifact helper now registers returned handles immediately, including its reopen, stale and recovery probes. Actual-role and underlying global-workload constructors close their owned connections on construction failure; the global store's state transition algebra is unchanged.

The two new regression files first reported eight failures and one passing legitimate-recovery control, then all nine passed after correction. The expanded bounded gate passed **29 files / 171 tests**, including the existing global workload store suite and prior official/role/actor tests. Full typecheck passed at 1408 MiB and the source manifest remained unchanged. Original-chain artifact execution and final independent recheck remain separate requirements.

The independent recheck confirmed the participant transaction correction and the original workload-schema cleanup, then exposed the same pre-return failure in six dependencies used by the role/next-pitch artifact helpers: Person links, pitch timing, release geometry, fatigue policy, initial world and physical-pitch progress. Each factory now closes its own SQLite connection if construction fails. A byte comparison confirms that their normal method bodies and physical-pitch fence hooks are unchanged; only the outer construction try/catch was added. Returned helper handles remain under the previously added resource tracking. The role helper's source-copy, reopen, stale and recovery paths were inspected for this ownership pattern.

Four direct/helper Person-link cases and five direct next-pitch dependency cases were observed RED before these corrections. All cleanup cases now pass using tiny real SQLite files and actual failing schema preparation. The complete adjacent gate passed **37 files / 211 tests**, including the existing Person-link and other affected owner suites, physical-pitch WAL tests, participant rollback and legitimate recovery controls. Full typecheck passed at 1408 MiB, with the frozen source manifest unchanged. The six dependency fixes are a separate follow-up commit after the participant transaction correction; no original-chain physical or artifact execution is claimed.
