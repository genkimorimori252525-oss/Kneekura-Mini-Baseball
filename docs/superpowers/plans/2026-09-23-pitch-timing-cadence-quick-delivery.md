# Pitch Timing / Cadence / Quick Delivery Implementation Plan

更新日: 2026-09-23  
状態: **IMPLEMENTATION PLAN — 実装前**  
対象: Shared Match Core（Mini / Natural 共通）  
非対象: UI、描画、4pxグリッド、具体的なスプライト制作、カメラ調整

## Goal

投手の「次の投球をいつ始めるか」と「始動してからいつリリースするか」を別々の正史時間として持ち、通常投球・クイック・意図的な間・自然な微小揺らぎを因果的に再現する。

この時間は、将来以下へ同じ正史値から接続する。

- 盗塁 / 帰塁 / 牽制との時間競争
- 打者の投球リズム予測とタイミング適応
- 緩急○ / 変幻自在のEvidence
- Pitcher POV / Batter POV の投球フォーム表示
- リプレイ / Presentation timeline

Trait名やUI表示を原因にして結果を直接補正しない。

---

## Canonical Design Decisions

### 1. 投球時間を最低3区間へ分離する

```text
previous play / ready
      ↓
[ A: pre-pitch start interval ]
      ↓
motionStart
      ↓
[ B: motion-to-release ]
      ↓
release
      ↓
[ C: release-to-follow-through ]
      ↓
followThroughEnd
```

- **A = 投球始動間隔**
  - 前の投球 / プレイ後から次の投球動作を始めるまで。
  - 「テンポよくぐいぐい投げる」「長く間を取る」は主にここへ現れる。
- **B = 投球動作時間**
  - motionStart から release まで。
  - 通常フォームとクイックで別の基準値を持つ。
  - 盗塁側が主に参照する投手時間。
- **C = 投球後動作時間**
  - release から followThroughEnd まで。
  - 盗塁成立の直接時間には加算しない。
  - 投手守備復帰 / Presentation / motion continuity 用に保持する。

### 2. QUICK と DELIBERATE は別軸

```text
DeliveryMode
- NORMAL
- QUICK

CadenceIntent
- STANDARD
- DELIBERATE
```

この2軸は排他的ではない。

したがって、

```text
長く間を取る
   ↓
突然 QUICK motion
   ↓
release
```

を正しく表現できる。

### 2.1 QUICK Gradeは厳密に単調とする

Underlying Source Stateは `quickSpeedFactor` とし、

```text
quickSpeedFactor = NORMAL duration / QUICK duration
```

で定義する。

したがって:

```text
G -> F -> E -> D -> C -> B -> A -> Gold
slow ---------------------------------> fast
```

を**必須invariant**とする。

- Gに近づくほど motion-to-release duration は長くなる。
- Aに近づくほど motion-to-release duration は短くなる。
- Gold / 走者釘付はAよりさらに速い上位Tier。
- Grade projection thresholdは重ならず、逆転を許さない。
- D付近をneutral source state（`quickSpeedFactor ≈ 1.0`）の基準候補とする。
- G extreme = `quickSpeedFactor = 1 / 1.8`（NORMALの1.8倍の時間）。
- A extreme = `quickSpeedFactor = 1.8`（NORMALの1/1.8の時間）。
- Gold extreme = `quickSpeedFactor = 2.5`（NORMALの1/2.5の時間）。

B〜Fのexact thresholdはCalibrationだが、**単調性はCalibration対象ではなく設計契約**とする。

### 2.2 Battery authorityと緩急○を分離する

緩急○ / 変幻自在はBatteryの配球主導権を奪わない。

Pitch call（球種・コース・目的）とCadence plan（いつ始動するか）を別Decisionとして持つ。

```text
PitchCall
  pitch family / target / tactical purpose

CadencePlan
  start interval / deliberate hold / rhythm manipulation
```

Batteryの主導関係に応じて責任を分ける。

#### CATCHER_LED

捕手の要求に従うBattery:

