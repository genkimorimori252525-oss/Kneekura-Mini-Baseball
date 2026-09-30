# National competition persistence — 2026-09-30

Canonical approved design: `origin/jolly/core-foundation-plan-2026-09-17`
at `560670be519a01f07e2e4b7dd12a1ca3821c88a4`, documents 11 and 12.
This records implementation evidence, not approval of another design.

## Implemented sources

- Regional national groups and knockout results feed persistent national
  qualification history and world national ranking history.
- Regional national selections now assign one Edition to each region's frozen
  World reservation and share the career calendar origin with WBC/Premier12.
  The existing selection table retains its old WBC/Premier12 keys and records
  region-specific keys for these additional reservations. Connected regional
  groups reject a different region or window. Durable schedules pin the full
  World selection, group Edition/plan and knockout Edition, including before
  knockout entrants qualify. Three circle rounds fit group games without a
  nation playing twice per day, followed by the applicable QF/SF/final slots.
  Exact scheduled fixtures follow official preceding-stage qualification.
- WBC qualifier selection consumes saved direct berths and a saved ranking.
  Four qualifier pods consume venue-bound official Match finals. Their winners
  feed qualification history and the final 20 + 4 berth allocation.
- World WBC qualification now derives the direct-slot input from the target
  World selection, its two immediately preceding WBC cycle assignments and
  the current cycle's four accepted regional placement sources. It checks
  official completion against those World windows, initializes the existing
  coefficient/direct stores, and pins all World/history/policy sources in its
  own durable snapshot. Replay validates both the saved components and full
  World source identity, including a source change with the same game IDs.
  The predecessor query excludes current/future cycles before replay, so
  later result sources cannot become dependencies of their own qualification.
  Missing predecessor cycles/history are rejected; no bootstrap results or
  direct berths are fabricated. Career-scoped cutoff callbacks preserve
  existing direct-store callers while supporting the composed owner.
- WBC Global Qualifier now persists all twelve semifinal/final schedule slots
  from its accepted Edition and pod plan. Explicit venue capacity and off-day
  policy fit those slots within the Edition window; shared venues consume
  shared capacity. Final slots reserve capacity before the winners qualify.
  World fixture registration pins the complete schedule source digest and
  actual qualified participants before Match initialization, and rejects a
  different accepted Edition even when slot IDs and venues are identical.
- WBC finals use six pools, round of 16, quarterfinals, semifinals and final.
  The 51 results feed official WBC history and national ranking history.
- Premier12 groups consume the saved ranking at the qualification cutoff.
  Two groups of six produce 30 games; the top two from each group advance
  to cross-group semifinals, a bronze game and a final. All 34 results feed
  national ranking history and later ranking snapshots.
- National selection snapshots bind one WBC/Premier12 edition per frozen World
  reservation to its actual calendar window and cutoff. They pin the career
  calendar origin, including leap-year conversion. The Premier12 integration
  consumes this real SQLite authority and rejects any different cutoff day
  even when a valid ranking for that alternative day exists.
- A historical WBC edition read replays that edition's source. Coefficient
  reads and cutoff authority replay only the requested/eligible sources,
  preventing later WBC qualification from recursively becoming a dependency
  of its own earlier coefficient inputs.
- A ranking snapshot replays official history through its own cutoff.
  Later tournaments cannot become dependencies of their earlier selection
  rankings. Premier12 validates the cutoff before reading that ranking and
  requires it to precede the tournament window.
- Premier12 fixtures are registered from the saved Edition and currently
  qualified group/semifinal/medal games, before Match initialization. The
  fixture pins venue, day, participants and historical versions. Unknown,
  premature, out-of-window and differently pinned fixtures are rejected.
- Premier12 saves all 34 game slots from its accepted group draw and World
  window, including semifinal/medal slots before their participants qualify.
  Circle rounds enforce one group game per nation per day. Versioned capacity
  and round off-day inputs govern the allocation; an insufficient window
  fails rather than dropping games. Fixture registration requires the exact
  saved day and venue. Complete Edition/plan snapshots pin source identity;
  replay rejects even a different accepted draw/hosting version or participant
  allocation that would otherwise produce identical game slots.
- WBC finals save all 51 slots from six pool hosts and the accepted US
  knockout hubs/final-four venue before later participants qualify. The
  frozen World selection supplies the tournament window and berth cutoff.
  Scheduled fixtures require the exact day/venue and actual prior-round
  qualification; a different accepted knockout Edition is rejected even
  when its game slots are identical.
