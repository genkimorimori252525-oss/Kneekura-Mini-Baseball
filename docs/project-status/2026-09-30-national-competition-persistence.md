# National competition persistence — 2026-09-30

Canonical approved design: `origin/jolly/core-foundation-plan-2026-09-17`
at `560670be519a01f07e2e4b7dd12a1ca3821c88a4`, documents 11 and 12.
This records implementation evidence, not approval of another design.

## Implemented sources

- Regional national groups and knockout results feed persistent national
  qualification history and world national ranking history.
- WBC qualifier selection consumes saved direct berths and a saved ranking.
  Four qualifier pods consume venue-bound official Match finals. Their winners
  feed qualification history and the final 20 + 4 berth allocation.
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

## Verification boundaries

The Premier12 integration test connects real SQLite World cycle, national
selection, regional, ranking, group, final-four, Match and history stores.
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

The full verification suite passed 486 files / 3,030 tests after Premier12
schedule integration; P0 run `36713238883` passed its final source-provenance
repair at `2ca3b345f516f2993b6d0e70cbc82ff42e8319a4`.
After WBC schedule/Match integration, full local verification passed 488
files / 3,033 tests. Fresh independent review reported no findings.

## Remaining implementation boundaries

- Generate remaining national draw/hosting and accepted participation sources
  from accepted career and world-cycle state.
- Finish remaining competition schedules/career scheduler and physical Match integration;
  connect other national lifecycles to the durable Match pipeline and initialize
  historical WBC sources for new careers.
- Continue other approved career/development/manager/economic integration
  and whole-match, long-career, performance and population verification.
- Design, UI, art and presentation integration remain outside this work.

Passing component tests do not establish completion of the entire plan.