```text
catcher game-calling
 -> PitchCall
 -> pitcher accepts call
 -> pitcher cadence skill chooses legal timing around that accepted call
 -> delivery
```

この場合、投手の緩急○は:

- 捕手が要求した球種 / コースを勝手に変更しない。
- accepted PitchCallを維持したまま、投球始動間隔・DELIBERATE hold・テンポ変化を使う。
- 「緩急○を使いたいから捕手の配球を上書きする」を禁止する。
- 捕手の配球意図を壊さない範囲で、投手本人のtiming knowledgeを使う。

#### PITCHER_LED

捕手が投手の要求に従うBattery:

```text
pitcher sequencing decision
 -> PitchCall
 + pitcher cadence decision
 -> catcher receives / supports call
 -> delivery
```

この場合、投手は:

- 球種 / コース / sequenceの選択
- 投球始動間隔
- DELIBERATE hold
- rhythm change

を一つの投球戦術として組み合わせられる。

ただし緩急Trait自体が球種を魔法的に選ぶわけではない。PitchCallは通常のpitch-selection / scouting / game-plan / battery decisionを通す。

#### NEGOTIATED / MIXEDへの拡張

将来、shake-off / sign negotiation / game-plan overrideを入れても、

```text
who owns PitchCall?
who owns CadencePlan?
```

を別々に解決する。

片方の能力やTraitがもう片方の決定を暗黙に上書きしてはならない。

### 2.3 Battery conflict invariant

以下を禁止する。

```text
CATCHER_LED
+ catcher requests slider away
+ pitcher 緩急○
 -> fastball insideへ勝手に変更
```

以下を許可する。

```text
CATCHER_LED
+ catcher requests slider away
+ pitcher 緩急○
 -> slider away remains fixed
 -> pitcher changes only start interval / hold timing
```

および:

```text
PITCHER_LED
+ pitcher decides slow pitch -> fastball sequence
+ pitcher also manipulates cadence
 -> catcher follows that call
```

### 3. 自然揺らぎと意図的な遅延を分離する

自然な機械感回避:

```text
natural timing deviation <= ±50 ms
```

意図的に集中して間を取る場合:

```text
deliberate extra hold = +100 ms ～ +400 ms
```

この +100～400 ms は ±50 ms の自然揺らぎとは別成分とする。

### 4. 「今日のテンポ」と毎球揺らぎを分離する

各投手登板について小さな outing bias を一度決め、その上で毎球の micro jitter を加える。

ただし、

```text
abs(outingBias + pitchJitter) <= 50 ms
```

を保証し、自然揺らぎ合計がユーザー承認範囲を超えない。

### 5. 緩急○ / 変幻自在は「球質Buff」ではなく、間を使って打者の予測を崩す技術

このFamilyのSource of Truthは、**投球間隔を意図的に変える判断・技術と、打者の準備タイミングを崩すための効果的な瞬間を選べること**とする。

禁止:

```text
緩急○を持つ
 -> 次のストレートのvelocity / spin / movement / rise感を物理的に強化

遅い球の次にストレート
 -> 自動でfastball quality上昇

緩急○
 -> 打者を「不意を突かれた状態」に強制

緩急○
 -> 打者能力 -5 / 空振り率 +10%
```

採用:

```text
batter observed cadence history
        ↓
batter expectation / preparation
        ↓
pitcher reads context and chooses an effective timing change
        ↓
intentional start-interval change
        ↓
batter actually observes it
        ↓
cadence surprise (or no surprise)
        ↓
recognition / preparation / swing timing
        ↓
normal pitch + contact simulation
```

重要:

- 同じストレート入力なら、緩急○の有無で **球速・回転・変化量・release geometry・BallFlightを変えない**。
- 打者が変化を読んでいた / 適応していた場合、緩急○でもsurpriseが小さい、ゼロ、または逆効果になり得る。
- 「遅い球の後だから次の直球が強くなる」という結果保証はしない。
- pitch-speed separationそのものは通常の球速差として打者timingへ因果的に効き得るが、**緩急○ / 変幻自在のTrait Sourceには含めない**。
- 「間がバラバラ」なだけでは緩急上手と判定しない。
- Evidenceは intent / timing choice / execution accuracy / observed cadence surprise / batter adaptation を分離して保持する。

