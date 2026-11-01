# Throw Effort Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for independent components and parent integration. Continue through validation without another scope confirmation. Steps use checkbox tracking.

**Goal:** 距離・肩力・走者期限に応じた力込めを共通送球計画へ接続し、メーカーとv103三HTMLを納品する。

**Architecture:** `planLiveThrowActionV103` が既存の空力指令探索に力込め時間と出力選択を加える。実行・中継・走塁予測が同じモデルを使い、発行済み命令だけを実行状態/表示へ渡す。既存の持替・手準備・誤差・裁定・v102カメラを継承。

**Tech Stack:** TypeScript / Vitest / existing browser bridge and vanilla JS / esbuild / existing Playwright runtime. New dependenciesなし。

**Spec:** `docs/design/2026-10-23-v103-throw-effort-proposal.md`。人間の直接回答 call_a3b8d7bac01c43e29fc3d2556630b8fa「うん。１でいいだろう」で全範囲承認済み。

## Global Constraints

- default full-charge `.60` seconds。optional `throwEffortBuildSecondsV103` は0〜5秒。
- capacityは正の有限値、選択した実指令は既存の有限空力対応範囲。100/120へのcapacity書換なし。
- 持替後の手準備とchargeを並行、同じ準備を二重加算しない。secure機会ごとのV101抽選は一度。
- PNG/4px/FPS/音声/カメラ/公開能力と得能の独立を維持。通常公開表示100まで。
- 同じ既存checkoutで所有ファイルを分ける。独立比較の目的がないため新worktreeを作らない。commit/push/破壊的操作なし。

## Review Focus

- 999の超capacityでも通常の低出力を選び、予測から0秒の超高速球を生まない。
- cancel/replan/receiver待ちでchargeをリセット・増殖・未来参照しない。
- cached forecastはcharge/build/physics/targetをkeyへ含め、現在の出力へ戻さない。
- 手準備完了eventがcharge未完了のreleaseを許さない。
- makerの値は保存・取消・欠落default・横幅390・入力横エラーに整合する。

## Task 1: Shared action and forecasts — owner v103_action_core

Files: new `LiveThrowActionV103.ts` / `.test.ts`, existing `LiveThrowPlanV1.ts`, `LiveRelayPlanV1.ts`, `LiveDefenseControlEstimateV95.ts` and tests.

Interface: `planLiveThrowActionV103({releasePosition,bodyVelocity,capacityMps,spin,physics,target,remainingTransferSeconds,handPreparationSeconds,chargeElapsedSeconds?,throwEffortBuildSecondsV103?,receiverReadySeconds?,deadlineSeconds?})`. planned result includes commandSpeedMps/effort/chargeSeconds/remainingChargeSeconds/releaseDelaySeconds/flightSeconds/controlSeconds/forecast/selectionReason. `deadlineSeconds=0` means earliest; omitted means routine least-effort. Effort energy proxy `(speed/capacity)^2`, default build `.60`。Legacy aero API without new selection retains prior semantics; preferred duration is freshly solved.

- [x] RED unit tests: duration/output tradeoff, 5/20/40/70/90m, raw999, impossible/finite budgets, same-position invariance.
- [x] Implement one bounded search (existing 100 solver evaluations, at most4 feasible flights), then use shared result in relay/control.
- [x] Add observed holder charge elapsed to source first leg; future hops start after receipt with zero charge.
- [x] Run related unit tests serially and review source/test evidence.

## Task 2: Issued state and actual release — owner root

Files: `LiveFieldPlayV1.ts`, new `LiveThrowEffortIntegrationV103.test.ts`.

Interfaces: optional fielder build seconds; diagnostics `throwEffortCommandsV103` issued rows with playerId/from/readyAt/chargeFrom/effort/commandSpeedMps/capacitySpeedMps/fullChargeSeconds/requiredChargeSeconds/plannedFlightSeconds/target/reason; separate cancellations with playerId/from/commandFrom/reason. Existing hand command remains camera authority. Observer/source exposes only charge elapsed known at snapshot time.

- [x] RED actual-release tests: charge gate, no extra RNG, no change to first catch, capacity999, frame-cadence deterministic, incomplete/error route handling.
- [x] Keep charge origin per secure custody, use shared direct/relay action, schedule release after both hand+charge. Re-solve actual hand/body pose with selected command cap and preferred flight duration.
- [x] Test force/tag/relay/first overrun and causal runner response; never edit result facts from planning.

## Task 3: Authoring and practice — owner v103_maker_ability

Files: browser physical schema/resolution/input/workbench/public descriptions and tests, new roster catalogv103, maker UI and field-workbench JS.

- [x] RED acceptance/default/roundtrip/independence tests. Add field0..5 and explicit source-preserving default. Old missing V101 width remains0.
- [x] Generic catalog editor with nearby Japanese error, tooltip, save/undo/cancel/reset. No new public ability.
- [x] Practice issued-prefix gauge and JSON log; exclude previous custody/cancelled commands and future payloads.
- [x] Browser edits/reimport and old original JSON verify.

## Task 4: Standalone release and final verification — builder worker + root

Files: new `build-throw-effort-release-v103.mjs`, verification/publish scripts and `docs/verification/releases/v103/`.

- [x] Use frozenv102 normal as presentation base, replace only Core + edition labels. Fresh maker/lab use current sources, preserving existing feature flags/audio/camera.
- [x] Build into new candidate; record actual source manifest/hash and byte-identical preserved presentation scripts.
- [x] Run related Vitest, `tsc --noEmit`, 13v102 gaze regressions, PC1200/390×3 actual Chrome, raw999/edit/gauge/actual release/world-prefix probes and bounded performance measurements.
- [x] Independent final source/evidence review; fix important findings, reverify affected paths, publish new3HTML and sidecars without replacingv102/JSON.
- [x] Record all RED/FAIL/UNKNOWN/legacy failures, evidence receipts and CCG checkpoint. Report changes, files, tests and limitations.

## Rulings / progress

- Scope and method already authorized by user; the skill's additional method/plan approval prompt is omitted to avoid requesting the same authorization twice.
- The `.60s` curve is provisional author tuning, not measured MLB latency. Calibration is tested within the approved comparison matrix.
- Previous v102 / original JSON remain frozen. Existing CCG Charter unapproved is separate from direct scope approval.
- Final evidence: `docs/verification/releases/v103/README.md`。関連138件（18filesの136PASS/2FAILと原因を明示したRF fixture4PASS）、gaze13、最終tsc、Chrome6cases、両幅authoring、配置9filesを確認。最終source/evidence独立reviewで重要指摘なし。各版1回の生成時間は465.7→545.7msでありFPS改善は主張しない。
