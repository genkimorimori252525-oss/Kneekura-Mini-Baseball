# Field Body Model Implementation Plan

> **For agentic workers:** Use subagent-driven-development for independent owners. Steps use checkbox tracking. The user's direct V105 instruction authorizes the previously presented body-model scope; do not request that approval again.

**Goal:** 身長と実身体/肩/手/目を共通化し、同じ到達域で動く通常試合とメーカーを納品する。

**Architecture:** 共通geometry helperで寸法/姿勢/証明を解決し、Core motor/forecast/throwが利用。通常/練習の入口で身長を保持し、frameのcanonical poseをカメラとログへ透過する。

**Tech Stack:** existing TypeScript/Vitest/JS browser bridge/esbuild/Playwright runtime。新依存なし。

**Spec:** `docs/design/2026-10-23-v105-field-body-model.md`

## Global Constraints

- 元JSON/旧v104を上書きしない。7つの任意内部値は未指定時だけ解決、明示編集だけ保存。
- 新公開能力なし、旧gloveReachを肩の腕長へ直接転用しない。
- 実接触/保持だけでcatch、Source優先、Presentation読取専用。
- 平面移動/回避/PNG/4px/音声/表示周期を継承。Sourceframe時刻でログと目を観測。
- legacy Core入力はbody model省略時に旧経路を保持。新規型/値はoptionalでundefinedを明示しない。
- 係数は暫定、MLB較正/全身IK完成と主張しない。

## Review Focus

- ゴロに屈めること。肩球へ移すだけで地面球を失わない。
- 腕の連続到達、姿勢変更による手の瞬間補正なし。C1送球開始位置/速度を保持。
- 立ち直りとtransfer/chargeを予測/実行で重複加算しない。
- 元JSON再importで新値が残留しない。身長変更と未指定表示が連動する。
- cameraの目とSource頭が一致、旧framefallback/bench継続/巻戻しを維持。

## Task 1 — common geometry (root)

- [x] pure helper/typesとRED unit tests：寸法解決/互換、ground/air/rear、姿勢step、連続reach証明、throw手/立ち直り。
- [x] bounded helper実装、関連unitを機械receiptで記録。

## Task 2 — actual Core and forecasts (body worker)

Files: LiveFieldPlayV1, LiveRelayPlanV1, LiveDefenseControlEstimateV95, LiveDefensiveOpportunityV1必要箇所、関連tests。

- [x] 身体profile/poseを保持し、高さ別reachと捕りやすい身体位置を同じhelperで選ぶ。
- [x] 速度制限付き屈み/向きとglove区間を証明。捕球/送球のC1境界と実接触を保つ。
- [x] 観測runner/relay/HR上界/保持者の立ち直りを共通化。
- [x] 小柄/長身、地面/頭上/後方、真の未到達、捕球から実送球の統合tests。

## Task 3 — authoring and shared inputs (maker worker)

Files: LivePhysicalRosterV1/LiveBaseballMatchV1/LiveFieldInputV95/FieldPracticeWorkbenchV98/browser exports、catalog/help/field-workbench UI、関連tests。

- [x] 7任意scalar、bounds/omit-reset、height伝播と解決済み値表示。新catalogv105、元catalog保存。
- [x] 人間/AI編集・保存・取消・JSON・近傍エラー。単位/比率/legacy由来を平易に解説。
- [x] 表示Sourceframeのpose/reachログ、他19人保持、公開能力/得能独立tests。

## Task 4 — pose observation and standalone generation (view worker)

Files: LiveFieldFrameConversionV98, live-field-gaze-v99, field-practice-renderer-v98、新v105builder、関連tests。

- [x] actor optional bodyPose透過、footアンカー維持、renderer/gazeのcanonical eye優先と旧fallback。
- [x] V104近接視線はeye velocityも使い、V102正面送球/安全hold/bench/巻戻しを検証。
- [x] fixedv104 presentationから新Core+必要seam+版名のみのnormal、fresh maker/labを生成。実入力hash/provenanceを記録。

## Task 5 — integration/review/release (root)

- [x] serial relevant tests/tsc、実Chrome PC1200/390×3と身長/腕/屈み編集、実contact/Sourceeye/ログ一致、JSON保存取消。
- [x] 指定ニッチローRF・ゴロ・中継・未到達の実証、同じ条件の生成時間/solver work測定。
- [x] 独立reviewの重要指摘を修正、旧HTML/JSON保持を確認し新3HTMLを配置。
- [x] FAIL/UNKNOWNと旧残件を保持して最終verification文書/CCG checkpoint。

Shared checkoutで責務を分け、他者の編集を戻さない。commit/pushは行わない。

実施結果: docs/verification/releases/v105/README.md。Task1のhelperとcoreは同一workerが所有し、rootは統合/実ブラウザ/証拠/配置を担当した。Task5のレビューで予測姿勢・向き直り・極端寸法の初期姿勢を修正。元のFAILと残件は同READMEへ保存。生成は新候補3から9ファイル、GitHub判断記録は既存PR #380へ1コメントのみ。ソースpush/mergeなし。
