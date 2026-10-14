# TBD–LAD v22 — 100-seed all-pitch audit and record/visual parity receipt

Date: 2026-10-14
Branch: `jolly/tbd-lad-playable-2026-10-14`
Status: **STANDALONE BROWSER PROTOTYPE AUDITED AND REBUILT / REAL NATIVE MATCH CORE NOT VERIFIED**

## Scope and method

The user requested roughly 100 complete games with every seed compared to internal evidence, rather than a mere successful end-of-game check. Tested **100 fixed distinct seeds** `AUDIT100-000..099` with a Cartesian-style systematic spread of 5 batting plans × 4 pitching choices × 5 pitch-location plans, alternating the user's managed team. Each played a complete 9-inning TBD-home vs LAD-away match in the v21/v22 **independent browser engine**, not the unmerged Native SQLite/Node Match Core.

For **every pitch**, the test reads physical ball/pitch frames, batter and defensive actor tracks, exact bat swept gap, ground/wall/possession/out-of-play records, thrown-ball/catching/base-control timestamps, umpire category, count, forced runners, PA/event ancestry and scores. Independent invariant oracles compare these facts to official scores/bases and displayed frames. Separately, the same seed and input produce a second independent execution with matching full-event/geometry SHA-256. A compressed **one-record-per-pitch archive** plus all 100 per-game fingerprints and seed choices are shipped with the v22 user-facing ZIP. This is a finite invariant audit, not an independent full real-world umpire.

## Apples-to-apples v21 vs v22

| Measured metric | v21 (same seed list) | v22 |
| --- | ---: | ---: |
| Completed games | 100 | 100 |
| Pitches | 26,107 | 26,025 |
| Plate appearances | 8,424 | 8,402 |
| Render/physical motion frames | 2,429,173 | 2,615,294 |
| Independent invariant assertions | 1,467,953 | 1,495,567 |
| Failed invariant *categories* | 8 | **0** |
| Verdict | FAIL | **PASS** |

The game results and pitch totals legitimately change after fixing rule/outcome handling. Never claim v21/v22 same-score parity. Counts below reflect overlapping failed checks, **not distinct flawed baseball plays**:

- 1,011 flyout rows falsely carrying a predicted future landing as an actual ground contact.
- 1,043 actual-ground logs inconsistent with visible physical ground contact.
- 1,018 actual-ground stamps occurring after an already secured fielder possession.
- 1,180 walks whose batter-actor never arrived at first base.
- 1,112 duplicate/non-monotonic defensive track timestamp checks.
- 1,283 runner advances that reached the claimed base only after the scene had cut away.
- 192 home runs without an actual out-of-play crossing recorded.
- 1 bat-ball collision boundary issue due rounded logged gap vs actual unrounded physics.

## Implemented browser-prototype v22 fixes

1. Split **predicted** `projectedGroundTick` from **actually observed** `firstGroundTick`; real catch, wall rebound and first-frame ground contacts now use actual evidence.
2. Do not pre-commit a home run while a fielder may intercept the ball before it leaves the park; log the real out-of-play point/time before ruling it a home run.
3. Preserve unrounded bat-ball swept collision gap evidence for auditing.
4. Remove duplicate track timestamps; use actual possession/receiver readiness and runner physical base arrival for force/hold decisions, including bases-loaded force-out at home.
5. Give ball-four batter and forced baserunners **real base-to-base visual tracks**, lengthen the observed scene until they arrive, and keep provisional UI scoreboard/bases at previous state until completion without shifting the underlying ball-four decision time. The `officialAt` field in this browser fixture is a **presentation delay**, not evidence the real rules allow delayed legal base award.

## v22 bounded acceptance receipts

- **100 games**, **26,025 pitches**, **8,402 PAs**, **2,615,294 motion frames**, **1,495,567 cross-checks**, **0 failed validations** in the covered categories.
- In-corpus: BB 1,171 (bases loaded 208), flyouts 975, groundouts 2,410, 2B forced outs 268, home forced outs 3, HR 218, 1B 1,185, 2B 366, 3B 132, wall rebounds 465, actual catches/fielding possession 4,502, throws 3,527, fouls 240, taken pitches 13,811.
- **14/14 intentional corruption mutations detected**, including invalid catcher timing/ground log, static walking batter, premature cut, unsupported HR, actor duplicate ticks, wrong force/ball-strike/collision evidence.
- Every one of the 100 seed replay fingerprints matches same seed/input re-execution. Archived receipts are parsed **independently of the engine** to verify 26,025 records + 100 distinct game manifests, unique seed IDs, per-seed exact pitch timeline continuity, official event bounds and manifest SHA hashes.
- Browser full-playback acceptance: Chromium **1440×1000 desktop** and **390×844 phone-sized viewport**, both PASS. Player/label/manager command boundary/replay/taken-pitch shallow glance/walk scoring delay validated. No physical Android/iOS device tested.
- Approved B1 sprite masks/palette, embedded font, baseball surface raster and pitch symbol source hashes identical to v21.
- Self-contained ZIP extracted into a fresh directory and **rebuilt byte-identical** to distributed HTML (SHA-256 `ce79f776b508880245d883cc54617ffe75d293745f76cea39d2caa2d5092d8cd`). All 100-seed, 14-mutation, archive, asset and browser checks reran PASS on extracted copy.

## Released outputs (user conversation attachments, not committed as huge binary HTML to Git)

- `ばせぼーるlv22_TBD_vs_LAD_100試合監査修正版.html`
- `Kneekura-Mini-Baseball-v22-100-seed-audit.zip`
- `v22-監査レポート.md`
- ZIP `tests/audit-100.cjs`, `tests/verify-archive.cjs`, `tests/fault-injection.cjs`; `reports/audit100-seed-manifest.{json,csv}` and compressed `reports/audit100-per-pitch-receipts.jsonl.gz` for every pitched event; reusable source patches and original v21 for A/B proof.

## Explicitly NOT proven

- No connection/parity verification against latest unmerged genuine Node.js/SQLite Match Core, LAN01 whole-case, or Native official adjudication/long-term database lineage.
- No exhaustive baseball legality for appeals, tag-ups, catch/no-catch edge rules, all force/tag combinations, substitutions, real stadium physics, replay / scorekeeping under every scenario.
- No actual phone hardware performance/offline data retention or simultaneous multi-device coordination.
- v22's standalone simplified game engine and synthetic fixture inputs **must not** be promoted as evidence of production Core readiness. The audit catches modeled contradictions, not all possible omissions.

Keep v21 immutable and apply true causal remediation to Native work only after source-gate review. Do not merge work branches or change approved v16 PNG source as a side effect.