### 6. 既存Traitとの責任境界

- **クイック A〜G / 走者釘付**
  - set-position motion-to-release speed factor と repeatability のProjection。
  - Trait labelから時間を速くしない。
  - underlying quick techniqueは通常フォーム時間に対する連続倍率で表し、表示Gradeはそこから投影する。
  - G側は最大で通常より **1.8倍遅い duration**、A側は最大で **1.8倍速い motion**、Gold「走者釘付」は最大 **2.5倍速い motion** を上限とする。
- **緩急○ / 変幻自在**
  - intentional cadence manipulation / effective timing choice / batter timing-disturbance Evidence のProjection。
  - pitch-speed separationはこのTraitのSourceにしない。
  - 単なるrandom varianceでは成立させない。
- **球速安定**
  - pitch velocity variance / reproducibility。投球間隔とは別。
- **リリース○**
  - pitch-type間のform / release差。クイック時間とは別。

---

# Architecture

```text
Pitcher timing source state
        │
        ├─ base start interval
        ├─ normal motion-to-release
        ├─ quick motion-to-release
        ├─ follow-through duration
        ├─ cadence execution control
        └─ quick repeatability
        │
        ▼
PitchTimingIntent
  DeliveryMode + CadenceIntent
        │
        ▼
PitchTimingResolver
        │
        ├─ outing bias
        ├─ pitch micro jitter
        ├─ deliberate extra hold
        └─ deterministic RNG
        │
        ▼
Canonical PitchMotionTimeline
        │
        ├─ motionStart
        ├─ legLift / gather marker
        ├─ stride marker
        ├─ release
        └─ followThroughEnd
        │
        ├──────────────► Runner / steal timing
        ├──────────────► Batter observed cadence
        ├──────────────► Sequencing Evidence
        └──────────────► Presentation observer
```

Presentationは timeline を読むだけで、Core timingを決めない。

---

# Data Contracts

## PitchTimingProfile

新規候補:

```ts
type PitchTimingProfile = Readonly<{
  baseStartIntervalUs: number;
  normalMotionToReleaseUs: number;
  followThroughUs: number;

  quickSpeedFactor: number;
  cadenceExecutionControl: number; // 0..1
  cadenceTimingKnowledge: number;  // 0..1
  quickRepeatability: number;      // 0..1

  normalPhaseWeights: PitchMotionPhaseWeights;
  quickPhaseWeights: PitchMotionPhaseWeights;
}>;
```

時間値は整数microseconds。

`quickSpeedFactor` は表示TraitではなくUnderlying Source Stateであり、QUICK時の基準時間を:

```text
quickTargetDurationUs = normalMotionToReleaseUs / quickSpeedFactor
```

として導出する。

境界:

```text
G-side slow endpoint:
  duration <= normal × 1.8
  speedFactor >= 1 / 1.8

neutral region:
  speedFactor ≈ 1.0

A-side fast endpoint:
  speedFactor <= 1.8

Gold / 走者釘付:
  speedFactor <= 2.5
```

B〜F等の中間Gradeを直接倍率へ変換するのではなく、連続的なSource StateをGradeへ投影する。これにより `クイックAだから1.8倍` ではなく、実際のquick techniqueが高いためAとして表示される。

能力値は直接成功率ではなく、目標時間・timing choice・execution error幅 / 再現性へ作用する。

## PitchTimingIntent

```ts
type PitchTimingIntent = Readonly<{
  deliveryMode: 'NORMAL' | 'QUICK';
  cadenceIntent: 'STANDARD' | 'DELIBERATE';
}>;
```

Timing intent itself contains no pitch-family / location override.

## BatteryPitchDecision

Battery coordination is a separate contract:

```ts
type PitchCallAuthority =
  | 'CATCHER_LED'
  | 'PITCHER_LED'
  | 'NEGOTIATED';

type BatteryPitchDecision = Readonly<{
  authority: PitchCallAuthority;
  acceptedPitchCallId: string;
  timingIntent: PitchTimingIntent;
}>;
```

`acceptedPitchCallId` references an already-resolved legal PitchCall. The timing resolver may consume it for provenance, but **must not mutate the call**.

In `CATCHER_LED`, cadence planning is constrained to the accepted catcher call.
In `PITCHER_LED`, the pitcher-side decision system may choose both PitchCall and cadence before this resolver is invoked.

Count / leverage / runner / emotion が intent をどう選ぶかはDecision layerの責任とする。

Timing resolver が「3ボールだから必ずDELIBERATE」のような隠れAIを持たない。

## PitchMotionTimeline

```ts
type PitchMotionTimeline = Readonly<{
  readyAtUs: number;
  motionStartUs: number;
  gatherEndUs: number;
  strideStartUs: number;
  releaseUs: number;
  followThroughEndUs: number;

  deliveryMode: 'NORMAL' | 'QUICK';
  cadenceIntent: 'STANDARD' | 'DELIBERATE';

  startIntervalUs: number;
  motionToReleaseUs: number;
  deliberateExtraHoldUs: number;
  naturalDeviationUs: number;
}>;
```

Presentationへframe番号を渡さない。

Presentationはmarker時刻を使って2～4コマ目等の表示滞在時間を決める。

---

# Implementation Order

## Task 1 — Timing primitive と validation

**Create**
- `src/core/sim/pitch/PitchTimingModel.ts`
- `src/core/sim/pitch/PitchTimingModel.test.ts`

実装:

- integer microsecond duration helper
- `PitchTimingProfile`
- `PitchTimingIntent`
- `PitchMotionPhaseWeights`
- validation
  - duration > 0
  - QUICK duration may equal normal but cannot be negative
  - phase weights > 0
  - phase weight sum normalization is deterministic
  - control / repeatability in 0..1
  - quick source-state / grade projection is strictly monotonic: G < F < E < D < C < B < A < Gold in speed

Acceptance:

- invalid profiles fail fast
- no float accumulated clock is authoritative
- all generated durations remain safe integers

---

## Task 2 — 独立した deterministic RNG stream

**Modify**
- `src/core/rng/SeedRoot.ts`
- `src/core/rng/SeedRoot.test.ts`

`CorePhase`へ `pitch_timing` を追加する。

理由:

- pitch timingの乱数draw数を増やしても
  - pitch physics
  - batting
  - contact
  - baserunning
  - fielding
  のRNG sequenceを変えない。

Acceptance:

- same seed + same playId + same input -> identical timeline
- timing draw countを増やしても既存phase RNGは不変

---

## Task 3 — Outing bias と自然揺らぎ

**Create**
- `src/core/sim/pitch/PitchTimingVariation.ts`
- `src/core/sim/pitch/PitchTimingVariation.test.ts`

実装:

1. `outingBiasUs` を登板単位で一度生成
2. pitchごとに `pitchJitterUs` を生成
3. 合計自然偏差を clamp

恒久invariant:

```text
-50_000us <= naturalDeviationUs <= +50_000us
```

重要:

- deliberate holdをこのclampへ含めない
- natural varianceが大きいだけで緩急Evidenceを増やさない

Acceptance:

- 10,000 deterministic samplesでも自然偏差が±50msを超えない
- outing biasは同一outing内で固定
- pitch jitterはpitchごとに変化可能
- same seedで完全再現

---

## Task 4 — DELIBERATE hold

**Create**
- `src/core/sim/pitch/PitchCadenceIntent.ts`
- `src/core/sim/pitch/PitchCadenceIntent.test.ts`

`cadenceIntent === DELIBERATE` の場合のみ:

```text
100_000us <= deliberateExtraHoldUs <= 400_000us
```

を追加する。

重要:

```text
startInterval
 = baseStartInterval
 + outingBias
 + pitchJitter
 + deliberateExtraHold
```

