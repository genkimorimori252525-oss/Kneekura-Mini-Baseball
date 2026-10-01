# Official physical pitch workload — 2026-10-01

## Approved scope

Latest foundation `44b9f5de7b9d87e649f12f1af78c202f2b5ab44d`, frozen14/32/53 and existing Native official scoring/participation/workload owners. User-authorized confirmed nonvisual implementation; no design/Presentation connection, obsolete plan or merge.

## Implementation

- Native scoring exposes its replay-validated original accepted play input. Native participation infers the unique P defender from the actual activation World and validates the accepted Player/Person/game binding and activation/closure chain without writing another appearance receipt. The producer compares the full activated MatchState with the actual scored play's starting state.
- Core counts completed canonical physical take, missed-swing and contact actions. It requires matching count events for taken/missed pitches, rejects unbacked manual count events and duplicate physical ticks, and validates required crossing vectors/geometry and contact vectors/fields. Actual aerodynamic crossing extensions remain compatible.
- A new durable Source owner freezes independently accepted explicit per-pitch effort calibration, original policy provenance, Native evidence and physical event sequences. Source identity follows the actual Career/game/play/pitcher, preventing aliases or another calibration from producing another charge. No participation count, scoring classification, win/loss or League/Nation modifier generates effort.
- Existing global Player workload storage applies the generated MATCH activity and remains the sole fatigue owner. Source acceptance and workload application are separately resumable stages. Original policy and Source replay survive reopening without live policy authority. Stored-evidence changes are detected; late Source and workload failures roll back their respective writes.

## Verification

Missing read API, Core model and Native producer RED were captured before implementation. A policy SourceVersion changed during INSERT also produced RED and was fixed by checking the original detached calibration before commit.

One fresh reviewer found three Important issues: incomplete activation MatchState comparison, policy SourceVersion corruption after COMMIT, and incomplete physical payloads. Each was reproduced in corrective RED. The fixes above passed parent affected verification: 5 files /26 tests in 1.11s, existing physical/delivery runtime 2 files /4 tests in 1.07s, plus typecheck and catalog compilation. The same reviewer confirmed all three resolved with no remaining Critical/Important/Minor findings; independent 2 files /10 tests passed in 1.10s.

Actual Native integration accepts three physically resolved pitches, generates 6 explicit fixture effort units and applies them to the correct Player. A failed workload write leaves the accepted Source available for retry; later recovery advances the global head, while original retry returns the original fatigue result without another charge. These numerical calibration inputs are synthetic verification facts, not production defaults.

Whole `npm run verify` passed 532 files /3,157 tests in 664.04s, including typecheck/catalog compilation and actual Native regional/WBC/World population gates. Publication and exact-SHA P0 follow.

## Remaining overall goal

This slice covers accepted activation/closure play chains. Initial pregame play evidence, physical fatigue consumers, other activity Source generation, evolving recovery/health and complete autonomous Career/Match orchestration remain in the active goal. It does not claim an autonomous full game or complete production calibration/content generation.
