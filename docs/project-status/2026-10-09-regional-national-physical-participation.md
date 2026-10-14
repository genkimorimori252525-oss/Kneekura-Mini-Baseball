# Regional National ordinary physical participation

Scope: the existing accepted Regional National **group fixture**, original registration and legal eligibility, ordinary physical play closure, binary game/Player participation, and existing National/Career consumers. Based on `79fd74cdf6ce0b252ca3514a9eaf5ef7e0053aa9`.

Authority: [Foundation 11 §19](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/blob/jolly/core-foundation-plan-2026-09-17/docs/game-design/11-world-competition-architecture.md), approved National eligibility/call-up rules frozen 2026-09-22; inspected document blob `8c6cbdcf9eebb005643daae4a5c790fdae02eeef`. This continues the existing [National call-up implementation](2026-10-01-national-eligibility-callup.md) and [Regional registered-actor Match path](2026-10-01-regional-national-roster-match.md).

## Connection

1. Existing World cycle, Regional group/schedule, fixture registration, National call-up, global roster snapshot, Person link and pregame binding owners remain the producers. Their explicit accepted inputs supply Nations, date, venue, policy and participants.
2. Before initial World or physical actor enrollment, `openSqliteNationalMatchOriginStore.capture` accepts `national-regional-group-origin-v1`. It replays those owners on its own Native connection and freezes original binding, active registration snapshot, legal-fact prefix and representation revision for every bound Player. First admission requires the current global roster and an unplayed Match. Exact retries retain the original archive.
3. Initial World, physical batter, pitch and ordinary closure evidence authenticate that original National membership. The actual Regional fixture supplies the physical Match scope; no domestic season or National Club assignment is fabricated. Pitch workload continues on the existing global Player workload owner.
4. `confirmNationalPhysicalPlayed` produces `NATIONAL_PHYSICAL_PLAY_V1` from a completed ordinary physical closure. Original defenders count as `DEFENDER`, the authenticated original batter as `BATTER`, and an already owned pre-pitch runner as `RUNNER`. A bound reserve alone does not count. The existing unique game/Player receipt and collision rules remain in force.
5. National appearance adoption reads this tagged receipt and its original registration on the adopting connection, including after the real journal INSERT. Later replacement, legal revocation or adoption cannot rewrite original membership. The existing representation policy determines a senior appearance lock. The existing `readAcceptedPopularityEvent` supplies an `OFFICIAL_GAME` Career event; audience observations and update policy remain explicit inputs.

The original Native competition projections reuse the same owner implementations through read-only borrowed-connection facades. Regional original group replay reads the accepted Edition and group plan without replaying later Match outcomes. National origin reuse is limited to the existing guarded, synchronous Native read frame and never crosses a writer phase.

## Boundaries

- The new producer supports Regional group fixtures. Regional knockout, WBC finals/qualifiers and Premier 12 require their own original fixture replay before receiving this capability. A prior unsupported non-Regional appearance or qualifier registration in the shared National journal also remains a prerequisite; replay fails closed.
- New National batted/actual-live/terminal receipt variants are not enabled. Domestic `ACTUAL_LIVE_V1`, `PHYSICAL_PLAY_V1`, `FOUL_TERMINAL_V1` and untagged legacy identities remain distinct.
- National membership requires original `AVAILABLE` eligibility. It does not become clinical REHAB participation.
- This does not choose a lineup, create schedules or registration rules, supply production physics/popularity calibration, or alter Club affiliation, UI or PitchArsenal.

## Author checks

Small Native integration checks cover actual Regional registration through three physical pitches and ordinary strikeout closure, defender/batter receipts, unused-reserve rejection, senior adoption, global workload and the existing Career event adapter. Additional controls cover stale pregame legality/roster, own-connection original-source mutation, post-INSERT rollback, later same-day revocation/replacement, exact retry and reopen. Existing domestic/legacy and unsupported tagged-consumer checks are included in the affected author batch. Consolidated acceptance belongs to the parent integration batch.

Author result: the affected six-file batch passed all 54 cases. After the final original-binding metadata guard, the six-case National integration file passed again, including the added duplicate-key/alias control (55 distinct author cases across the two runs). Targeted TypeScript compilation and `git diff --check` passed. No whole-tournament/genuine regeneration or broad acceptance suite was run for this component.
