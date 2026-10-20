# v87 Course Display and Perception Implementation Plan

> Agentic workers: implement the approved scope with independent owned files; root integrates shared contracts and final HTML. Follow systematic debugging and evidence before completion.

**Goal:** Editable 13-region course maps, immediate previews, MLB2025 comparison, and separate 63-cell role perceptions connected through ordinary games and logs.

**Architecture:** Keep legacy V79 profiles and season stores readable. Add an optional V87 thirteen-average profile plus an independent optional role-perception profile. UI, simulation, and reports use shared classification/conversion helpers; generated HTML embeds verified MLB aggregates and the same compiled Core.

**Tech Stack:** Existing TypeScript/Vitest, plain JS/CSS/SVG, esbuild, Playwright, Python standard library. No new dependencies or config/lock changes.

**Spec:** `docs/design/2026-10-21-v87-course-display-perception-proposal.md`, approved directly in chat: 「この範囲で実装を進める（推奨）」.

## Constraints and review focus

- 63 means 9×7, IDs 10..96 with rows0..6, not 8×8.
- Public map: zones1..9, outside11..14, catcher's perspective. Preserve unknown positions and estimated crossing provenance.
- MLB2025 is reference only. Do not overwrite initial20 or game records; do not turn an average into a hit roll or perceptual percentage.
- Legacy JSON remains valid; edits preserve unrelated player and season data. Preview/draft/commit/undo are distinct.
- Default perception derives from existing abilities; optional hidden per-role controls are bounded and deterministic. No extra public ability.
- Test exact edges, zero AB, pending scoring, invalid/partial drafts, role time/plane separation, seed streams, manager constraints, and history tampering.
- Preserve frozen releases, source art/render controls, v86 recovery/traits/bats/cameras and known unresolved evidence.

## Task 1 — shared profiles, classification and season report (data owner)

- [x] RED tests for 13 regions, legacy conversion, optional physical field, zero/pending AB and V79 season backward read.
- [x] `BatterCourseProfileV87.ts`: `BatterCourseProfileV87` with version `batter_course_profile_v87`, 13 `referenceAverages`, `effectScale`, optional5 `directionWeights`; create/validate/classify/resolve helpers.
- [x] Export `createNeutralBatterCourseProfileV87`, `validateBatterCourseProfileV87`, `classifyPublicCourseV87`, `resolveBatterCourseProfileV87`, `expandBatterCourseProfileV87ToV79`, `projectBatterCourseProfileV79ToV87`.
- [x] `LiveSeasonCourseV87.ts`: `getLiveSeasonReportV87`, `deriveLiveCourseProfileV87`; preserve V79 store and event records, aggregate actual positions into13 including unknown/pending separately.
- [x] Physical optional `batterCourseProfileV87`; perception field registered through perception owner's validator. Export APIs from `index.ts` and `workbench-index.ts` (data owner sole writer).
- [x] GREEN targeted tests and TSC for owned changes, report exact interface before UI consumes.

## Task 2 — role perception and runtime (perception owner)

- [x] RED tests for bounded 63-cell roles, zero/default/edited biases, deterministic streams, no future observation.
- [x] `ZoneRecognitionV87.ts`: optional `zoneRecognitionV87` version `zone_recognition_v87`, optional batter/pitcher/catcher subprofiles, each63 `cells` with `biasXM`, `biasYM`, `uncertaintyScale`, `targetWeight`.
- [x] Export validate/default/recognize helpers; register with data owner. Default profile need not be materialized into initial rosters.
- [x] Integrate `LivePitchV1.ts` and necessary runtime input mapping: batter perceived forecast, catcher request/capture observation, pitcher intended vs executed course. Manual/manager location constraints remain effective.
- [x] Consume V87 author profile via shared helpers; maintain legacy execution when no V87 author edit is present.
- [x] Diagnostics `courseRecognitionV87`: role, source tick/plane, predicted/perceived position, 63ID, confidence/error, requested/selected course, reasons, ability and seed provenance. Actual crossing remains distinct.
- [x] GREEN runtime/traits/physics-targeted tests and TSC; no UI/builder edits.

## Task 3 — authoring maps and preview (UI owner)

- [x] RED browser/UI checks for live preview, explicit save/cancel, unchanged canonical until commit, per-region same layout and percentages.
- [x] `baseball-maker-course-v87.js`, `course-charts-v87.js`, `baseball-maker-course-v87.css`: central9+outside4 map; innate/adapted/public/MLB layers; five-direction proportional fill and direct selection.
- [x] Keep V79 browser global API compatible; use V86 local validation/draft-safe commit, preserve season/practice workflows and plain-language help.
- [x] Show hidden63 role settings in an advanced/AI section, using perception owner's schema; expose inspectable immutable preview state/log access.
- [x] Register normal-game chart rendering through the charts module and root adapter. No edits to shared TypeScript/index/builder.
- [x] GREEN PC/mobile browser checks, selection/draft/rollback/old JSON evidence.

## Task 4 — MLB data, build, integration, publication (root)

- [x] Audit/cache MLB2025 official zn01..09/11..14 + season source; retain URL/SHA, no duplicate player/zone, all pages, H/AB weighting and unknown10H/63AB. Ship compact aggregate, keep raw archive separate.
- [x] Confirm direction comparison denominator before adopting any sprayChart data; otherwise explicitly mark unavailable without fabricating a baseline.
- [x] Opt-in maker builder/releaseV87, normal game from frozenv84 presentation with rebuilt Core, course chart/source selection, updated player snapshots, workbench/lab embedding and logs.
- [x] Run relevant new/legacy tests, fullsrc TSC, v86 recovery, course/perception tests, nine-inning ordinary UI + saved reload + diagnostics; verify MLB never replaces player/game data.
- [ ] GitHub existing branch/PR380 publication check and final CCG checkpoint. Local freeze/source pins/rebuild byte equality completed; remaining risks and original FAIL/HOLD/UNKNOWN retained.