- National draws consume the accepted World selection, its actual cutoff
  ranking and historical nation regions. Premier12 selects the ranking top
  twelve; WBC seeds the accepted 24 berths. Ranked pots, recent official
  rematch history and registered soft-constraint priorities generate the
  groups. Saved snapshots pin all inputs and policy/seed; the complete
  policy, including the explicit rematch lookback, is immutable per career
  version. Connected group stores reject different draws or WBC draw-policy
  versions. Ranking/region inputs never change player ability or affiliation.
- National Edition assembly now consumes that accepted draw and a cutoff
  host-candidate snapshot. WBC selects six distinct US pool cities, two to
  four US knockout hubs and one US final city; Premier12 selects two distinct
  group cities and a medal city within their one or two host nations.
  Feasibility checks preserve later city slots and the medal host while
  retaining the existing per-slot suitability/rotation score ordering.
  The durable owner generates group/knockout identities and freezes the
  complete draw, candidate source, host evaluations and versioned rules.
  Connected group/knockout stores reject different Edition metadata.
- World hosting infrastructure now records licensed/safe venue facts,
  transport/accommodation/broadcast/operations metrics and historical nation
  regions. Chained events preserve each cutoff; later facilities and unrelated
  corrupt future infrastructure do not reinterpret a historical snapshot.
  Club-owned stadium quality/capacity derive from accepted Club history at the
  cutoff, rather than a second independent copy. Venue/city/nation consistency
  is checked. A chained source digest pins the accepted Club checkpoint and
  eligible event prefix even when different histories produce identical venue
  attributes. Public venues require no full domestic league.
- The organizer persists versioned eligibility thresholds, suitability weights
  and recent city/nation/region hosting penalties. Actual completed official
  national history and accepted predecessor Editions supply hosting evidence.
  Strictly earlier predecessor cutoffs are checked before following Edition
  sources, including rejection of self references. Candidate snapshots pin all
  facility/history/selection inputs and policy parameters for replay.

## Verification boundaries

The Premier12 integration test connects real SQLite World cycle, national
selection, regional, ranking, draw, national Edition, group, final-four,
Match and history stores.
It covers partial-round restarts, missing finals, repeated application,
reopened stores, cutoff drift, fixture mismatch and saved outcome corruption.
All 49 games (15 regional + 34 Premier12) begin at zero score and play through
nine innings, adopting 60 durable plate appearances per game. Walks and
strikeouts drive actual rule transitions, between-play resets and official
game finalization. Count outcomes and defender identities are scripted test
inputs; physical pitch/ball trajectories and production rosters are not
executed by this test. Premier12 fixtures now consume the saved competition
schedule in chronological group order, including after database reopening.
The scheduling parameters in tests are explicit fixtures, not calibrated
production policy. Career clock advancement and physical travel/recovery
are not executed by this integration.

WBC's integration additionally plays 51 actual nine-inning Match games and
feeds persistent official WBC history, national ranking history and a ranking
snapshot. It reopens after 35/36 group games and 7/8 round-of-16 games, and
checks missing quarterfinal/semifinal/final results before advancement.
Qualification allocation and host/draw inputs remain test fixtures in this
integration; the complete regional/direct/qualifier source lifecycle is a
separate remaining connection.

The isolated WBC draw test uses accepted ranking/berth fixtures and actual
SQLite World selection/nation-region/draw/group stores. The Premier12
integration uses actual saved ranking and regional Match history for its
draw, including source drift rejection and database reopening. Six-group
draw candidate evaluations are cached within each call; the full output
matches the original algorithm for the captured seeded case. Local timings
were 58.435 seconds before and 1.889 seconds after, not a general throughput
guarantee.

The national Edition tests reopen saved sources and reject changed candidate
provenance even when the winning hosts are identical. They also reject
unaccepted group/medal venues and knockout policy versions. Candidate
eligibility and suitability/rotation scores now come from the SQLite World
infrastructure and organizer candidate stores. Initial facility facts and
calibration parameters in tests remain explicit fixtures. The Premier12 test
also initializes the next four-year World cycle, consumes the actual prior
completed tournament's hosting, and selects a later opened city with less
recent-city penalty. It retains the old candidate/Edition snapshot unchanged.
Its host nations are outside the participant ranking; no host berth is added.
WBC also consumes the infrastructure/candidate stores and rejects a higher
scoring Canadian venue. Its ranking/qualification/history inputs remain
fixtures. Production venue catalog initialization and complete national
qualification/career orchestration are separate completion boundaries.

