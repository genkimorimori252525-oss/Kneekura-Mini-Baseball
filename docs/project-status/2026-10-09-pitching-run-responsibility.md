# Original pitching run responsibility and accepted earned judgments

This implements the standard-scoring responsibility remainder in the original nine-area plan. It extends the existing outcome owner; it does not replace Match truth, previous player attributions, or the original scorer archives.

## Original facts and rules

The completed Match/fixture census and contiguous accepted scoring history authenticate each original before/after state, closure, scored runner, and source owner. The four existing attribution owners supply the original pitcher and batter bindings. Supported Native pitch and same-PA owners keep one pitcher for the entire PA. Between-play pitcher changes therefore do not erase an earlier runner's liability.

A runner stint identifies game, inning/half, entry play, and player. Liability retains its original entry application/attribution even when another pitcher finishes a later play. For the supported one-out FC, original runner precedence preserves inherited liability slots across surviving runners, including a prior runner ahead of the batter. The accepted FC must name the retired prior runner, the batter must remain safe, all other actors must be conserved, and survivor precedence must agree. Other transfers remain unavailable.

Standard reference: [MLB Official Baseball Rules 2025, 9.16](https://mktg.mlbstatic.com/mlb/official-information/2025-official-baseball-rules.pdf). Sections (g) and its examples distinguish FC inheritance from a runner retired advancing on a hit. Section (b) makes an actual runner reaching on an error unearned. Other earned assessments require the scorer's errorless reconstruction; (i) permits different pitcher/team earned treatment. Section (h) requires the actual pitcher-change count for a mid-PA walk allocation.

## Production connection

`OfficialPitchingRunEvidenceFromSqlite` joins the existing final census, original scoring history and participant attribution. It retains the completed-foul owner's pending scoring input and final agreement. Missing attribution produces unavailable responsibility, never an assignment to the current pitcher. Retained attribution cannot silently lose its original census owner.

`SqliteOfficialPlayerOutcomeStore.readCompletedGamePitching({careerId,gameId})` exposes the authenticated original proof hash, each actual run/stint/liability, and explicit earned availability. Existing `aggregate` adds `pitchingResponsibility`, scoped to completed games in the player's authenticated pitching history. It follows all later runs in that game, independently of the old current-pitcher outcome filter. Unknown charges and unfinished games make the total null while preserving the known subtotal and coverage.

The existing `AcceptedOfficialScoringEvidenceAuthority` gains the optional `readAcceptedPitchingRunJudgment(sourceEventId)` seam. `applyPitchingRunJudgment` snapshots a specific accepted game assessment in `official_player_pitching_run_judgments`, inside the existing outcome owner's transaction. It binds the scorer, exact completed-original proof, actual scored runner stint, derived liability entry and original pitcher. Explicit pitcher/team earned booleans supply counterfactual judgment; they cannot override a missing or different responsible pitcher or the direct reached-on-error rule. Unassessed runs remain unavailable. One immutable assessment may be admitted per Career/game; the current contract does not revise assessments.

Read/retry/reopen uses the persisted accepted snapshot without requiring its former process. Admission authenticates exact saved bytes and fresh originals after INSERT, and checks earlier accepted assessments for the Career before commit. Trigger tampering rolls back. Original scoring/application/attribution rows and legacy aggregate fields are unchanged. There is no new scheduler or generic statistics journal. This batch does not generate counterfactual scorer decisions autonomously.

## Explicit remaining original fact work

- Genuine mid-PA substitutions require an authenticated outgoing/incoming pitcher and exact count. No existing native substitution/count owner was found. The currently supported fixed-pitcher PA contract is not an approximation of that event.
- Multiple runner retirements, unsupported FC replacement or broken precedence retain unavailable liability. They need the corresponding accepted original event facts before further deterministic rules can apply.
- Missing original participants/runner entry are not guessed. Missing earned judgments stay unavailable even when the team has no recorded errors; missed foul chances, passed balls, prolonged presence and pitcher-specific opportunities cannot be reconstructed from team totals alone.
- This does not close the other documented sacrifice, hit-value, RBI, fair-catch or physical-settlement gaps outside the accepted original contracts.

## Bounded checks

Core tests cover earlier-pitcher charges, FC reassignment to a surviving prior runner, hit/FC distinction, unknown lineage, separate pitcher/team earned judgment, direct unearned error entry, and repeated player stints. Native seam tests cover accepted sidecar persistence, authority-free reopen/retry, changed originals, and AFTER INSERT original/receipt tampering. Those seam tests explicitly substitute only the complete-original producer.

Two selected cases in `CompletedMatchPlayerOutcomes.test.ts` use real official/scoring archives, census, contiguous history and outcome owner with the existing documented physical/terminal-owner substitutions. They cover ordinary and completed-foul finals, aggregate connection and unchanged original archive bytes. They do not qualify a new physical game or National run.

The initial selected census check exposed object-key-order comparison in the new Core fold; canonical comparison fixed it. A subsequent fixture failure exposed the fixture's synthetic terminal label lacking the genuine terminal schema; its terminal-scoring original is now explicitly substituted from the same real archived row, consistent with its other lower-owner substitutions. Failed author logs are retained separately from passing receipts. Full compiler and assembled review/finite selection belong to central integration.

Final author selection: 22 tests passed across the full responsibility Core, judgment Native seam, and existing outcome-store files (5.44 s). The two selected completed-census variants passed separately (5.04 s). No full compiler or long Native gate was run by this author.
