# Regional national draw source connection — 2026-10-01

## Authority and scope

Approved foundation head `560670be519a01f07e2e4b7dd12a1ca3821c88a4`, document 11 section 13 and document 12 section 10. Nonvisual only; no UI, art, renderer or ability changes.

## Implemented

- Native Regional Draw consumes an accepted `REGIONAL_NATIONAL` World selection, exact cutoff country roster eligibility, accepted regional ranking snapshot and dated Native Nation regions.
- The complete accepted cohort must contain 8, 12 or 16 nations. Four ranking pots feed the registered deterministic generic draw. Ranking countries without accepted roster capability receive no berth.
- Regional rematch evidence is bounded by the supplied lookback and comes exclusively from the verified regional results backing the accepted regional ranking. World ranking and Club affiliation do not seed this draw.
- Career policy versions and Edition requests are frozen. Saved snapshots revalidate all accepted sources on read/reopen; later callups and dated Nation changes do not rewrite a historical cutoff. Changed historical evidence or corrupted saved data is rejected.
- Regional Group Store optionally consumes the Native Draw authority and rejects manual substitutions of draw/cohort IDs, calendar, region or group participants when connected.

## Verification boundaries

`npm run verify`: catalog compilation and typecheck succeeded; 513 files / 3,093 tests passed in 264.93 seconds. One independent review found no Critical, Important or Minor issues. Its focused check passed 2 files / 4 tests.

The roster integration uses Native legal facts, Person links, global roster, callups, country capability, Nation, World selection, ranking and draw. Its prior official ranking history is an explicit fixture.

The existing four-region integration plays 118 actual Native Match games, adopts actual official regional history/ranking, and feeds those rankings into the next World cycle's Native draws/groups. Next-cycle country capability and hosting/profile metadata are explicitly fixtures in this gate. These two gates do not establish a production first-career bootstrap or complete native hosting assembly.

No default roster minimum, ranking weights or calendar calibration has been invented. Numerical profiles in tests are fixtures.

## Remaining confirmed nonvisual work

Regional hosting candidates, facility/rotation evidence, qualified-host Pot 1 candidate policy and generated group/knockout Edition metadata still need their Native connection. A larger regional candidate pool needs an approved qualifying cohort owner; this draw does not choose arbitrary top countries or fabricate a qualifier format. Production population, initial historical competition evidence, career calendar/runtime integration, physical Match actor/materialization integration and the broader career gates remain unfinished.

The overall nonvisual goal remains active. This slice is not a claim that the remaining approved plan is complete.
