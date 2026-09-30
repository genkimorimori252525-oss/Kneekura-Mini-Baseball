# Regional National Ranking source

Authoritative scope: approved `12-competition-identity-hosting.md`, section 10.2,
on `origin/jolly/core-foundation-plan-2026-09-17` at
`560670be519a01f07e2e4b7dd12a1ca3821c88a4`.
Regional Championship seeding centers on Regional Ranking and previous regional
results; the World ranking is not its substitute.

## Implementation

- Core derives a distinct tagged regional ranking from actual regional result
  history, historical Nation competition regions and the current ranking population.
  WBC/Premier results, other regions and future regional editions do not award points.
- A Nation that changed region can remain a historical opponent without joining
  the current regional ranking. Evidence is required for every considered old
  regional edition. Membership uses its accepted calendar start, consistently with
  official group validation; a mixed-region historical edition is rejected.
- A registered explicit policy supplies win/tie points, regional/stage weights,
  recency bands and deterministic Nation-ID tie breaking. No production numerical
  defaults, ability modifiers or synthetic historical wins are introduced.
- Native snapshots consume actual ranking-history and Nation source owners, pin
  the relevant full regional history and dated Nation proofs, and expose a compact
  source digest. Policy versions are frozen per Career. Retry/reopen and source or
  stored-payload drift are verified. Writes start fresh proof phases.
- Native ranking history exposes accepted Regional Edition metadata read-only.
  The existing World result DTO and hash basis are unchanged. A region change during
  an actual tournament is covered, along with missing/future metadata and metadata drift.
- The existing 118-game integration for four recommended regional finals now
  produces four Native regional ranking snapshots from its actual Match results.

## Verification

Targeted Core and four-region Match integration passed (two files / five tests,
15.98 seconds). Regional snapshot, Core and existing World snapshot tests passed
(three files / six tests, 0.66 seconds). Type check passed.
Independent review identified one Important temporal mismatch (completion-day vs
start-day membership), repaired with a failing Core regression and actual Native
tournament coverage. Post-fix four files / nine tests passed in 16.90 seconds;
type check passed. Final `npm run verify` after the repair passed catalog compilation,
type check, 512 test files and 3,090 tests in 258.34 seconds. The actual 283-Match
qualification/finals integration also passed. No second review was requested.

The actual regional Match test supplies Edition draw/host metadata and canonical
walk/strikeout play inputs. Regional draw/hosting source assembly and physical
trajectory generation are separate remaining integrations.

## Remaining whole-plan work

Regional entrants / draw / hosting assembly, production National Pool/population
and facilities, approved first-career historical sources, year-round Career and
physical Match / travel / recovery / development / economy integration, and
long-career acceptance remain open. This source slice does not close the nonvisual
goal. UI/design remains disconnected; no merge is included.
