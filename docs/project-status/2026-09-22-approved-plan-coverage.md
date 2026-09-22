# Approved plan coverage — continuation after PR37

## Scope and counting rule

This is an implementation coverage inventory, not a new design or a claim that the entire repository was audited. It describes this headless implementation stack and the separately rechecked Swing Kinematics PR27. Source design snapshot: `782f6b8ef2406839de5678b00040001111cd8f77`; current design handoff00 governs document status. Filenames ending DRAFT may be approved; archived39/40/43/45/46/47 and validation/audit36/44/48/54 are not additional implementation plans. `06-future-systems` is a future candidate pool, not automatically approved scope. Historical design headers saying “unimplemented” are not current implementation evidence.

A completed unit-tested component is not the same as a fully connected career/game feature. No defensible total completion percentage or “a few tasks left” claim follows from document or test counts.

| Approved area (source docs) | Concrete evidence in this stack | Remaining completion boundary |
|---|---|---|
| Match/rules/physical world (02/04 and newer implementation contracts) | Existing canonical events, defensive/runner/throwing modules and tests; separate Swing Kinematics PR25/27 | Cross-branch integration and end-to-end match closure must be verified against current owners; this inventory does not re-audit every rule or physical model |
| Roster / human control (32/38/49) | PR26 ownership/placement/registration/availability; PR28 decision attribution | Live services, source generation, persistence and all downstream consumers; not whole development or manager AI |
| Club identity / seeds / economics (16–19/21–30/33) | PR29 lifecycle/accounting; PR30 234 clubs,21 leagues and new-career assembly; existing rivalry lifecycle | Calibrated monetary/place/person/venue setup, automatic economic flows, contract authorization and financial enforcement |
| Psychology (05/08/09/52) | PR31 gate; PR36 importance/appraisal; PR37 numeric inputs and actual runner motion; current throw/replan plans | Batting consumer, representative source generation, actual scheduler/interruptions, physical release validation, whole-game calibration/persistence |
| Player traits (08/09/53) | PR32 lifecycle/Green subset; PR33 source projections; PR34 five numerical classifiers; PR35 two-strike separation | Remaining family classifiers (including joint wild-stuff, matchup/history), current skill source derivation and comprehensive production consumers/calibration |
| Competitions / hosting / calendar (10–15) | Club/league identities and source profiles provide inputs, not a working competition scheduler | Editions, standings/qualification, draw/hosting, actual schedule/events/deadlines and year-round orchestration remain explicit queued systems |
| Recruitment / development (31/32/53) | Roster placement and learned-trait proofs are supporting boundaries | Scouting operations, player generation/growth/training, opportunities/breakthroughs and population calibration |
| Team traits / relations / mood (34/35/37/38) | Individual psychology and club references are supporting inputs, not team implementation | Relationship network, team trait/mood evolution and manager interventions |
| Manager / reputation / star development (41/42/49–53) | Human delegation/attribution and current-manager references | Full autonomous choices, appointment/market, historical learning/evolution, reputation/popularity and development generation |
| Integration / persistence / verification | Deterministic pure proposals, accepted-event replay, per-commit regression suites | Atomic world adoption, exactly-once store, actual whole-game and long-career/regression/performance/population checks |
| UI / art / presentation (01/07/20) | Separate design/Work ownership | Excluded from this session; no screens, buttons or layout invented |

## Practical next order

Finish/revalidate direct execution integration where source owners already exist; then build missing source-generation/world services and competition/calendar/development systems in their dependency order. Retain per-area acceptance criteria instead of multiplying more wrappers and calling them entire completed features. Independent branches should be integrated deliberately with full regression checks, not assumed present because their PRs are green.

No archived design was reopened and no calibration placeholder was promoted to approved production content.
