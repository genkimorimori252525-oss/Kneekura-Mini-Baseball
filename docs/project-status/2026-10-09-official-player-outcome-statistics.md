# Original official player outcome attribution

This implements the mechanical individual-statistics connection from the
approved original non-design scope. It uses the existing official classifications
and original actor owners; it does not import the validation statistics bridge.

## Connected production owners

`SqliteOfficialPlayerOutcomeStore.apply` accepts an existing closure/transition
owner and Source ID. Its private Native connection reconstructs the original
completed physical closure, completed foul terminal, owned actual-live scorer,
or completed and released same-PA terminal. The last path includes the existing
owned fair-catch scoring contract. No participation receipt or later lineup is
used to infer a plate appearance.

Each admitted record binds the original batter and pitcher, Player/Person links,
Career, competition edition, game, day, fixture, official application/revision,
scoring record and original proof hash. Domestic and National membership retain
their original identities. Legacy physical evidence without an owned batter
returns `original_batter_missing`. An actual-live closure without a supported
owned scoring record returns `supported_official_scoring_missing`. Neither result
creates an attribution or an implied zero outcome.

There is one attribution per Career/game/play, independent of caller Source
aliases and closure format. This is retrospective attribution of a completed
official play, so a later Match or eligibility state does not prevent replay of
the original historical proof. Exact retry preserves the original receipt.

The store rechecks every admitted record in the requested competition edition
and its durable history anchor on read, retry and aggregation. Before committing
a new record, it rechecks the new and earlier owners after INSERT and after the
anchor update. Ordinary SQLite rollback retains the previous record and head if
either proof changes. Reopening needs no live authority callbacks.

## Available aggregation and coverage

The additive standard-scoring connection and remaining original source gaps are now documented in [`2026-10-09-standard-player-scoring-facts.md`](2026-10-09-standard-player-scoring-facts.md). The counts-only boundary below describes the initial batch; legacy stored records retain that shape.

`aggregateOfficialPlayerOutcomes` groups eight supported official classes:
base on balls, strikeout, foul out, fly out, ground out, base hit, reached on error and
fielder's choice. Batter and pitcher tallies are separate. The result includes
an as-of day, original attribution/game IDs and the explicit coverage value
`attributed_supported_plays_only`.

These are exact counts of admitted supported outcomes. They do not claim complete
season coverage or supply AB, RBI, earned runs, innings, putouts/assists, wins,
single/double/triple/home-run awards or batting/pitching rates. Those require the
corresponding original scoring/responsibility facts and supported rule paths.
Team runs and errors do not determine individual RBI, pitcher liability or a
charged fielder. Standard AB, RBI and innings semantics remain scoring-rule
implementation and original attribution-fact gaps, not a requested product
calibration decision.

The existing actual-live scorer now accepts an additive `owned_ground_out`
request. Its private connection authenticates the original closure and sealed
physical history, reconstructs first-base contact/control histories through the
final end, and retains any owned possession and playable-wall qualifiers. The
shared Core classifier requires fair grounded physical OUT before first base,
empty original/final bases, no runs and exactly one final official retirement.
It preserves the accepted final ruling ID, including the selected review layer;
an official SAFE cannot be replaced by the physical OUT. Physical SAFE, exact
ties, unresolved control, runners on base, generic fair OUT and other scoring
paths remain outside this bridge. No H/E/FC judgment is fabricated.

The scorer freezes the derived sidecar in its existing archive. New requests
carry original identities only, never caller-authored histories. Legacy scorer
requests and closure receipts retain their original formats. Retry, reopen and
the existing post-INSERT ownership guard rederive the original proof. Both
next-batter activation and later scoring history use the same evidence dispatch.

Star still requires its accepted prominence/recognition and other scored
dimensions; popularity requires its accepted audience observation; measured
traits require their own measured evidence. No approved formula converts these
new factual counts into those values, so this connection does not manufacture one.

## Verification boundary

Core tests cover deterministic grouping, scope/date filters and duplicate or
invalid input. Small Native store tests explicitly substitute the lower
attribution producer while checking original-proof revalidation, exact retry,
reopen, history deletion and INSERT/head-trigger rollback. Producer dispatch
tests explicitly substitute lower original owners and do not qualify physics.

The initial bounded author selection passed 52 cases in 5.99 seconds. Source
review then corrected the foul proposal's oracle-versus-assigned ruling
distinction and two missing-history checks. The affected producer/store selection
passed all 19 cases in 5.68 seconds after those changes. Both selections used one
worker, a 512 MiB Node heap limit, disabled test cache and an external 35-second
wall cap; neither reached the cap and neither left a surviving process group.
The 34 unchanged Core cases plus the final 19 affected cases comprise 53 distinct
author cases. These small checks do not replace the central compiler or genuine
physical composition.

The existing unrun `NAT-N01` composition additionally consumes the genuine foul
receipt's original terminal into this owner, verifies that the second actual-live
play is unavailable before scoring, admits its original ground-out sidecar, and
checks batter/pitcher aggregation and exact scoring/attribution retry after close
and reopen. It reuses the same National game and original inputs. Its genuine run
and the full compiler remain assigned to the consolidated verification batch.

For the ground-out addition, the initial mixed author selection reached its
35-second external cap without case results or a JSON report and is unqualified.
After replacing a circular asynchronous test mock, the small admission/archive
selection passed four cases in 6.75 seconds; 61 Core cases passed separately in
1.32 seconds. Both successful processes ended without surviving workers and used
explicit `--no-cache`, external cache directories and a 512 MiB heap limit.
The final review-SAFE, prior-live ancestry and surviving scorer-claim regressions,
plus the shared ownership-discovery correction, are authored for central
verification and have not been separately executed. No genuine game or full
compiler was run for this addition by its author.
