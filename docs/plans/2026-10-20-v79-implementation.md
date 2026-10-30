# 63コースとシーズン対応 Implementation Plan

> **For agentic workers:** Use the existing current checkout with separate file owners; root integrates and verifies. Follow superpowers:executing-plans principles and the shared contract below. User approved both recommended scope choices on 2026-10-20.

**Goal:** 内部63コース／公開zone内9、先天・今季・練習の分離とシーズン成績保存、5方向の打撃意図と公開分布を通常HTMLとメーカーへ接続する。

**Architecture:** 型付きの任意profileをLivePitchの予測・動作へ一回合成し、物理と裁定の後から小さい記録を作る。記録帳と学習は純粋な版付きreducer、ブラウザは同じreducerへ明示保存・読込を渡す。初期20人や旧省略のSource/RNGを変更しない。

**Tech Stack:** existing TypeScript/Vitest, plain browser JavaScript/HTML/SVG/Canvas, esbuild; new dependencies none.

**Spec:** [承認された確認案](2026-10-20-v79-course63-and-spray-review.md)

## Global Constraints

- Public9 is zone-only. Off-zone/off-grid are distinct records. Internal63 is c1..9/r0..6/id10c+r.
- Immutable physical truth; read-only charts; H/AB calculated from accepted scoring, no direct batting-average/HR RNG.
- Original profile, long-term delta, current-season delta, practice, and public H/AB are separate. Practice cannot change innate/public totals.
- Existing 17 traits/public base SI, measured swing catalog673, camera/gaze, V78.1 four pitcher charts are preserved.
- No settings/lockfile/secret, no user AGENTS changes. No broad normalization. Native certification is not weakened or claimed.
- All previous FAIL/HOLD/UNKNOWN and unfinished original plans remain. Original charter approval is still independently unconfirmed.

## Review Focus

1. Public9 must classify the raw continuous coordinate; 5x5 cells cannot be naively grouped into equal3x3.
2. A runner reaching a base is not automatically a hit; FC, errors and sacrifices need evidence; unresolved contributions remain pending.
3. Saved/imported/replayed games or season-close cannot duplicate learning. Failed input leaves state unchanged.
4. Default omission must preserve V78 Source and legacy RNG. A profile uses only perceived forecast, not future actual contact/result.
5. Season effects must not be applied twice when saving an already effective profile. Practice cannot enter public totals or innate formation.

## Shared interfaces

- `BatterCourseProfileV79.ts`: `BatterCourseProfileV79={version:'batter_course_profile_v79',referenceAverages:number[63],effectScale:number,directionWeights?:number[5]}`; `createNeutralBatterCourseProfileV79()`, `validateBatterCourseProfileV79(raw)`, `classifyBatterCourseV79({position,zone})` -> courseId/index/publicZoneId/insideStrikeZone.
- Profile cells are column-major10..16,20..26,...90..96. Public9 is top-left1..3/middle4..6/bottom7..9. Direction weights are fixed LF→RF; sum1; effectScale0..3.
- `LiveCourseScoringV79.ts`: `summarizeLiveIssuedPitchV79(record)` -> compact local summary; `createLiveGameStatisticsV79({gameId,seed,players,records,finished})` -> version local_course_game_v79, nativeAdmission false. Collect per-pitch summaries, not a huge clone of all world frames.
- `LiveSeasonV79.ts`: `createLiveSeasonStoreV79()`, `validateLiveSeasonStoreV79(raw)`, `reduceLiveSeasonStoreV79({store,command})`, `getLiveSeasonReportV79({store,seasonId,playerId})`, `deriveLiveCourseProfileV79({store,seasonId,playerId,profile?})`.
- Commands: create(seasonId,name), select(seasonId), record_game(seasonId,game), practice(practiceId,seasonId,playerId,courseId,attempts,quality), close(seasonId).
- Report: inside[9]/outside/offGrid tally(ab,h,hr,pending,average,color); spray{counts[5],ratios[5],homeRuns[5],total,fouls}; totals.
- `live-season-client-v79.js`: `KneekuraSeasonClientV79.create({core,storageKey,initial?})` -> getState/replaceValidated/validateState/command/subscribe/saveLocal/restoreLocal.
- Shared charts `course-charts-v79.js`: `KneekuraCourseChartsV79.renderPublic(container,report)` and renderSpray(container,{ratios,counts?,homeRuns?,total?,fouls?}).
- Maker `KneekuraBatterMakerV79` -> inspect/show/selectPlayer/getProfile/setProfile/getSeasonClient/assertNoPending; singleton `KneekuraCourseSeasonsV79` is shared with maker full JSON hook.