The qualifier integration plays twelve actual nine-inning Match games and
records the four winners in durable qualification history. It closes and
reopens the pod, schedule and Match databases after each incomplete semifinal
prefix (one through seven games) and final prefix (one through three games),
retaining pending status until the required stage is complete. Wrong dates,
unknown games, premature finals, changed sources and corrupt saved schedules
are rejected. Entrant selection, pod hosts and the calendar window remain
explicit accepted fixtures in this test; the whole source lifecycle is still
separate work. Match count inputs are scripted, as in the other integrations.

The full verification suite passed 486 files / 3,030 tests after Premier12
schedule integration; P0 run `36713238883` passed its final source-provenance
repair at `2ca3b345f516f2993b6d0e70cbc82ff42e8319a4`.
After WBC schedule/Match integration, full local verification passed 488
files / 3,033 tests. Fresh independent review reported no findings.
After national draw/source integration and candidate evaluation caching,
full local verification passed 489 files / 3,035 tests in 68.05 seconds.
Fresh independent review reported no findings.

After national hosting/Edition assembly, full local verification passed 490
files / 3,039 tests in 55.40 seconds. The independent review identified a
missing WBC US/AMERICAS consistency guard. Regression tests reproduced it
for pool, knockout and final candidate sources; the guard was added and
the complete verification suite passed after that repair.

After infrastructure/candidate source integration, final local verification
passed 493 files / 3,043 tests in 68.07 seconds, including catalog verification
and type checking. Independent review identified missing Club history
provenance when venue attributes are identical. The regression reproduced
that case; eligible Club prefix hashing repaired it. Additional predecessor
tests reject equal/future cutoffs and completion outside the predecessor
window before following the Edition callback. The full suite passed after
these repairs. This does not execute a production Club journal in the
infrastructure unit test; its accepted Club histories are callback fixtures.

After qualifier schedule/Match integration, full local verification passed
494 files / 3,045 tests in 101.26 seconds, with catalog verification and type
checking. The independent review reported no findings in this slice; the
explicit fixture and physical simulation boundaries above remain open.

Regional scheduling tests cover 8, 12 and 16 nation formats. The integration
plays all four recommended regional finals (16/16/16/12 nations, 118 actual
nine-inning Match games) within the accepted World windows, then records all
four placements in qualification history and official ranking history. It
reopens incomplete group, QF and SF stages; wrong dates, premature fixtures,
changed cutoff provenance and a different accepted knockout placement seed
with identical game IDs are rejected. Entrant draws, hosts, versions and
capacity/off-day calibration remain explicit test inputs. The integration
does not generate national pools, call-ups or physical ball trajectories.
Full local verification passed 495 files / 3,048 tests in 89.47 seconds,
including catalog verification and type checking. The fresh independent
review reported no findings in the regional schedule/Match slice. PR #213
P0 run `36736322310` passed at `2a47b38998b291fdaf306ae558d9cd2031ddc9f3`.

The World qualification unit test uses real World cycle/selection/nation,
coefficient/direct and composed qualification stores. Its historical game
descriptors and regional placement callbacks are explicit fixtures; this
test does not by itself connect the 118 regional or prior 51-game Match
integrations. It checks missing bootstrap evidence, incompatible regional
sources, same-result World policy drift, historical source drift, reopened
stores, snapshot corruption and exclusion of corrupt future selection rows.
An interruption after coefficient persistence but before direct-berth
persistence leaves no composed snapshot; reopening and retrying completes
the same request. Final local verification passed 496 files / 3,049 tests
in 67.07 seconds, including catalog verification and type checking.
Independent review reported no findings within this source-assembly slice.

## Remaining implementation boundaries

- Initialize production World facility/catalog evidence and generate
  regional/qualifier draw and accepted participation sources
  from accepted career and world-cycle state.
- Finish remaining competition schedules/career scheduler and physical Match integration;
  connect other national lifecycles to the durable Match pipeline and initialize
  historical WBC sources for new careers.
- Continue other approved career/development/manager/economic integration
  and whole-match, long-career, performance and population verification.
- Design, UI, art and presentation integration remain outside this work.

Passing component tests do not establish completion of the entire plan.