DELIBERATEは motion-to-release を自動的に遅くしない。

つまり、

```text
長く持つ + QUICK
```

が成立する。

Acceptance:

- STANDARDでは deliberateExtraHoldUs = 0
- DELIBERATEでは100～400ms
- QUICK + DELIBERATEを同時指定可能
- deliberate holdが±50ms自然揺らぎbudgetを消費しない

---

## Task 5 — 通常投球 / QUICK motion-to-release

**Create**
- `src/core/sim/pitch/PitchMotionTimeline.ts`
- `src/core/sim/pitch/PitchMotionTimeline.test.ts`

ResolverはdeliveryModeに応じて基準時間を決める。

```text
NORMAL
  -> normalMotionToReleaseUs

QUICK
  -> normalMotionToReleaseUs / quickSpeedFactor
  -> add natural deviation within ±50 ms
```

QUICKにもTask 3で定義した自然揺らぎをそのまま使用する。QUICK専用の別random幅を作らない。

Source-state boundary:

```text
G extreme:
  max duration = NORMAL × 1.8

A extreme:
  min duration = NORMAL / 1.8

Gold / 走者釘付 extreme:
  min duration = NORMAL / 2.5
```

中間のB〜Fはcontinuous quick source stateの途中をGrade Projectionする。Grade文字をresolverへ入力しない。

重要:

- QUICK Trait labelを入力しない
- 実際のquick source state / actual durationがSource of Truth
- runnerがいるだけで自動QUICKにはしない
- QUICKを選択するのはDecision layer
- QUICKは投球始動間隔を短くする能力ではない
- DELIBERATE cadenceとQUICKは同時成立可能

Acceptance:

- G extremeでNORMALの最大1.8倍までmotion-to-releaseが遅くなり得る
- A extremeでNORMALの最大1.8倍までmotion-to-releaseが速くなり得る
- Gold extremeでNORMALの最大2.5倍までmotion-to-releaseが速くなり得る
- QUICK自然揺らぎは±50ms以内
- 同じprofileでdeliveryModeだけ変えた比較が可能
- QUICKがstart intervalを勝手に短縮しない
- long hold + quick deliveryが再現できる

---

## Task 6 — Motion phase markers

`PitchMotionTimeline`へフォーム内markerを生成する。

初期marker:

```text
motionStart
gatherEnd
strideStart
release
followThroughEnd
```

NORMAL / QUICK は別々のphase weightを持つ。

原則:

- Core markerはPresentation frameそのものではない。
- **4コマ投球フォームへ接続する際、時間変化を許可する表示コマは2～4コマ目だけ**とする。
- 1コマ目の表示時間をQUICK / cadence補正で伸縮させない。
- motion-to-releaseの時間差はPresentation adapterが2～4コマ目の滞在 / 遷移時間へ配分する。
- QUICKでは主にrelease前のphaseを短縮する。
- release markerは `motionStart + motionToRelease` と厳密一致。
- follow-through短縮を盗塁時間へ加算しない。

Acceptance:

- markerが常に単調増加
- release位置がmotion-to-releaseと完全一致
- NORMAL / QUICKでphase配分を変えられる
- rendererなしで全て計算可能

---

## Task 7 — 盗塁 / 走者への接続contract

**Create**
- `src/core/sim/pitch/PitchRunnerTimingFacts.ts`
- `src/core/sim/pitch/PitchRunnerTimingFacts.test.ts`

出力:

```ts
type PitchRunnerTimingFacts = Readonly<{
  motionStartUs: number;
  releaseUs: number;
  pitcherReleaseLatencyUs: number;
}>;
```

将来の盗塁計算はTrait gradeではなくこれを読む。

```text
runner jump / acceleration / distance
            VS
pitcher release latency
+ catcher receive / transfer
+ throw flight
+ tag
```

このTaskでは盗塁成功率を実装しない。

Acceptance:

- QUICKの差が実時間としてrunner-sideへ伝わる
- `クイックA -> steal -X%` の直接補正が存在しない

