# Causal Contact and Individual Defense Design

更新日: 2026-09-17
状態: 設計承認済み。実装前。

## 1. 目的

Mini Baseball の試合Coreを、結果先決めではなく物理的・因果的な野球シミュレーションとして統一する。

本仕様では次の二点を恒久原則として固定する。

1. 打球は「ゴロ・フライ・安打」などの結果を先に抽選して作らず、投球とバットの衝突から初期打球状態を生成し、その後を3D物理で進める。
2. 打球後の守備は中央司令型AIではなく、各選手が自分の知覚・経験・能力・事前方針・味方から得た情報をもとに個別判断する。

Mini Baseball と将来の Natural Baseball は、原則として同じ試合Coreを使用する。Natural側が3D描画を持つことを理由に、別の打球物理や別の守備意思決定を持たせない。

---

## 2. バット・ボール接触の正史モデル

### 2.1 結果先決めを禁止する

Core は次のような処理を禁止する。

```text
contact
  → 35% ground ball
  → 22% line drive
  → 43% fly ball
  → それらしい軌道を生成
```

代わりに、投球状態とスイング状態から衝突を計算する。

```text
PitchWorldState(t)
  +
BatterSwingState(t)
  ↓
BatBallContact
  ↓
BattedBallInitialState
  ↓
3D Ball Physics
  ↓
Canonical Ball State / TimedMatchEvent
```

`ground_ball`、`line_drive`、`fly_ball` などの分類は、必要なら物理結果から派生して記録・統計・デバッグへ使用する。分類値を軌道生成の原因にしてはならない。

### 2.2 PitchWorldState

接触時の投球は最低限、以下の正史情報を持つ。

```ts
type PitchWorldState = {
  position: Vec3;
  velocity: Vec3;
  spin: Vec3;
  time: SimulationTime;
};
```

球種名は物理入力そのものではない。球種に応じて生成された位置・速度・回転が衝突へ渡される。

### 2.3 BatterSwingState

スイングは最低限、以下を表現する。

```ts
type BatterSwingState = {
  batPose: BatPose;
  batVelocity: Vec3;
  batAngularVelocity: Vec3;
  swingStartTime: SimulationTime;
  intent: BatterIntent;
};
```

打者能力・意図・認識は、スイング開始時刻、軌道、速度、面の向き、再現性などの中間量へ作用させる。

`ミート +10` のような能力値を、接触後の安打率へ直接加算しない。

### 2.4 BatBallContact

バットは3D上の簡略化された棒または円柱に近い剛体として扱う。

接触時には最低限、以下を評価する。

- 接触時刻
- 接触点
- バット芯からの距離
- バット面・局所法線の向き
- ボールとバットの相対速度
- バット角速度
- 有効反発係数
- 接線方向の摩擦

概念上:

```text
relative velocity
+ contact normal
+ impact offset
+ restitution
+ tangential friction
+ bat angular motion
        ↓
post-contact linear velocity
post-contact spin
```

これにより、打球初速、打ち出し角、左右方向、回転を同じ接触から生成する。

### 2.5 変形シミュレーションは正史Coreへ入れない

バットのしなり、ボールの圧縮、縫い目の局所変形などを有限要素法や高自由度の変形体計算として正史シミュレーションしない。

理由は「変形計算は必ず非決定論になるから」ではない。決定論的に実装すること自体は可能である。

採用しない主な理由は次の通り。

- MiniとNaturalで異なる接触モデルを持つと、同じ入力から異なる打球が発生し得る
- 高自由度変形は決定論・性能・クロスプラットフォーム再現性の検証コストが大きい
- 自動試合と描画試合で別の物理経路を持つ設計を避けたい
- 試合結果の正史を一つに保つことを、局所変形の高精度化より優先する

必要な現実性は、有効反発係数、摩擦、バット形状、接触点、相対速度、回転伝達などを現実データへ合わせて校正することで担保する。

### 2.6 Mini / Natural 共通化

正史接触モデルは両製品で共通とする。

```text
Shared Match Core
  └─ Deterministic Bat-Ball Contact
          ↓
     BattedBallInitialState
          ↓
       Ball Physics
          ↓
Canonical World / Events
     ├─ Mini renderer
     └─ Natural 3D renderer
```

