# Accepted domestic postseason preparation

This continues original area 9 in the [nine-area checkpoint](2026-10-04-nonvisual-implementation-checkpoint.md#5-残る確定済み非デザイン計画).
The existing domestic championship projections could consume series plans and
completed Match results, but no production owner retained those plans before
play or prepared their fixtures.

`SqliteDomesticCompetitionSeasonStore` now accepts an explicit postseason plan
prefix with Source ID/version, expected revision, the existing competition
request, and one accepted day per planned game. The additive archive checks
CAS, preserves the original policy/alignment/series/day prefix, and authenticates
the completed regular season on admission and historical reads. A later stage
must be legal under the existing Direct, Conference or North America resolver.
Winter also uses its existing twelve-game round and two-club tiebreak rules;
the pre-result checks were extracted from those Core functions without changing
result adjudication.

`preparePostseasonMatch` uses the earliest saved plan containing the game,
accepted Club journal history at its explicit day, the home Club stadium, and
ordinary fixture registration/Match initialization. It constructs the established
unplayed state from explicit registered rules and play identity. A series may
prepare only its next required game, and cannot prepare another after a clinch.
The existing fixture-first retry permits reopening after interrupted Match
creation. The plan remains frozen if a later write is interrupted.

`readPostseasonGame` supplies the optional postseason branch of the existing
domestic participant authority. It resolves game/day/side/venue identities for
an explicitly selected roster member and Person link; it does not select a
lineup. Championship finalization reuses the same original plan and authenticates
it after the title write. Deleting the accepted archive cannot downgrade its
tagged Match fixtures to the legacy finalization path. Ordinary legacy title
requests retain their original serialized bytes.

The accepted days must fall after the completed regular season and inside its
archived POSTSEASON window, avoid other reserved competition windows, and retain
the supplied series order without simultaneous Club games. Canonical Foundation
[13 §17](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/blob/44b9f5de7b9d87e649f12f1af78c202f2b5ab44d/docs/game-design/13-domestic-league-championships.md)
delegates exact postseason dates and home-game patterns to calibration. This
connection accepts those values; it does not choose them. Canonical
[14 §§14.4–15](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/blob/44b9f5de7b9d87e649f12f1af78c202f2b5ab44d/docs/game-design/14-regular-season-calendar-and-volume.md)
requires retained calendar provenance.

## Bounded verification and remaining inputs

The focused tests exercise real Native plan, Club journal, fixture and Match
writes for all four domestic paths, interruption/reopen, stale revisions, changed
origin/date rejection, next-game/clinch behavior, Conference stage extension,
participant game lookup, and rollback of source/title INSERT mutations. The
completed regular-season and advancing postseason result readers in the new
host test are explicitly structural seams. This is not a full physical game or
season simulation, and does not replace consolidated compilation/review.

The first new host run failed at the absent API for all four formats. The first
North America run exposed the existing inert serializer's size limit when a
whole completed season was hashed at once. The correction hashes the already
validated component records separately; it does not relax the serializer limit.
The title-source deletion test first demonstrated a missing post-INSERT read;
finalization now rereads the saved bytes and original plan before commit.

Physical initial setup, bodies, action decisions, rules selection, exact dates,
and the next-season accepted policies remain explicit. Lower-tier calendar
calibration and autonomous candidate/negotiation/payroll producers are not
supplied by this connection. Existing Match result, statistics, economy and
season-boundary owners remain authoritative.

Final author selection: **43 tests across nine files passed**, no skips, in
14.03 seconds under Node 26, one worker, a 512 MiB heap, `--no-cache`, an external
cache directory and a 35-second wall cap. The selection was
`DomesticPostseasonPreparation`, `SqliteDomesticCompetitionSeasonStore`,
`SqliteOfficialParticipationAuthority`, all four existing domestic projection
files, `WinterChampionship` and `OfficialStandings`. Syntax-only transpilation of
the five host files and `git diff --check` passed. All eighteen protected blobs
match their retained manifest. No full compiler, heavy Native scenario or
whole-suite claim is made here.