---

## Task 8 — Batter cadence history / 「間」の緩急

**Create**
- `src/core/sim/pitch/PitchCadenceHistory.ts`
- `src/core/sim/pitch/PitchCadenceHistory.test.ts`

重要: batterはCanonical motionStartを直接読むのではなく、最終的にはPerception layerの `ObservedPitchStart` を入力とする。

初期のparameter-lightな期待値:

- 直近の観測済み start interval を保持
- 十分な履歴がある場合、直近3区間のmedianをbaseline expectationにする
- `cadenceSurpriseUs = actualObservedInterval - expectedInterval`

ここでは打率 / 空振り率を変更しない。

出力:

```ts
type CadenceSurprise = Readonly<{
  expectedIntervalUs: number | null;
  observedIntervalUs: number;
  surpriseUs: number | null;
}>;
```

将来:

```text
surpriseUs
+ batter rhythm dependence
+ timing adaptability
+ recognition quality
        ↓
swing preparation / decision timing
```

へ接続する。

Acceptance:

- 同じ間を繰り返すとsurpriseは小さくなる
- 意図的な長いholdでsurpriseが発生する
- random varianceだけで「緩急○」を自動付与しない
- Canonical Truth直読みを要求しないAPIにする

---

## Task 9 — Sequencing Evidence

**Create**
- `src/core/sim/pitch/PitchSequencingEvidence.ts`
- `src/core/sim/pitch/PitchSequencingEvidence.test.ts`

保存候補:

```ts
type PitchSequencingEvidence = Readonly<{
  deliveryMode: 'NORMAL' | 'QUICK';
  cadenceIntent: 'STANDARD' | 'DELIBERATE';
  intendedHoldChangeUs: number;
  realizedHoldChangeUs: number;
  cadenceSurpriseUs: number | null;
  pitchSpeedBand?: string;
  pitchFamily?: string;
}>;
```

目的:

`緩急○ / 変幻自在` の将来Projectionへ、以下をEvidenceとして渡せるようにする。

- intentional cadence manipulation
- effective timing choice
- cadence execution reproducibility
- batter's actually observed cadence surprise / adaptation

**pitch-speed separation / pitch familyそのものは緩急TraitのSourceから外す。** 球速差・球種差は通常のPitch Physics / batter recognitionで独立して効く。

禁止:

```text
large random variance -> 緩急○
DELIBERATEを選んだ回数 -> 緩急○
```

Intentと実行と相手への実際のタイミング差を分離して残す。

---

## Task 9.5 — Battery PitchCall / Cadence arbitration

**Create**
- `src/core/sim/pitch/BatteryPitchDecision.ts`
- `src/core/sim/pitch/BatteryPitchDecision.test.ts`

Responsibilities:

1. Receive an already-legal `PitchCall`.
2. Record who owns the call: `CATCHER_LED / PITCHER_LED / NEGOTIATED`.
3. Resolve cadence separately.
4. Never let `PitchTimingResolver` mutate pitch family / target / tactical purpose.

CATCHER_LED:

```text
catcher call
 -> accepted PitchCall
 -> pitcher cadence choice constrained around that call
```

PITCHER_LED:

```text
pitcher chooses PitchCall
 + pitcher cadence choice
 -> catcher follows accepted pitcher call
```

Acceptance:

- CATCHER_LEDで緩急○を有効にしてもPitchCall IDが変化しない。
- CATCHER_LEDでもstart interval / deliberate holdは変化可能。
- PITCHER_LEDではpitch-selection layerが配球とcadenceを同じ戦術意図から作れる。
- cadence resolver単体はpitch type / locationを書き換えられない。
- catcher game-calling skillとpitcher cadence skillが同じ変数を二重補正しない。
- authorityを変更しても同じaccepted PitchCallを与えた場合、Timing Physics以外のBallFlight入力は不変。

---

## Task 10 — Count / leverage / pressure Decision adapter

Timing physicsへ状況判断を埋め込まない。

別Decision layerから:

```text
count
leverage
runner threat
pitcher tendency
pressure appraisal / emotion
game plan
        ↓
PitchTimingIntent
```

を作る。

初期Context hook:

- 3-ball count
- full count
- high leverage / pinch context
- runner on first / steal threat

これらは**DELIBERATE / QUICKを強制しない**。

「候補を選ぶ理由」になるだけ。

これにより:

- フルカウントでもテンポを崩さない投手
- ピンチで慎重になる投手
- ピンチほど急ぐ投手
- 長く持ってから突然クイックする投手

を同じ仕組みで表現できる。

Decision engineが未実装の場合、このTaskはpure adapter contract + fixtureまでとし、Timing resolver側へ状況ロジックを漏らさない。

---

## Task 11 — Trait Projection boundary

Player Trait systemへ以下のread-only projection sourceを公開する。

### Quick family

入力候補:

- set-position actual motion-to-release distribution
- quick repeatability
- relevant sample count

出力:

`クイック G〜A / 走者釘付`

ただし表示Traitはsimulationへ戻さない。

### Cadence manipulation family

入力候補:

- intentional cadence manipulation
- effective timing-choice quality
- cadence execution accuracy / reproducibility
- opponent's actually observed timing disturbance
- repeated-use adaptation evidence

明示的に入力しないもの:

- fastball velocity
- pitch spin / movement
- 「遅い球の次に直球を投げた」という事実だけ
- pitch-speed separationだけ
- batterへ強制した surprise flag

出力:

`緩急○ / 変幻自在`

Trait grade / labelをPitchTimingResolverへ入力するコードは禁止。

---

## Task 12 — Presentation observer contract

**Presentation側は別作業。ここではread-only contractのみ。**

Coreが返す:

- motionStart
- gatherEnd
- strideStart
- release
- followThroughEnd

Presentationは:

```text
actual timeline
      ↓
frame 1 = timing補正対象外
frames 2–4 = 表示滞在 / 遷移速度だけ調整
      ↓
4コマ投球フォーム
```

とする。

**可変対象は必ず2～4コマ目のみ。** 1コマ目をQUICKや緩急の速度合わせに使わない。

重要:

- 絵が投球時間を決めない
- 物理 / Coreは連続・正史
- スプライトのバット等と同じく、見た目はobserver
- 55ms presentation cadenceでCore時刻を丸めない

この計画では描画実装・UI接続を行わない。

---

# RNG / Determinism Rules

- `Math.random` 禁止
- `Date.now` / wall clock禁止
- timing RNGは `pitch_timing` streamのみ
- outing bias seedとper-pitch jitter seedを識別可能にする
- Presentationの有無でtimelineを変えない
- 同一seed / play / player source / intentで完全再現する
- Trait projectionを変更してもcanonical timingが変わらない

---

# Adversarial Tests

最低限以下を追加する。

1. **Machine-like repetition**
   - variance 0 profileでは完全固定も可能。
   - 通常profileでは自然揺らぎが出るが±50msを超えない。

2. **Serious pitch**
   - DELIBERATEの追加時間が必ず+100～400ms。
   - natural jitterと混同しない。

3. **Runner on first**
   - runner存在だけでQUICKを強制しない。
   - QUICK intent時だけquick motionを使う。

4. **Long hold + quick**
   - 10秒相当のstart interval + short motion-to-release等を表現できる。

5. **Bad quick pitcher**
   - quick baselineが遅い / repeatabilityが低い投手を表現できる。
   - Trait labelなしで成立する。

6. **Randomly erratic pitcher**
   - cadence varianceが大きくてもsequencing mastery扱いしない。

7. **Rhythm artist**
   - intentional cadence changes + effective choice + actual timing surpriseをEvidenceとして残せる。

8. **Batter anticipation**
   - 打者がタイミング変更を読んでいる場合、緩急○でもsurpriseを強制生成しない。
   - 「次はストレート」と待っている打者へ、Traitを理由にfastball qualityを強化しない。

