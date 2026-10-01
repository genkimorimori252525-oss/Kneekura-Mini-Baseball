# Actual batted-ball flight persistence — 2026-10-02

## Confirmed scope

Foundation `44b9f5de7b9d87e649f12f1af78c202f2b5ab44d` confirmed32 same Match/actual Player physics; latest Realism `4f0a60a3818926327b6bf5877ab3dec456a76530` contracts05/06/07. Latest visual-asset updates do not change these nonvisual contracts. The user authorizes all confirmed nonvisual work/publication. No UI/design connection or merge.

## Implementation

- Native consumes an actual pending BatBallContact from its own replayed physical-pitch action and frozen actual batter/Person. An independently accepted flight Source supplies only identifiers, an earlier accepted flight if extending, a search horizon and explicit venue/day/field/physics execution. It cannot supply a contact, player, timeline, ruling, count, score or desired result.
- Existing Core physics derives the flight and projected first-ground territory. The full original action, parameter/actor proof, execution and result are immutable canonical records with independent SQL mirrors/hashes. Ordered extensions preserve the same contact and execution while increasing their horizon. An initially airborne interval remains extendable after restart.
- Own-connection checks compare original evidence before and after writes, the current open Match/World/workload for fresh execution, and the actual fixture/day. Triggers changing pitch/actor/fixture/workload or inserting unowned extra history cause rollback. Identical retries revalidate original evidence after live callbacks, including the actual batter owner; historical/offline retry does not require a still-current open frame.
- A ground forecast is a trajectory candidate, not a final physical event or baseball ruling. The original timeline remains pending. This owner changes no Match, count, official/scoring result or workload and asserts no absence of earlier fielder/wall contacts. Actual contact/adjudication orchestration remains the next confirmed dependency.

## Verification

Missing-owner RED preceded implementation. Native cases exercise actual accepted swing contact, airborne-to-ground horizon extension, offline reopen, absent actual batter, a taken pitch, frozen Source retries, duplicate/forked/missing parents, changed execution, caller result injection, wrong fixture/day/ball/time and absolute-tick overflow. Real disk WAL cases cover late physical head/archive/actor/fixture/workload/own-row/head changes, stale peer evidence, legitimate later recovery and archive corruption.

One fresh readonly review found two Important issues: cached original retry after authority mutation, and unowned postwrite history insertion. Tracked RED→GREEN tests cover both and an earlier orphan revision. Parent reproduced the same retry gap in the actual batter dependency and fixed it with a real WAL regression. Independent final review ran37 tests (actual actor17, flight18, scratch2), all passing, with no unresolved findings.

Final `npm run verify`, including the additional actor retry fix, passed catalog/typecheck and559 files /3,326 tests in676.05s. The published Source suite has553 files /3,310 tests;16 scratch reproductions are excluded. The earlier whole run559/3,325 preceded that additional fix and is not the final evidence.

## Remaining goal

Body, field geometry, flight physics and other calibration inputs remain explicit independently accepted data. This slice adds no numeric production defaults. Original flight evidence is now durable; actual earliest contact/ground-ball/running/closure, clinical/facility/content inputs, other activity Sources and autonomous Manager/Match/Career execution remain in the overall confirmed nonvisual goal. This slice does not complete that goal.