Natural Baseball が将来、視覚上のバット変形やボール圧縮を演出として描くことは許可する。ただしその変形アニメーションは正史の打球初速・回転・軌道を再計算してはならない。

---

## 3. 打球後の3D物理

接触から得た `BattedBallInitialState` を物理Coreへ渡す。

```ts
type BattedBallInitialState = {
  position: Vec3;
  velocity: Vec3;
  spin: Vec3;
  contactTime: SimulationTime;
};
```

物理Coreは段階的に以下を扱う。

- 重力
- 空気抵抗
- Magnus効果
- 風
- 地面衝突
- 反発
- 摩擦
- SurfaceProfile
- フェンス・壁との衝突

MiniのDrone-Art表示は、この正史 `(x,y,z)` を4px格子・高度サイズ・離散トレイルへ変換するだけである。

---

## 4. 守備は個人判断型とする

### 4.1 中央司令型を採用しない

打球後に中央AIが9人全員へ完全な命令を配布する設計を禁止する。

禁止例:

```text
Central Defense Planner
  → SS: ball handler
  → P: first-base cover
  → 2B: second-base cover
  → RF: backup
```

現実のプレーでは、事前の戦術・守備配置は監督やコーチが決められる一方、打球後の瞬間的な処理は各選手が自分で判断する。

### 4.2 監督の責務

監督・コーチ側がプレー前に決められるもの:

- DefensiveAlignment
- 前進守備
- 長打警戒
- バント警戒
- 牽制・走者警戒方針
- 打者傾向に対するシフト
- その他の事前戦術

これらは各選手の事前知識・初期位置・優先方針へ入力される。

打球後に監督が瞬時に9人へ完全な役割命令を送ることはしない。

### 4.3 Canonical World と Perceived World を分離する

Coreの正史世界は全状態を保持する。

```text
Canonical World
  ├─ ball truth
  ├─ runner truth
  ├─ defender truth
  ├─ match / rule truth
  └─ timed events
```

ただし各選手AIは全知ではない。

```ts
type PerceivedWorldState = {
  observedBall: ObservedBallState | null;
  observedRunners: readonly ObservedRunnerState[];
  observedTeammates: readonly ObservedDefenderState[];
  knownGameContext: KnownGameContext;
  prePlayPlan: PrePlayDefensivePlan;
  recentCommunication: readonly CommunicationEvent[];
  observationTime: SimulationTime;
};
```

各選手は `PerceivedWorldState` から意思決定する。

### 4.4 個人判断

各野手の概念フロー:

```text
visible / known state
+ pre-play plan
+ battedBallRead
+ situationalAwareness
+ positionSuitability
+ experience
        ↓
PerceivedWorldState
        ↓
candidate intentions
        ↓
individual decision
        ↓
DefensiveIntent
        ↓
movement / catch / throw / cover
```

同じ打球でも、選手ごとに認識時刻・予測・候補行動が異なってよい。

### 4.5 situationalAwareness の意味

`situationalAwareness` は中央AIの最適解へ従う速さではない。

主に以下へ影響する。

- 自分が主処理者かどうかを認識する時刻
- 他選手が処理可能だと判断する時刻
- 空いた塁のカバーを認識する時刻
- 中継・バックアップの必要性を認識する時刻
- 走者の動きを把握する時刻
- 送球候補を想起する速さ
- 状況変化に対する再判断の速さ

判断の遅れは正史時間として現れる。

例:

```text
一塁手がゴロ処理へ出る
        ↓
投手A: 0.10秒で一塁カバー必要と認識
投手B: 0.38秒で認識
        ↓
同じ走力でも到達時刻が変わる
```

### 4.6 通信は情報伝達であり中央司令ではない

将来的に野手同士の声・合図を `CommunicationEvent` として扱える。

```ts
type CommunicationEvent = {
  sourcePlayerId: string;
  kind: CommunicationKind;
  issuedAt: SimulationTime;
  content: CommunicationContent;
};
```

例:

- 「俺が行く」
- 「二塁」
- 「カット」
- 「バックアップ」

通信は受信者の `PerceivedWorldState` を更新する情報である。

受信した選手が必ず従うわけではない。距離、タイミング、認識、状況判断、矛盾する観測などにより判断が変わり得る。

