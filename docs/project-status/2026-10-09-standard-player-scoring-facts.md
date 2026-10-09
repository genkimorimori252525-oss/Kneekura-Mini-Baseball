# Standard player scoring facts — 2026-10-09

This extends the original area 9 statistics connection described in `2026-10-09-official-player-outcome-statistics.md`. It does not complete the whole scoring area.

## Defined rule and source connection

The established descriptive scoring boundary is `docs/game-design/07-world-first-adjudication-contracts.md` §§1.5 and 10. Standard semantics were checked against the [MLB Official Baseball Rules, 2025 edition](https://mktg.mlbstatic.com/mlb/official-information/2025-official-baseball-rules.pdf), rules 9.02(a)(1), 9.02(c)(1), 9.04, 9.06 and 9.08. Walks do not count as AB. Sacrifices require their scoring conditions; a hit or error alone does not resolve them. A forced run on the supported bases-loaded walk supplies an RBI. Pitching innings use one third per recorded out. Hit value is an explicit scoring award, not a conversion from the batter's final base. Scoring runs alone does not establish every RBI or earned-run assignment.

`OfficialPlayerScoringStatistics.ts` derives AB, narrowly defined RBI and pitching outs from the original accepted scoring record, pre-play match and official closure. The original outs delta remains correct across an inning ending. Known no-run plays contribute zero RBI because the original result establishes it. Ambiguous sacrifice and scoring-run judgments remain unavailable.

The existing safe-batter H/E/FC scorer Source now supports schema version 2. It carries explicit credited `rbiRunnerIds`, credited `hitBases` for a hit, and an optional explicit `sacrifice` judgment. RBI identities must be unique official scored runners. A four-base award requires the batter to have scored. Sacrifice judgments require fewer than two outs and the supported original runner/advance/run facts. The safe-batter contract covers reached-on-error and the distinct unsuccessful-FC branch described below. A `none` judgment is explicit scorer input. This extension does not derive scorer choices from incomplete physical evidence.

`ActualLiveScoringSource` admits these fields through the existing accepted Source, archive and original-closure checks. `OfficialScoring` preserves the versioned awards in the new scoring result. Version 1 requests and results do not gain fields or change bytes.

## Existing attribution and aggregate

`OfficialPlayerScoringEvidenceFromSqlite` reads the authenticated original application through the existing scoring writer. Completed foul terminals use their dedicated original pending-input scoring owner. They are never relabeled as ordinary final applications.

`SqliteOfficialPlayerOutcomeStore.aggregate` first reauthenticates the existing complete edition history on its private Native transaction, then adds a `scoring` result. Existing count fields remain intact. The additive result includes AB, RBI, singles, doubles, triples, home runs, total bases, pitching outs, and `{ completeInnings, remainderOuts }`.

An incomplete batting statistic has `value: null`, a labeled `knownSubtotal`, and explicit unavailable attribution IDs/reasons. Missing hit awards are not singles by default. Coverage stays `attributed_supported_plays_only`; neither a partial game census nor these metrics imply a complete season. Attribution rows, proof hashes, history anchors, and their write/retry/reopen behavior are unchanged. Reads do not rewrite old rows or add a statistics journal.

## Connected unsuccessful choices and caught-foul judgments

Schema version 2 now distinguishes `attemptedPriorRunnerId` from the preserved `retiredPriorRunnerId` FC shape. The unsuccessful branch requires the identified original runner to advance, the batter to remain safe, and no official retirement. Its accepted sacrifice-bunt judgment supplies the standard scorer determination; it is not inferred from the final base positions. A retired-runner FC cannot silently become that branch, and version 1 cannot admit it.

`OfficialCaughtFoulScoringEvidence` supplies explicit catcher identity/role and sacrifice/RBI judgments for the already supported caught-foul result. It binds the original contact and catch event, batter, closed ruling and exact officially scored runner IDs. The actual-live scoring owner additionally checks original defensive participation when that owner supplies the closure. The catcher role/location category remains an accepted scorer judgment, not manufactured physical location evidence. Generic scorer archive replay and the original player-scoring adapter consume the same dispatch after close/reopen; no catch or runner motion is created.

## Remaining original code/fact work

- The owned fair-catch bridge still proves stationary original runners and no runs. A moving/scoring fair catch requires its original motion, tag-up and settlement evidence before this scoring layer can consume that result. The new caught-foul judgment does not broaden the physical owner or claim that a genuine moving-catch Native composition has run.
- Existing version 1 records retain missing judgments and hit values. New accepted Sources can carry the defined explicit awards; old scoring/attribution rows are not rewritten. Partial metrics remain explicit when no judgment was recorded.
- The existing contiguous game/scoring history can support a restricted ordinary runner-entry/scoring lineage fold, but it does not yet supply a general runner-liability transition. General pitcher responsibility needs an authenticated runner stint (game, inning/half, entry play and runner), origin/transfer reference, and responsible original pitcher. Retired-runner FC evidence alone is not a complete liability-transfer owner, and no production pitcher-substitution/liability record was found in the bounded check.
- Runs allowed and earned runs require separate availability. Earned status needs an explicit accepted scorer judgment bound to original responsibility or a supported errorless-inning reconstruction. The aggregate currently selects batter/current-pitcher plays; former-pitcher run charges must also have their own responsible-pitcher selection. Team runs, errors or a current pitcher ID do not fill these missing facts.
- These remain scoring source and implementation work within the original scope, not user calibration choices. No Star, appraisal, physiology or practice-learning formula was introduced.

## Bounded author checks

The first Core/Native-owner selection passed 21 cases. After the explicit award extension, 28 cases passed across `OfficialPlayerScoringStatistics.test.ts`, `OfficialScoring.test.ts` and `SqliteOfficialPlayerOutcomeStore.test.ts` in 6.47 seconds. The final affected Core selection, including explicit sacrifice handling, passed 18 cases in 887 ms.

The final selected `ActualLiveScoringAdmission.test.ts` case passed in 7.71 seconds after closing the scorer owner and reopening without its authority callback. Together with the 18 final Core cases and 11 Native outcome-owner cases, this covers 30 distinct focused cases. The selected case exercises versioned awards, immutable closure bytes, accepted archive replay and the read adapter with real Native scoring/application owners. Its physical readers and original player attribution are explicitly substituted. The outcome store tests substitute lower evidence producers while exercising Native history, read transactions, aggregate output and byte preservation. No genuine National/whole-game qualification, full compiler or long Native gate is claimed; assembled review and verification remain central.


The follow-on Source/dispatch selection passed 22 cases across `OfficialScorerJudgmentExtensions.test.ts`, `OfficialPlayerScoringStatistics.test.ts` and `OfficialScoring.test.ts` in 5.45 seconds. The four new cases use real Native official/scoring archives with explicit closed Core fixtures and substituted player attribution. They cover unsuccessful FC sacrifice, caught-foul sacrifice/RBI, exact retry/reopen without callbacks, unchanged official rows and rejection of mismatched original runner/catch/award facts. They do not qualify autonomous physical catch generation.
