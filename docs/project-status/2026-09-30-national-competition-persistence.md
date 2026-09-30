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
executed by this test. Fixture days are within the accepted window but are
not yet supplied by a complete competition schedule.

The full verification suite passed 485 files / 3,028 tests after Match integration.

## Remaining implementation boundaries

- Generate remaining national draw/hosting and accepted participation sources
  from accepted career and world-cycle state.
- Finish competition schedule/career scheduler and physical Match integration;
  connect other national lifecycles to the durable Match pipeline and initialize
  historical WBC sources for new careers.
- Continue other approved career/development/manager/economic integration
  and whole-match, long-career, performance and population verification.
- Design, UI, art and presentation integration remain outside this work.

Passing component tests do not establish completion of the entire plan.
