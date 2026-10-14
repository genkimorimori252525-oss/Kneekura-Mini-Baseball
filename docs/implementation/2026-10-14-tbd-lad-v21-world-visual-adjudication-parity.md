# v21 TBD (home) vs LAD (away) — World/Visual/Adjudication Consistency Audit

Date: 2026-10-14
Status: **STANDALONE BROWSER ENGINE FIXED AND TESTED / GENUINE NATIVE MATCH CORE PARITY NOT YET PROVEN**
Base: v20 browser build and `docs/implementation/2026-10-14-tbd-lad-v20-threat-aware-fielding-and-taken-pitch.md`.
Source release: user-facing downloadable `ばせぼーるlv21_TBD_vs_LAD_整合性修正版.html`, ZIP `Kneekura-Mini-Baseball-v21-TBD-vs-LAD.zip`. Large self-contained HTML with original approved B1 PNG-derived masks is not pushed to repository.

## User-observed failures and root causes

1. **Taken pitch gaze overshoots**: v20 followed the unhit ball until actual catcher reception behind the batter. Physical ball continues to catcher, but v21 caps only the **batter camera** to a shallow glance slightly behind the strike zone, without changing ball location or umpire calls. New helper `capTakenPitchGaze` in `src/presentation/mini/TakenPitchObserver.ts` caps angular displacement (default 0.42rad yaw and 0.18rad pitch from zone observation). Batter POV becomes much less visually disruptive.
2. **Ohtani initial false ground-rule double**: reproducible with seed `TBD-LAD-2025`, first PA, pitch #5. v20 predicted a future fence collision and retained the ground-rule double marker despite an earlier *real* ground-ball recovery by the center fielder at elapsed 3.52s. Fence impact was also incorrectly conflated with a ball leaving the field. In v21 the future hypothetical collision is not applied past actual possession; fence rebounds that remain on the field remain live; no ground-rule double is assigned without a true out-of-play event. That pitch now scores a **single**. Ball had touched ground at local sample 63 before CF possession, therefore **not a fly out** under official airborne-catch rules. Animation now distinguishes recovery from airborne secure catch.
3. **Runner safe at second before actually arriving**: v20 staged expected destination and runner animation separately from throw/base timing. v21 uses the same runner locomotion timing for base touch and throw/base possession. In a genuine force play where the fielder controls second before the forced runner arrives, official play outcome becomes **FC** (fielder's choice/force out), *not* safe hit. For extra-base attempts after a single, field timing may prevent the batter advancing to second, leaving batter at first. Runner world tracks and ball/throw animations use those same resolved timestamps.
4. **False fly out after wall bounce**: v21 requires pre-ground, pre-fence airborne capture for an airborne putout; a ball rebounding off the wall does not qualify as a direct fly catch. The actual v21 local browser hit/rebound logic is still an approximation and **not a full out-of-play/park geometry solver**.
5. **Bat display frequency**: separate geometric bat overlay uses nominal 27.5ms samples (same density as batted ball); pitch ball remains 22.9ms and generic scene/players 55ms. Approved original B1 masks are unchanged. The batter/pitcher/catcher/overhead geometry layer is smoothed as appropriate, but the **mound B1 illustration's own fixed four bat frames** are not synthesized into new artwork. This is an explicit exception, not silent full coverage.

## Relevant baseball rules

- Official definition of a catch: secure possession before touching ground (OBR glossary). A fielder picking up a ball after ground contact is not a flyout.
- A ball merely striking a wall in the field and rebounding can remain a **live ball**; an automatic two-base award requires an actual applicable out-of-play/dead-ball condition.
- For force plays, fielder must securely control ball and legally touch the forced runner's next base before runner touches it; the film and official ruling should represent the *same event*.
- No result label is allowed to override contrary canonical ball, defender or runner evidence.

## Verification receipts: browser prototype

- `node tests/v21_headless_test.cjs`: **65 completed 9-inning games, 15,223 pitches, 5,379 PA, 71/71 PASS**.
- `node tests/v21_defensive_unit.cjs`: **11/11 PASS** retained threat-aware defense cases.
- `node tests/v21_scene_regression.cjs`: **30 seeded games, 21,916 presentation scene assertions PASS**, 1,846 fair hits, 76 fouls, 2,960 unswung pitches.
- `node tests/v21_consistency_audit.cjs`: **95 completed 9-inning games, 22,024 pitches, 23,070 consistency assertions PASS**. 1,068 airborne flyouts; 282 true fielder's choices; 2,200 groundouts; 400 real doubles; 228 prevented extra-base attempts; 482 live wall rebounds; 5,680 fair batted balls validated. Hard-coded Ohtani original seed also checked.
- Playwright Chromium desktop 1440px and mobile-like viewport 390px: **PASS** for shallow batter gaze, red runner names, outfield labels, five cameras, manager changes applying at next-pitch boundary, bat display, final 9-inning results; uncaught JS errors 0. **Physical Android/iOS device NOT RUN.**
- Five unchanged presentation assets (B1 masks, palette, Noto WOFF, ball surface raster, pitch glyphs) verified SHA-256 identical with v20.
- ZIP extracted to fresh `v21-extracted-repro` directory and rebuilt using all included scripts; generated HTML **byte-identical** to shipped HTML. Extracted unit/headless/consistency tests and asset check also PASS.

## Production integration contract

On the shared Native Match Core branch, integrate this as **new regression requirements**, not by copying simplified browser outcome simulations. This v21 artifact still runs an independent browser simulation, so its PASS results do not prove:
- Native `CanonicalWorldSnapshot` -> Presentation read-only adapter,
- latest true Native LAN01 whole-case pass,
- production independent offline smartphone save/resume and platform parity,
- full real catcher reception, wall/rebound/out-of-play, runners, appeals, tag/re-touch, or all contested multi-runner scenarios,
- actual phone thermal/battery/performance.

The Native acceptance gate must use actual physical events for contact, ground touch, wall collision, possession and secure catch, catch release, transfer, arrival at bases, secure fielder possession of thrown ball, force/tag legality, and official outcome. For the same event and tick, both the UI and ledger must report coherent facts. Never award a flyout when ground contact or wall rebound occurred first, a ground-rule double on future unconsummated out-of-play, or safe where force-out occurs first. Move the camera only; **never move ball physics to satisfy presentation**.

New isolated Presentation helpers added to this work branch: `TakenPitchObserver.capTakenPitchGaze()`, `BatDoubleCadence.buildDoubleRateBatVisualSamples()`, accompanying Vitest tests. GitHub CI for these latest additions **NOT RUN**; the full browser artifact suite above is independently verified.

No shared Native Core owner source, protected main branch, or original v16/v20 files were overwritten or merged.
