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
- A ranking snapshot replays official history through its own cutoff.
  Later tournaments cannot become dependencies of their earlier selection
  rankings. Premier12 validates the cutoff before reading that ranking and
  requires it to precede the tournament window.

## Verification boundaries

The Premier12 integration test connects real SQLite regional, ranking, group,
final-four and history stores. It covers partial-round restarts, missing finals,
repeated application, reopened stores, cutoff drift, fixture mismatch and saved
outcome corruption. Its Match source provides synthetic official result and
fixture records; it does not execute the physical Match engine.

The full verification suite passed 483 files / 3,026 tests. The final ordering
of the cutoff check was additionally verified with targeted tests and typecheck.

## Remaining implementation boundaries

- Persist and generate national edition cutoff/calendar/draw/hosting sources
  from accepted career and world-cycle state.
- Connect complete national lifecycles to the durable Match pipeline and
  actual career scheduler; complete WBC historical coefficient source replay
  across multiple editions.
- Continue other approved career/development/manager/economic integration
  and whole-match, long-career, performance and population verification.
- Design, UI, art and presentation integration remain outside this work.

Passing component tests do not establish completion of the entire plan.