### 4.7 再計画

全選手が毎tick完全最適化を行う設計にはしない。

再判断は、少なくとも以下のような意味のある状態変化で発生させる。

- 打球認識
- 他野手の処理確定を認識
- 捕球 / 落球
- ボールの大きなバウンド・方向変化
- 送球開始
- 走者の進塁 / 帰塁開始を認識
- 通信受信
- カバー対象が失われた / 新しく発生した

正確な再計画イベント集合は実装計画で固定する。

---

## 5. 決定論

個人判断型であっても、同一入力・同一シード・同一Coreバージョンなら同一結果でなければならない。

- 各選手の乱数ストリームは安定した識別子から分離する
- 選手評価順序で乱数系列が変化しない
- 同時イベントには明示的な決定論的tie-breakを持つ
- 描画FPS、Mini/Natural renderer、カメラ、表示補間は意思決定へ影響しない
- rendererは `PerceivedWorldState` を変更しない

MiniとNaturalで同じ正史プレーを描画した場合、捕球、送球、進塁、アウト、得点は一致する。

---

## 6. テスト方針

### 6.1 接触モデル

- 同じ投球・同じスイング・同じシードなら同じ `BattedBallInitialState`
- バット芯からの接触点だけを変えると、意図した方向へ初速・回転が変化する
- スイング時刻だけを変えると、接触点と打球方向が因果的に変化する
- バット速度だけを変えると、他条件一定で打球エネルギーが妥当な方向へ変化する
- rendererを変更しても接触結果は変わらない

### 6.2 Mini / Natural 境界

- 同一 `BattedBallInitialState` をMiniとNaturalへ渡しても、正史イベント列は一つだけ存在する
- Natural側の見た目上の変形演出を有効化してもCore状態は変わらない
- 描画OFFでも同一試合結果になる

### 6.3 個人守備判断

- 一塁手が打球処理へ出た時、投手が自分の認識から一塁カバーを選べる
- `situationalAwareness` だけを変更すると、身体能力ではなく判断開始時刻・候補認識が変化する
- 一人の認識が遅れても、他の8人の判断が中央司令によって自動修正されない
- CommunicationEvent が存在する場合と存在しない場合で、受信後の判断が因果的に変化し得る
- 同一入力・同一シードなら9人の意思決定イベント列を再現できる

---

## 7. Natural Baseball との移行方針

現時点でNatural Baseballが別の接触方式を持っていても、本仕様を将来の共有正史へする。

移行後の原則:

```text
Mini Baseball
Natural Baseball
      ↓
Shared Match Core
      ↓
Deterministic causal contact
Individual defender decisions
Canonical physics / rules
      ↓
product-specific presentation only
```

Natural側でのみ行うことが許されるのは、3Dモデル、アニメーション、視覚的な変形、カメラ、音響などのPresentationである。

試合結果に関わる接触・打球・守備・走塁・規則は共有Coreを正とする。

---

## 8. 今回確定した事項

- 打球は投球と3Dスイングの衝突から因果的に生成する
- バットは簡略化した3D剛体として扱う
- 接触点、相対速度、面方向、反発、摩擦から打球初速・方向・回転を生成する
- バット・ボールの高自由度な変形体計算は正史Coreへ入れない
- MiniとNaturalは最終的に同じ正史接触モデルを共有する
- Naturalの視覚的変形はPresentationに限定する
- 守備は中央司令型ではなく個人判断型とする
- 監督は主にプレー前の配置・戦術を決める
- Coreの全知状態と各選手のPerceivedWorldStateを分離する
- 味方の声・合図は将来CommunicationEventとして情報伝達できる
- 個人判断型でも決定論的リプレイを維持する

## 9. 未確定として残す事項

以下は本仕様の原則を変更せず、後続設計で数値・アルゴリズムを決定する。

- バット形状の具体的近似
- 有効反発係数・摩擦係数の校正値
- バット速度・角速度の能力モデル
- 投球とスイングの接触探索アルゴリズム
- Simulation Clock と接触イベント時刻の数値計算方式
- 同時イベントの一般tie-break規則
- PerceivedWorldStateの視野・遮蔽・認識誤差モデル
- CommunicationEventの聞こえ方・伝達遅延
- 守備個人AIの再計画イベント集合
