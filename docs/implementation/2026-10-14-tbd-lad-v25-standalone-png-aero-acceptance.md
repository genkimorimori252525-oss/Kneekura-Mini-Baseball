# TBD/LAD v25 PNG-preserving Native aerodynamic proof — acceptance receipt

Date: 2026-10-14. Branch: `jolly/tbd-lad-native-browser-core-2026-10-14`
Status: **TRUE NATIVE ONE-PLATE-AERO PHYSICAL/PRESENTATION BOUNDARY PROVEN; AUTHENTIC TBD/LAD NINE-INNING FULL MIXED GAME NOT DONE**

## Built offline user preview

The user-facing conversation artifact `ばせぼーるlv25_TBD_vs_LAD_正式Core空力接続.html` was built from the exact previously approved **v23 single-file PNG game display** and a source-pinned, independently minified browser JavaScript bundle compiled directly from this branch's real `src/core/` and `src/presentation/`.

- Original v23 HTML SHA-256: `d2fe73e920e3910984bac26271e36521c4d7821438215295241bbcc3eaf9d3f4` (1,288,734 bytes).
- Actual Native source JS SHA-256: `05d3f23c65657eeb1c8acfefbf21f37f3cd3c26bc85f733cc3ad5c6af618805c` (149,098 bytes). Exact `dist/native-match-core-browser.js` from this branch.
- Minified input JS SHA-256: `c8a033b3e62cb6331d058561281c4eddb3bce9feacf293e8f241a14ae26a2b07` (69,877 bytes), source-pinned by the offline artifact builder.
- Self-contained final v25 HTML SHA-256: `5aa2d7dc14fccc052a8b85291a6425e105afd84f176c9fa804e36a2481dbdff8` (1,371,980 bytes).
- Original PNG/B1 mask literal span 869,579 bytes SHA `2c730d7a533844ad895a45744a142c562a642fb2e153e688fa608ec2acce975e` **unchanged** in v25.
- Original embedded Japanese WOFF CSS 93,491 bytes SHA `6bd1592ef0d1a47ecd13bf7ef81ac361a12c29239f31d43bec1c3f54f6023aeb` **unchanged**.
- Source and re-build scripts plus exact PNG source, JS input, screenshots, tests, and SHA manifests ship with `Kneekura-Mini-Baseball-v25-Native-Aero-PNG-Bridge.zip` in the conversation. Clean extract rebuilt identical HTML and passed every file hash check.

## Actual browser acceptance

Chromium viewport 1200×860 desktop and 390×844 mobile-sized (not real phone hardware), each:

- default v25 Native **aero + rigid bat** observer initialized with *real production* `createNativeAerodynamicSession`/read-only `observeNativeAerodynamicPitch`;
- two issued reference physical pitches with actual 18m traveled launch, 15 physical sample frames each; first Core events `TakenPitchPlateCrossed`, `PitchAdjudicated`, first count 1B 0S; second inside target 1B 1S — next-pitch command accepted only after prior pitch;
- actual source engine rigid swing yielded `SwingCompletedWithoutContact`, `PitchAdjudicated` (a bona fide physical miss, **not a fake recorded hit**);
- original v23 match remains paused while observer runs; v23 controls restored on exit; event/score separation maintained;
- 0 JS page errors, 0 network requests. Bytes are fully self-contained and offline.
- Full browser observer focused Vitest **31/31 PASS** across 5 files, full `tsc --noEmit` PASS after tracked official source catalog generation, native `vm` without Node require/fs/sqlite PASS.
- The separate Native Node/SQLite host 9-inning genuine physical 178-pitch 58-PA K/BB outcome is independently proved by a 406.80s focused real test, not by this HTML (see adjacent receipt).

## Fundamental limits preserved

The local reference source's 40m/s pitch and bat parameters are declared **fixture-only**. They are *not* Tikao's 97 league-relative control or inferred absolute 200–250 talent, not Nappa's catcher calling, not Ohtani's actual swing ability; the test has no real Native fielder/runner position source. The background's nine PNG players are *legacy display reference only*. Before contact, Native physics/adjudication controls ball and bat; after contact, **real accepted** Native batted-ball continuation/fielding/rules/official receipt must exist or the adapter stops without assigning a hit/out. The legacy v23 nine-inning game remains its clearly separate browser approximation. The real mixed-play official nine-inning Native closure (including LAN01), phone hardware and durable offline browser restore are **unverified**.

This uses the original image artwork without re-enabling archived pixel-player JSON, ASCII, or autonomous UI redesign. No original file, protected `main`, or shared nonvisual owner branch has been overwritten or merged.

## Cross-viewport deterministic parity (added 2026-10-14)

Executed the **same unmodified v25 offline PNG HTML** in independent Chromium sessions at 1200px desktop and 390px phone-sized viewports for **25 deterministic seeds, 2 canonical Native Aero/Rigid physical pitches per seed, 50 pitches per viewport**. Each sample's original Core position, velocity, spin, accepted event/tick, count and command was captured and compared. Both normalized canonical traces produced **identical SHA-256** `ac472c4f8c4850f2d9083655759142cbca9697f0d20b67d6c1eca5ab3f5f08a6`, browser exceptions 0, network requests 0. The user ZIP was updated with `test_v25_cross_viewport_parity.py`, SHA manifest and independent clean-extract re-execution (PASS). This demonstrates **viewport-size invariance only** under identical reference-physics input, NOT iOS/Android physical hardware certification, cross-browser equivalence, genuine player-rating calibration or a finished Native mixed-live-ball nine-inning game.