## Tasks

### 1. Profile, geometry and motor — v79_course_runtime

Files: new BatterCourseProfileV79.ts/.test.ts; LivePhysicalRosterV1.ts, LivePitchV1.ts and regression tests. root adds Host validator/export.

- [x] RED geometry63/all edges/public9 and strict inert profile validation.
- [x] Implement metadata-free omitted path; forecast-only course error scale (bounded .75..1.25) and independent direction-intent stream into measured motor.
- [x] GREEN: left/right, take/bunt, effectScale0/1, public/base unchanged, old Source/RNG/shape exact, no direct outcome correction.

### 2. Local scoring and seasons — v79_season_core

Files: new LiveCourseScoringV79.ts/.test.ts and LiveSeasonV79.ts/.test.ts.

- [x] RED AB/H/HR, strikeout/walk/catch/bunt/sacrifice/FC/first-touch and later stretch out, unknown evidence.
- [x] Implement compact summaries with source course provenance, public9 from final location, actual exit-angle sectors.
- [x] RED/GREEN strict season reducer, duplicate game/practice/close rejection, atomic invalid JSON, selected open/closed season behavior.
- [x] Verify AB0/1/10/100/large, K40/200, gradual bounded long-term update, practice only current-season, no double applied baseline.

### 3. Maker and charts — v79_maker_ui

Files: new baseball-maker-course-v79.js/.css, course-charts-v79.js and focused browser checks.

- [x] Click63 red→blue→gray; fine editing; physical/source validation; no initial20 mutation.
- [x] Five-sector intent percentages100, actual result chart separate, keyboard controls and hover help.
- [x] Season selector/create/save/load/practice/close; public9 H/AB/HR/unknown and outside counts. Same JSON validator in human/AI.
- [x] UI at1200/390; real save/file reload; dirty protections; invalid atomic behavior.

### 4. Shared client and normal match — root

Files: live-season-client-v79.js, live-season-match-v79.js, build-v79.mjs, base maker optional state hook, build-maker flags, index.ts/workbench-index.ts, minimal Host validator.

- [x] RED/GREEN client atomic import and explicit local storage. No auto restore.
- [x] New optional `courseSeasons` full-maker JSON; validate before mutation and rollback with existing library.
- [x] Match start snapshots the selected season's derived profile into execution players, without editing roster. Disabled mode preserves old players.
- [x] Each issued pitch projects a compact summary. Completed game is recorded once after actual result playback; active replays/comparison adapters never add stats.
- [x] Normal UI season panel, public player statistics, explicit season save/restore, roster import and new-game replay guards.
- [x] Session preservation: active game carries start snapshot; do not reapply current season effects to saved replay input.

### 5. Final integration — root

- [x] Relevant tests + full TypeScript; freeze Source before final Native/Maker build.
- [x] V79 normal + camera room + maker (including pitcher4views) self-contained. Hashes/pins consistent.
- [x] Baseline omitted V78 history exact; new profiles+season game9 innings with all compact records/totals audited; duplicate save rejected.
- [x] Real browser1200/390, course clicks/intent/season/training/close/file roundtrips/AI/invalid input, Source and public/base invariance.
- [x] Fresh whole-change review, one evidence-backed repair pass, record original FAIL and model limits.
- [x] Freeze artifacts, concise current spec/history/consultation. Save to existing branch/PR only within standing authorization; never merge main.

## Workspace ruling

Reuse the current non-main development checkout: it holds the verified V78.1 addition and V79 review documents. Copying a clean HEAD worktree would omit those accepted local changes. All owners have disjoint files; root never resets or stages unrelated files. Verification/build happen after shared Source is stable. CCG is the durable ledger; this checklist is updated at completed milestones.

## 統合証拠

Core・保存・メーカー・通常HTMLを接続した。最終browser/配布/公開の個別結果は docs/verification/releases/v79/README.md のreceiptと照合する。チェック済みの項目は今回の範囲だけを示し、元計画の全達成ではない。
