# Absolute Plate Vision 75–100 × Late Useful Evidence — 実装計画 v1

> 作成: 2026-10-26 JST
> 状態: **USER-APPROVED DESIGN DIRECTION / IMPLEMENTATION PLAN / NOT IMPLEMENTED**
> 対象: Kneekura Mini BaseballのMini/Natural共通の一つの因果的Match Core。
> 関連: [BAT](2026-10-16-batter-anticipation-intent-adaptive-swing.md) / [DIR](2026-10-16-batter-directional-intent-and-spray.md) / [SWG](2026-10-26-batter-swing-capacity-intent-context.md)。独立したBatter Belief・意思決定AI・Swing Controllerを新設しない。
> 監査対象: GitHub Nativeブランチ `jolly/tbd-lad-native-browser-core-2026-10-14` (HEAD `90dba70ba1a0b92840b303769e854047e725a317`)。設計書は `jolly/core-foundation-plan-2026-09-17` に置く。ローカル未push変更・最新統合状況は未監査。

## 0. 合意した設計

**選球眼はリーグ平均で変化しない絶対1〜100。1〜75は従来の働きを維持し、75を超えた分では投球の後半に得た情報を有効に処理・活用できる余地を滑らかに増やす。**

ただし、**『より長く球を見ることができる』と『打点を後方（捕手側）へ移す』は別物**。高選球眼だから待球型になる、スイング開始が一律に遅れる、強振・引っ張りが封じられる、といった仕様を禁止する。

- 選球眼1でも本人の意思と予測で初球強振・待球・引っ張りを選べる。選球眼100でも早めの準備・高速強振・前方打点を使える。
- 「初球は長打を狙う」「2ストライクでコンパクトに振る」は本人の長期方針・その打席の状況判断。すべての打者へ強制しない。
- 選球眼、ミート精度、反応時間、バット速度、積極性（Green）、悪球打ち技術、狙う方向（DIR）は同一能力にしない。
- 高選球眼には自動的な弱点・遅振り罰則を付けない。ただし実際に待ちすぎたときの物理的な差し込まれ・空振り・見逃しは自然に起こり得る。
- 既存の打球・接触結果へのHR率、安打率、四球率の直接加算は禁止する。
- 75はユーザーが指定した**追加効果の開始点**。実測による生理学的閾値でも「リーグ平均」でもない。

## 1. 現行ソース監査（確認済み）

| 箇所 | 調査事実・対応 |
| --- | --- |
| `src/integration/browser/LivePublicAbilitiesV1.ts` | 選球眼 `vision` は `mode:'absolute'`。現行表示1〜100、League previewでも `ABSOLUTE_1_TO_100`。編集時は `plateVision` と既存のコース認識誤差を扱う。従来仕様維持。 |
| `src/integration/browser/LivePhysicalRosterV1.ts` | `plateVision` は1〜100。`resolveLivePlateVisionV1` は明示値優先、未設定の旧データは従来のSI由来fallback。セーブ・編集・fallbackを変更しない。 |
| `src/integration/browser/ZoneRecognitionV87.ts` | 観測時刻、視覚的誤差・不確実性、63コース別プロファイルなどを扱う。観測情報の根拠と配達時刻を失わない。 |
| `src/core/world/psychology/batting/BattingObservationCalculation.ts` | 観測された時刻と利用可能になる時刻を分離する。 |
| `src/core/world/psychology/batting/BattingTiming.ts` | `selectPredictionAt` は判断時刻より前に届いた予測のみ選択。`resolveMotorStart` は判断+運動遅延、身体準備、望ましい開始時刻を守る。 |
| `src/core/world/psychology/batting/BattingCommitment.ts` / `BattingMotorPlanV1.ts` | TAKE/SWINGと時刻・Motor実行は別。`latestMotorStartTick` と実スイング上限がある。自由な途中再計画が完成済みとは確認できない。 |

**規約整合:** 旧BAT計画の説明には「選球眼＝リーグ文脈Projection」と読める箇所がある。今回の明示的なユーザー方針とNativeコードに従い、**選球眼だけは絶対1〜100**として計画し、実装時に旧BATの該当箇所へ注記する。Traitカタログや他の公開能力の査定法を無断変更しない。

## 2. 75〜100の滑らかな効果

選球眼の真Sourceから得た絶対値を `V` としたとき、後半情報活用の候補強度を以下の形で表す。

```text
x = clamp((V - 75) / 25, 0, 1)
lateEvidenceHeadroom = x*x*(3 - 2*x)  // smoothstep: 現時点での設計候補
V <= 75  →  0（旧挙動と完全互換）
V = 100  →  1（相対能力の上限）
```

- **これは時間・確率・Buffの単位ではない。** `+10ms`、`ミート率+X%` などに直接変換しない。処理遅延・利用可能な観測更新・推定品質等の因果的中間量への写像は実測・校正で決める。
- 75の境界に突然のジャンプを作らず、76以降を滑らかに変化させる。1〜75では現在と同seedで観測・判断・実運動・結果を変更しない。
- 現在の選球眼によるコース認識精度は1〜100で**そのまま残す**。75超は追加の後半情報活用余地であり、従来の認識効果を置き換えない。
- 既存 `plateVision` が編集可能な真正の絶対能力入力なら、その受理済みSourceから一度だけ派生。表示数値と既存認識誤差を独立した別Buffとして二重加算しない。

