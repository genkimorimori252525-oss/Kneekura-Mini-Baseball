# TBD (home) vs LAD (away) — v18 browser slice implementation receipt

Date: 2026-10-14
Branch: `jolly/tbd-lad-playable-2026-10-14`
Status: **BROWSER PROTOTYPE PASS / NATIVE MATCH CORE INTEGRATION NOT DONE**

## Source ownership and provenance

- User-defined team: NLB Tambov Dragons (TBD), nine hitters and pitcher Ti-ka-o. Authored roster: `docs/roster-seeds/2026-10-14-nlb-tambov-dragons-v1.md`.
- Historical opposing team: MLB 2025 Los Angeles Dodgers (LAD), 2025 World Series Game 1 lineup. Historical eligibility: [MLB 2025 World Series roster](https://www.mlb.com/press-release/dodgers-announce-2025-world-series-roster) (published 2025-10-24). Lineup/starting pitcher reference: [2025 WS Game 1 lineup](https://www.sportingnews.com/us/mlb/los-angeles-dodgers/news/dodgers-world-series-roster-full-26-man-los-angeles-2025/7ba1363ba0c421ee17cc87bc).
- Fixed lineup data committed to `docs/match-fixtures/2026-10-14-tbd-home-lad-2025.json`. Year 2025 is **provisional until user chooses a season**. TBD SS (Rai-poa) and Li Jiangjun's .305 are also provisional.
- Prototype numerical ratings for LAD are **estimates**, not official player statistics; TBD NLB-relative displayed numbers are not an absolute 200–250 input mapping. No league-name ability multiplier.
- Fixture orientation: team index 0 LAD/away/top; index 1 TBD/home/bottom. Manager control defaults TBD. Game starts at top 1st, LAD leadoff Shohei Ohtani vs TBD starting pitcher Ti-ka-o. TBD leadoff Nichiro leads off bottom 1st vs LAD Blake Snell.

## v18 browser work product

The executable self-contained `ばせぼーるlv18_TBD_vs_LAD.html`, source `kneekura-browser-core-v18.js`, full `v18_tbd_lad_roster.json`, browser build script and independent tests are distributed in the associated chat's downloadable artifact archive (not in this repository due to large embedded approved player masks).

- Keeps the v16-approved B1 PNG-derived character masks, four cameras, Japanese font, pitch symbols, 4px grid and approved ball rasterization function intact.
- Adds ball-only alpha interpolation between 55ms observations with a transparent overlay at approximately 27.5ms display cadence; **does not add canonical ticks**, change physics decisions, or promise 120fps on 60Hz devices.
- Maps all nine field positions per team instead of borrowing v17 fictional defensive roster mapping.
- Adds per-player prototype inputs for bat control, contact and power; pitcher control, actual-velocity caps, restricted pitch arsenal; bad-ball swing-path preservation modifies geometric timing/barrel error only when reachable out-of-zone without changing chase policy.
- A playable 9-inning and shorter test mode; manager controls, count, runners, inning score, replay and seeded reproduction. Native core, full adjudication and official persistence are **NOT** connected.
- No external network required by standalone HTML after distribution. Actual offline Android/iOS hardware compatibility and file persistence are **NOT RUN**.

## New repository Presentation module

- `src/presentation/mini/BallDoubleCadence.ts` exports `MINI_BALL_DOUBLE_CADENCE_MICROS=27500` and pure `buildDoubleRateBallVisualSamples()` using existing presentation sample contract.
- `BallDoubleCadence.test.ts`: midpoint location, boundaries, missing ball, no canonical mutations, invalid sample ordering. `src/presentation/mini/index.ts` exports it.
- Local standalone TypeScript typecheck PASS using `tsc --strict --noEmit` with copied matching minimal types; local compiled CommonJS behavior assertions PASS. **Full repository npm verify or GitHub CI NOT RUN.**

## Measured v18 receipt (local sandbox)

- Browser causal slice: **65 seeded complete nine-inning matches**, 16,449 pitches, 5,778 plate appearances; source headless checks **71 PASS, 0 FAIL**.
- Source invariants checked: unique pitch ticks, score per inning conservation, player role assignments, pitcher max velocity cap, seed command determinism, restricted arsenal, bad-ball swing-path interpretation and altered causal geometry only.
- Chromium 1440px desktop and 390px mobile viewport: four cameras, next-pitch, start/stop, new game, 9-inning finish PASS; uncaught JS exceptions 0. No physical phone test.
- Approved B1 mask literal, sprite palette, pitch symbol code, ball rasterizer and embedded font bytes exact SHA-256 unchanged from v17. The new ball-only rendering pass does change the presentation infrastructure intentionally.
- Measured 65-game runs LAD 646/TBD 485. This browser simulation is still **un-calibrated against real MLB or intended NLB distributions**. Do not interpret these results as canonical league-strength proof.

## Unverified acceptance gates

1. Latest `codex/current-nonvisual-owner-integration-2026-10-08` real Native Match Core all-game 9-inning through official records and replay, including LAN01 genuine whole case, is not yet fully validated.
2. Native source adapter from official physical snapshots to this browser presentation not yet built. v18 still uses the self-contained v17-derived prototype simulation.
3. Browser persistence/IndexedDB with crash-safe save/resume and multi-device owner/spectator synchronization not implemented.
4. PC native quality tier vs mobile production quality tier and actual-device performance, battery/thermal tests NOT RUN.
5. Opponent-specific calibrated pitcher/batter profiles and TBD match-engine true 200–250 absolute skill mapping remain provisional.

Next core work: typed Native sample adapter (without fake outcomes), genuine official full-match gate, then parity test on desktop and phone. Preserve original v16 PNG/B1 masks and keep pixel-player JSON experiment archived.