9. **Batter adaptation**
   - 同じ変化を繰り返すとobserved baseline側が更新され、同じ手が永久に効き続けない。

10. **No fireball mutation**
    - 同一のPitch Physics入力なら、緩急Trait / cadence skillの有無でvelocity・spin・movement・BallFlightが完全一致する。

11. **Quick grade endpoints**
    - G extreme = duration最大NORMAL×1.8。
    - A extreme = duration最小NORMAL/1.8。
    - Gold extreme = duration最小NORMAL/2.5。
    - いずれも自然揺らぎは±50ms以内。

12. **Frame 2–4 only**
    - 4-frame Presentation adapterではframe 1 durationを変更せず、2～4だけがtimeline差を吸収する。

13. **Presentation isolation**
    - rendererを削除してもtimelineが同一。

14. **RNG isolation**
    - pitch timing draws追加でcontact / fielding RNGが変わらない。

15. **Quick monotonicity**
    - every representative source sample satisfies G < F < E < D < C < B < A < Gold in speed.
    - no threshold overlap can make F faster than E or B slower than C.

16. **Catcher-led conflict**
    - catcher-requested PitchCall is immutable after acceptance.
    - pitcher cadence skill may alter timing only.

17. **Pitcher-led sequencing**
    - pitcher-owned PitchCall and cadence may be planned together.
    - catcher compliance does not duplicate or reapply cadence effects.

18. **Authority separation**
    - changing `PitchCallAuthority` alone never changes pitch physics when accepted call + pitcher execution inputs are identical.

---

# Suggested Commit Sequence

1. `feat: define canonical pitch timing contracts`
2. `feat: add isolated pitch timing rng stream`
3. `feat: add deterministic pitch timing variation`
4. `feat: support deliberate holds and quick delivery`
5. `feat: emit canonical pitch motion timeline`
6. `feat: expose pitcher release timing facts`
7. `feat: model observed pitch cadence expectation`
8. `feat: record sequencing timing evidence`
9. `test: harden pitch timing causal boundaries`

各commit後に `npm run verify`。

---

# Definition of Done

この計画のCore実装完了条件:

- 投球始動間隔とmotion-to-releaseが別の正史値
- NORMAL / QUICKが別基準
- STANDARD / DELIBERATEが別軸
- ±50ms自然揺らぎが決定論的
- +100～400ms deliberate holdが別成分
- long hold + quickが可能
- actual release latencyを走者系へ渡せる
- observed cadenceからsurpriseを算出できる
- 緩急Traitは「意図的な間の操作 / 効果的timing choice」の技能としてEvidenceを受ける
- 緩急Trait / cadence skillは球速・spin・movement・BallFlightを一切変更しない
- 打者のsurpriseを強制せず、予測 / 適応次第で効果ゼロにもなれる
- QUICK sourceはG extreme NORMAL×1.8 ～ A extreme NORMAL/1.8、Gold extreme NORMAL/2.5の範囲を扱える
- G→F→E→D→C→B→A→Goldの速度単調性を必ず守る
- CATCHER_LEDでは捕手のaccepted PitchCallを緩急○が変更しない
- PITCHER_LEDでは投手が配球とcadenceを同じ戦術意図から計画できる
- PitchCall ownershipとCadence ownershipは別責任として扱う
- QUICKの自然揺らぎは既存±50msを共用する
- Motion phase markersがCoreから出る
- 4コマPresentationで速度変更するのは2～4コマ目だけ
- Presentationはobserverのまま
- UI / camera / sprite implementationは未接続
- same seed / same inputで完全再現
- existing `npm run verify` がPASS

---

# Non-Goals

今回やらない:

- 盗塁成功率の直接実装
- 捕手pop time / 二塁送球物理の完成
- 投球フォーム画像制作
- Pitcher POV / Batter POV画面修正
- Trait UI
- 特殊能力の色や表示調整
- 3ボール / フルカウント時の一律自動遅延
- 「緩急○だから打者弱体化」の直接Buff

これらはCore timingの正史値を利用する後続consumerとする。
