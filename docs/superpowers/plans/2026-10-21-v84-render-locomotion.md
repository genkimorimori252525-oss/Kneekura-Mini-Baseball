# v84 描画と人間らしい移動 Implementation Plan

> **For agentic workers:** Use the assigned parallel ownership below. Tasks use TDD and end with focused verification. 人間は短い既存フロー置換案と打球追加2倍を2026-10-21に明示承認済み。このファイルは実装チェックリストであり再承認は不要。

**Goal:** 全体目標描画頻度2倍・投球追加2.5倍・打球追加2倍、縦横解像密度1.2倍、軽量な発進/制動/切返しへ置換し、通常HTML・調整室・メーカーへ反映する。

**Architecture:** v83のHR見送りを基準にv81性能改善とv82メーカー復帰を保持。Native/hostの封印されたDefenderMotion契約を変更せず、live専用の共通速度profileと制御を使う。予測と実移動の能力/制動値を合わせ、裁定は実際の接触のみを使う。左右支持の平均化近似と既存画像の距離同期を採用し、全身関節物理を追加しない。

**Tech Stack:** existing TypeScript/Core, Canvas, esbuild, Vitest, headless Chrome/Playwright-core, offline HTML.

**Spec:** `docs/ai-continuity/AMENDMENTS/2026-10-20-v83-render-and-human-locomotion.md` と2026-10-21の人間回答。

## Global Constraints

- 目標通常55/6ms、自由投球22/6ms、自由打球55/12ms。全sceneで同じ表示時刻。RAF/実機上限と目標を区別。
- 画質1.2は4px→10/3px相当の空間細分化。1.0は旧画素一致。PNG原本/色/構図/UI/ボール物理寸法/表示倍率/全673/既存cache維持。
- v83の1750ms HR見送り、v82の削除取消/日本語補正/個性編集を継承。
- 加速能力aを上限とした3速度帯: 0–.25 vmax=a、.25–.65=.7a、.65–1=.35a。既定制動=1.8a、横踏ん張り=a。明示指定値があれば優先。未実測校正の近似と明記。
- Source形式/旧Native API/裁定/新規能力候補/依存/設定/lockfile/secret/user AGENTSを変更しない。生成物は人間の依頼範囲内。
- 元Charter承認HOLD/Native認証/100試合校正/実機/元計画残件・旧FAILUNKNOWNを保持。

## Review Focus

- 旋回・反転・stopAfterで位置/速度が連続し、停止時に反転振動しない。
- 回避とフェンス停止の証明が新しい推進/制動/横加速上限と一致する。
- 到達予測をOUT/SAFEへ昇格せず、実触塁/保持からのみ裁定する。
- 小数格子のdepth/遮蔽/重なりが全layerで一致し、品質1.0では旧RGBAが一致する。
- 同時刻の物理は描画頻度に依存せず、再読込/逆seek/保存/スマホ幅でも破綻しない。

### Task 1: 共通profileと制御（locomotion_audit_v83）

**Files:** 新 `src/core/sim/locomotion/LiveLocomotionV84.ts/.test.ts`。

**Interfaces:** `createLiveLocomotionProfileV84`、`livePropulsionAccelerationV84`、`liveAccelerationDistanceV84`、`liveAccelerationTimeV84`、`liveReachableSpeedV84`、`buildLiveSpeedPlanV84`、`stepLiveDefenderMotionV84`。Planは既存runner形式の定加速度区間。stepは{acceleration:Vec2,stopAfter?,phase}。

- [x] 発進帯/能力上限/制動/横踏ん張り/急反転/境界/不正入力/区間積分のRED。
- [x] 解析速度帯、軽量step、連続停止を実装。既存DefenderMotionは不変更。
- [x] focused Vitest GREENとSource凍結通知。

### Task 2: 走者・ETA（runner_motion_v84）

**Files:** `LiveRunnerMotionV1.ts`、`LiveRunnerRetreatMotionV1.ts`、runner advance policy と対応tests。

- [x] 新profileと実触塁/距離反転/過走/旋回/退却/成立不能nullのRED。
- [x] 経路は維持し速度区間だけ共通helperへ。能力/technicalSkills/旋回半径を維持。
- [x] ETAと実動作の一致、位置速度連続、focused GREENを確認。

### Task 3: 守備・予測・回避（root）

**Files:** 新 `LiveFieldArrivalV84.ts/.test.ts`、`LiveFieldPlayV1.ts`、`LiveFieldRoleAssignmentV1.ts`、`LiveFielderAvoidanceV1.ts` と対応tests。

- [x] 旧一定加速ETAとの差、新制動/急反転・回避上限・実motor接続のRED。
- [x] role/intercept ETAを同速度帯に統一。共通stepでlive bodyを動かし、stopAfterを保持。
- [x] 回避の停止予備距離/候補上限/フェンス/駆抜けを同profileに接続。
- [x] 既存守備ハーネス・触塁・役割・衝突回避の回帰。旧加速=制動の期待値だけ根拠を示して更新。

### Task 4: 描画・足運び（render_rate_audit_v83）

**Files:** 新 `presentation-render-controls-v84.mjs`、`presentation-cadence-v84.mjs`、`live-actor-stride-v84.js` とtests、v84 maker/lab adapters。

**Interface:** `KneekuraPresentationControlsV84.configure({frequencyScale,qualityScale})/inspect()`、共有interval計算。全成果物同一設定。

- [x] cadence倍率/同時刻/1.0格子/1.2各layer/depth/距離同期/逆seekのRED。
- [x] 整数セルから小数格子境界を生成し、1.0旧観測保護。全scene更新。
- [x] 既存足画像を移動距離で同期。新pose/PNGなし。Source凍結通知。

### Task 5: 統合・通常HTML・検証・保存（root）

**Files:** 新v84 builder、`build-maker.mjs` opt-in、通常/lab/maker配布、検証/設計/CCG記録。

- [x] 共通moduleの全owner接続後、Coreと3HTMLをビルド。
- [x] TSC、関連Core/Presentation回帰、通常9回完走/保存/触塁/裁定、maker v82機能/673/得能回帰。
- [x] 品質1.0旧RGBA、1.2幾何/遮蔽、PC/390・DPR1/2。目標/実FPS/計算負荷を別報告。
- [x] 最終Source/HTML hash、再生成、凍結、GitHub保存。mainはマージしない。

## 実測と残件

実装・3成果物・GitHub保存は検証済み。全場面の実FPS2倍は未達。headless参考で打者準備54→101、投手投球30→21 FPSとなり、高密度CPU描画の最適化は後続事項として保持する。元CharterHOLD・100試合校正・Native認証・実機・元機能残件は今回で完了しない。