## 3. 時刻・物理・打撃意図の境界

次の時刻を別々に扱う：`observedTick`（見えた時刻）→ `availableTick`（情報到達）→ `decisionTick`（意思決定）→ `motorStartTick`（実際の運動開始）。さらに、姿勢・速度・加速度・減速・バット慣性・打点に応じた「今から実行できる限界」を検査する。

1. 高選球眼は後半の有用な観測を処理できる**可能性**を高めるが、すべての打者を遅い判断へ誘導しない。早期の予測・準備も許す。
2. 振るか見送るかは本人のBelief、狙い、積極性、カウント、監督指示から判断。見えた情報が遅れて届けば使えない。真の未来球道や相手の秘密PitchCallを与えない。
3. **引っ張りを保護:** PULL狙い、前方の打点、速い強振は選球眼に依存せず選択可能。新しく後半情報が届いても、現行の打点・軌道を自動的に捕手側へ移さない。
4. すでに始動した後の `cancel/check/brake/replan` は既存BATの運動制約に従う。間に合わないときは無理に停止・瞬間移動・必中にしない。
5. 同一意思決定と実Motorを固定した比較では、Vを高くしただけでバットが遅くなったり打点が後退したりしない。本人が遅い判断を**選択した**場合の現実的なリスクは残す。

## 4. 最小実装手順

1. 最新作業ツリー・並行ブランチ・Git未commit差分を保全して監査。`plateVision → 認識誤差/観測配達 → BatterPrediction → TAKE/SWING判断 → Motor → 接触` の実際の採用経路を特定。
2. 1/45/74/75の旧挙動のfixtureを固定する。旧saveからの絶対選球眼解決・メーカー編集・リーグ切替も含める。
3. 現在の真の認識Sourceに75超の後半情報処理余地を統合。独立したTraitや二重Beliefを作らず、追加性能は校正可能な処理時刻または情報品質のみに反映。
4. 既存 `selectPredictionAt`・BATの一つの意思決定境界に接続する。途中再計画の実運動がまだ未完成なら、その段階は `NOT CONNECTED` と記録し、独立した見た目だけの補正を作らない。
5. DIR/SWG/監督/Greenと物理的Contactの不変性を検証し、既存公開能力・保存JSON・再生系に副作用を出さない。

## 5. 受入試験（PLV-01〜16）

| ID | 合格条件 |
| --- | --- |
| PLV-01 | 1〜100を受理、0・101・非有限値を拒否、絶対尺度を維持。 |
| PLV-02 | 1/45/74/75は旧実装と同seed・同入力で観測/意図/物理結果が不変。 |
| PLV-03 | 75で追加利得0、76では微小、100で上限1。境界で不連続なし。 |
| PLV-04 | リーグ変更・比較母集団変更で選球眼値や今回の追加効果は変わらない。 |
| PLV-05 | 旧saveの `plateVision` 不在は従来fallback/provenanceを維持。 |
| PLV-06 | V=1でも自動的に早振り・強振になるわけではない。 |
| PLV-07 | V=100でも初球の速い強振・積極打法と共存できる。 |
| PLV-08 | V=95〜100でもPULL/前方打点の有効な接触を維持する。 |
| PLV-09 | V=95〜100でもOPPOSITE/CENTER/REACTIVEが選べ、方向固定なし。 |
| PLV-10 | 初球と2ストライクの好みが打者間で異なる（Green/Contextは保存）。 |
| PLV-11 | 情報到達前・未来球道・捕手私有PitchCallの参照不可。 |
| PLV-12 | Motor限界を超える遅い判断が瞬間始動・必中・不自然な停止にならない。 |
| PLV-13 | 同じIntent・MotorでVだけ上げても速度・打点が強制後退しない。 |
| PLV-14 | 高Vでも本人が遅い意思を選べば自然な失敗を許し、追加の固定Debuffなし。 |
| PLV-15 | 見極め利得を安打率・四球率・本塁打率の直接Buffに使わない。 |
| PLV-16 | 同seed再現、Mini/Natural共通Core、画面FPS非依存、BAT/DIR/SWG/既存テストを維持。 |

## 6. 完了・非対象

**完成条件:** 75以下は従来のまま、75超は到着した後半情報を物理的に使える範囲で活用しやすくなり、引っ張り・強振・個人方針を保持。実試合の決定論的観測→判断→Motor→接触への接続が確認できた場合のみ `IMPLEMENTED/VERIFIED` と記載。

**非対象:** 一律の打点後退、全員のスイング時刻遅延、新しい公開能力/特殊能力、未来情報の全知、物理に無関係な結果Buff、旧データ一括再査定、数値根拠がない固定ms利得。
