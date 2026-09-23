# Player Rating / Trait Catalog — CANONICAL v1

更新日: 2026-09-22  
状態: **CANONICAL / DESIGN FROZEN v1。Trait Family / UI分類 / Lifecycle ClassのSource of Truth。実装前。**  
親設計: `docs/game-design/08-player-traits-design-seed.md`

## 1. 目的

08で確立した因果原則を、公開能力ランクと具体的Traitカタログへ落とす。

本書で参照するパワプロ系名称は、ユーザー提供の候補一覧を監査するための**参照ラベル**であり、Kneekura Mini Baseball の最終名称をそのまま確定するものではない。

各候補は最低限、次のいずれかへ分類する。

- **ADOPT**: 因果的に採用可能
- **REINTERPRET**: アイデアは残すが、直接Buff等を廃止し因果的に再解釈
- **MERGE**: 別Trait Family / Graded Family / Tierへ統合
- **MOVE**: Psychology / Career / Relationship / Role Suitability / Presentation等へ移す
- **REJECT**: Match Traitとして採用しない

---

## 2. 公開0〜100 / G〜S境界

| Rank | Public value | 基本意味 |
| --- | ---: | --- |
| S | 90〜100 | 極端に突出した水準 |
| A | 80〜89 | 一流 |
| B | 70〜79 | 明確に優秀 |
| C | 60〜69 | 平均より上〜良好 |
| D | 50〜59 | 基準域 / 標準 |
| E | 40〜49 | やや弱い |
| F | 20〜39 | 明確な弱点 |
| G | 0〜19 | 極端な弱点 |

### 2.1 LEAGUE_RELATIVE

- リーグ基準域は概ね50〜55付近を中心とする。
- 50 = 常に厳密な平均、とは固定しない。分布の歪み・対象能力・シーズン基準により多少ずれてよい。
- Sは「上位10%」等の順位ラベルではない。
- 0〜100はパーセンタイルではなく、リーグ基準からの能力差を圧縮したPresentation Projectionとする。
- 同じ真能力でもリーグ尺度が異なれば公開値は変わり得る。
- 一軍 / 二軍、守備位置、先発 / 中継ぎ / 抑えは原則として尺度変更ではなく比較フィルタ。

### 2.1.1 LEAGUE_RELATIVEのRating Contextは所属リーグに固定する

`LEAGUE_RELATIVE` のHeadline Ratingは、現在参加している大会ではなく、選手の所属リーグを評価文脈とする。

```text
ratingContextLeagueId = affiliationLeagueId
```

代表招集、大陸大会、国際クラブ大会、世界大会等への一時参加では再基準化しない。

例:

```text
domestic league Power S
  + national-team selection
  + international tournament
      -> Power S remains displayed
```

大会で相手が強くてもRatingをその場で下げない。実際の相手との能力差はMatch Coreの真能力・物理・Familiarity・Condition等から試合結果へ現れる。

異なる所属リーグの選手を同時に表示する場合、必要なら `[所属リーグ基準]` を添える。

世界共通比較が必要な場合は別Projectionを使用し、Headline Ratingを上書きしない。

実際の移籍で `affiliationLeagueId` が変わった場合のみ、新しいリーグ文脈へRating Contextを切り替える。移籍直後の新リーグ評価にはKnowledge / Fit uncertaintyを許す。

### 2.2 ABSOLUTE_PHYSICAL / SUITABILITY

同じG〜S境界を表示に再利用してよいが、0〜100の生成元は異なる。

```text
LEAGUE_RELATIVE
  true skill + league calibration
    -> 0..100
    -> G..S

ABSOLUTE_PHYSICAL
  physical / measurable values
    -> absolute projection
    -> 0..100
    -> G..S

SUITABILITY
  role-specific mastery / fit
    -> suitability projection
    -> 0..100
    -> G..S
```

Rank文字自体をMatch Coreへ入力しない。

---

## 2.3 同一Trait Familyは常に一つだけ表示・適用する

同じTrait Familyの段階・正負・Gold Tier・排他的Variantは共存しない。Familyは必ずしも単純な強弱順である必要はない。

```text
one Trait Family
  -> exactly one effective display state
```

例:

```text
盗塁G
盗塁F
盗塁E
盗塁D
盗塁C
盗塁B
盗塁A
電光石火 (Gold / Master Tier)
```

この中から同時に有効になるのは一つだけである。

したがって、

```text
盗塁A + 電光石火
盗塁A + 盗塁B
盗塁G + 電光石火
```

のような共存は禁止する。

Goldは「青Traitへ追加される別Buff」ではなく、同じFamilyの上位Master Tierである。

概念:

```ts
type TraitFamilyProjection = {
  familyId: string;
  effectiveStateId: string; // grade, named tier, or exclusive variant
};
```

具体的なFamily Definition側が、`G..A / GOLD / RED_EXTREME` のような順序Tier、または `FASTBALL_BIAS / BALANCED / BREAKING_BALL_BIAS` のような排他的Variantを定義する。

Named Blue / GoldのFamilyでも同じ。

例:

```text
パワーヒッター -> アーチスト
流し打ち -> 芸術的流し打ち
キレ○ -> 驚異の切れ味
ノビA -> 怪童
クイックA -> 走者釘付
盗塁A -> 電光石火
走塁A -> 高速ベースラン
送球A -> ストライク送球
ケガしにくさA -> 鉄人
対ピンチA -> 強心臓
```

上位Tierへ昇格した時点で下位表示は消える。

GoldのLifecycleはFamily Classを継承する。

- `GRADED_DYNAMIC` のGoldはSource State低下でA/B/...へ降格し得る。
- `LEARNED_MASTERY_PERSISTENT` のGoldはConsolidation済みMasteryとして原則消失・降格させない。

色がGoldだから一律に同じLifecycleとはしない。

重要なのは、同一原因を複数ラベルで二重計上しないことである。

## 2.4 Trait Familyには「順序Tier」と「排他的Variant」の両方を許す

同一Familyの状態は必ず一つだけ有効だが、すべてを「弱い→強い」の一本道へ並べる必要はない。

例:

```text
Ordered Tier Family:
  盗塁G ... 盗塁A -> 電光石火

Exclusive Variant Family:
  pitch approach
    FASTBALL_BIAS
    BALANCED
    BREAKING_BALL_BIAS
```

Condition Sensitivityも後者に近い。

```text
ConditionResponseProfile:
  EXTREME_SENSITIVE
  NORMAL
  STABLE
  MASTER_STABLE (鉄腕相当)
```

`EXTREME_SENSITIVE` は「能力が低い」ことを意味せず、好調時の上振れ・不調時の下振れが大きいProfileである。

## 2.5 Named Negative Extremeも同一Family内の排他的Tierとして扱う

同じFamilyにNamed Negative Traitが存在する場合、それもA〜G / Goldと排他的に扱う。

例:

```text
対ピンチ:
  RED_EXTREME  ノミの心臓
  G
  F
  E
  D
  C
  B
  A
  GOLD         強心臓
```

```text
two-strike adjustment:
  RED          三振
  RED_EXTREME  扇風機
```

`RED_EXTREME` は「Gへさらにデバフを重ねる」のではなく、そのFamilyの最下位Named Tierである。

したがって `対ピンチG + ノミの心臓` や `三振 + 扇風機` を同時適用しない。

内部表現は固定enumへ限定せず、Family Definitionが順序付きTierを持てる構造を優先する。

## 2.6 Trait Lifecycle Class — CANONICAL 2026-09-22

**Traitの色や名前からLifecycleを推測しない。**

`09-player-trait-catalog.md` のFamily DefinitionがLifecycle ClassのSource of Truth。
`53-player-development-trajectory-breakthrough-v1.md` や実装側が `ノビ` 等の個別名だけを見て独自ルールを作ることを禁止する。

概念:

```ts
type TraitLifecycleClass =
  | "GRADED_DYNAMIC"
  | "LEARNED_MASTERY_PERSISTENT"
  | "GREEN_SLOW_PREFERENCE"
  | "DYNAMIC_DESCRIPTOR"
  | "CAUSAL_NEGATIVE_DYNAMIC"
  | "RELATIONSHIP_CONTEXTUAL"
  | "CAREER_HISTORY_DESCRIPTOR";
```

### GRADED_DYNAMIC

Current Source Stateの段階Projection。G〜A、必要ならGold / Red Extremeまで**上下する**。

Canonical Graded Families:

投手:
- 対ピンチ
- 対左打者
- 打たれ強さ
- ノビ
- クイック

野手 / 捕手:
- チャンス
- 対左投手
- キャッチャー
- 盗塁
- 走塁
- 送球
- ケガしにくさ
- 回復

合計13 Family。

例:

```text
ノビ B -> ノビ A -> 怪童 -> ノビ B
盗塁 C -> 盗塁 A -> 電光石火 -> 盗塁 B
```

はSource Stateが実際に変化すれば可能。

Graded FamilyのGoldはCurrent Master Tierなので降格可能。

### LEARNED_MASTERY_PERSISTENT

練習 / 経験 / Coaching / self-discoveryから**本当に習得・ConsolidationしたNamed Blue技術**。

一度Consolidation完了したら、Career中は原則として消失させない。

例:
- 流し打ち
- カット打ち
- 粘り打ち
- バント○ / バント職人
- 守備職人 / 魔術師
- ブロッキング
- 代打○ / 代打の神様
- 技術習得型のNamed Blue / Gold Family

ただしPersistent Masteryは:

```text
永遠に同じ結果を出せる
永遠に身体能力を維持する
```

という意味ではない。

```text
learned technique remains
+ current physical / cognitive / health feasibility
+ current context
 -> actual execution
```

加齢や大怪我で身体性能が低下しても習得技術そのものは失わないが、現在の身体が許さなければ効果の発揮量は低下し得る。

Persistent Named Blueから派生するGold Masteryも原則persistent。

### GREEN_SLOW_PREFERENCE

本人の野球観 / Default Policy / Decision Preference。

能力Buffではなく、**Managerから特別な指示がない時に選びやすい行動**を表す。

例:
- 強振多用 / ミート多用
- 積極打法 / 慎重打法
- 積極盗塁 / 慎重盗塁
- 積極走塁
- 積極守備
- 速球中心 / 変化球中心
- チームプレイ○ / ×

GreenはSlow State。日々の結果や一回の命令で切り替えない。

### DYNAMIC_DESCRIPTOR

現在のPhysical / Technical / Statistical sourceを人間向けに説明するDescriptor。
「習得した青特」とは別物。

例:
- ラインドライブ
- ゴロピッチャー / フライボールピッチャー
- pitch-shape Descriptor
- 荒れ球

Source State / Evidenceが変われば表示も変わり得る。

### CAUSAL_NEGATIVE_DYNAMIC

赤 / Negative Family。原因Stateが改善・悪化すれば出現 / 消失 / 段階変化できる。

### RELATIONSHIP_CONTEXTUAL

○○キラー等。対象・Roster・Familiarity等が変化すれば有効性も変わる。

### CAREER_HISTORY_DESCRIPTOR

負け運等、Match Buffとして採用せずCareer historyから後付け表示するもの。

---

## 2.7 Trait Density Guard — No Trait Collection Inflation

Named Traitへ固定個数Capは置かない。

ただし通常Playerが長期CareerでNamed Blueだらけになる設計も禁止する。

Named learned Traitの取得には:
- sufficiently distinct source skill / behavior
- high consolidation threshold
- enough relevant repetitions
- finite training / coaching / playing opportunity
- Family consolidation / merge
- actual role exposure

を要求する。

同じ現象を細かく分解して複数Blueとして水増ししない。

**人生の有限時間・役割・Coaching Attentionが自然な取得上限になる。**

Long-run soakで以下をFailureとする:
- ordinary active Playersの大半が大量のNamed Blueを持つ
- aging aloneで全PlayerがBlueを単調累積して似たProfileになる
- same-source Traitが複数Labelとして重複取得される

具体的な平均個数 / percentileはCalibration。

---
## 3. A〜G型Trait Family

A〜G型Traitは一つの正負を持つFamilyとする。

| Grade | UI色 |
| --- | --- |
| A | 青 |
| B | 青 |
| C | 通常 |
| D | 通常 |
| E | 通常 |
| F | 赤 |
| G | 赤 |

対応する上位Traitが存在するFamilyでは、GoldをAより上のMaster Tierとして持てる。

### 3.1 投手 Graded Family

- 対ピンチ
- 対左打者
- 打たれ強さ
- ノビ
- クイック

### 3.2 野手 Graded Family

- チャンス
- 対左投手
- キャッチャー
- 盗塁
- 走塁
- 送球
- ケガしにくさ
- 回復

UI上のA〜Gが共通でも、内部source of truthはFamilyごとに異なる。

---

## 3.3 公開RatingとTraitが同じsourceを指す場合は一つの能力として扱う

公開0〜100 / G〜S RatingとTrait表示が同じ原因能力を要約する場合、それらを別能力としてMatch Coreへ入力しない。

```text
one source of truth
  -> optional public rating projection
  -> optional Trait projection
  -> one simulation effect
```

特に注意する候補:

- バント能力 ↔ バント○ / バント職人
- 盗塁能力 ↔ 盗塁A〜G / 電光石火
- 走塁能力 ↔ 走塁A〜G / 高速ベースラン
- 回復能力 ↔ 回復A〜G / ガソリンタンク
- 肩力 ↔ レーザービーム系
- raw power ↔ パワーヒッター / アーチスト

扱いはFamilyごとに決める。

- 盗塁 / 走塁等のA〜G Familyは、それ自体を人間向けの主要Skill Projectionとして扱える。別の「盗塁G〜S」をさらに重ねない。
- バントをHeadline Ratingとして表示する場合、バントTraitは同じBuntSkillから導出し追加Buffを持たない。UI上の重複が強い場合はどちらか一方をPrimary表示にする。
- レーザービームは肩力そのものではなく、送球速度・軌道・transfer等の特徴を説明するDescriptorであり、肩力を再加算しない。
- パワーヒッター / アーチストはraw power値そのものではなく、power swing時のlaunch / transfer技術を表す。raw powerと同じ原因だけで成立させない。

Presentation上で複数表示する場合も、「独立した長所が複数ある」と誤認させないdrill-down関係を持たせる。

# 4. 投手Trait カタログ

## 4.1 球質 / 軌道 / Release

| 参照候補 | 判定 | Kneekuraでの扱い |
| --- | --- | --- |
| **ノビ G〜A / 怪童** | MERGE | fastball movement / velocity retention / release等から導出するGraded Descriptor + Gold Tier。Canonical表記はG〜A、Aより上のGoldが怪童。`ノビ○`は使わない |
| 軽い球 / 重い球 / 怪物球威 | MERGE | **同一Pitch Contact Quality Family。** 軽い球=Negative、重い球=Positive、怪物球威=Gold。velocity・movement・approach angle等がcontact qualityへ与える実際の影響から導出し、Traitから打球を直接変更しない |
| ジャイロボール / ハイスピンジャイロ | ADOPT | spin axis / trajectory由来のPhysical Descriptor |
| ナチュラルシュート | REINTERPRET | fastballの恒常的arm-side runを表すNeutral Descriptor候補。青Buffとはしない |
| 真っスラ | REINTERPRET | fastballの恒常的glove-side movementを表すNeutral Descriptor候補 |
| 球速安定 | ADOPT | velocity variance / reproducibility Descriptor |
| キレ○ / 驚異の切れ味 | MERGE | breaking-ball movement quality / late movement / reproducibilityのFamily |
| 球持ち○ / ディレイドアーム | MERGE | extension / visibility / release deception Descriptor |
| リリース○ | ADOPT | pitch-type間のrelease差・form差の小ささ |

## 4.2 Command / Miss Pattern

| 参照候補 | 判定 | Kneekuraでの扱い |
| --- | --- | --- |
| 低め○ / 精密機械 | MERGE | low-zone command skill Family |
| 内角攻め / 内角無双 | MERGE | inside command skill Family |
| クロスファイヤー / クロスキャノン | REINTERPRET | release geometry + diagonal command technique |
| 一発 / 逃げ球 / 本塁打厳禁 | MERGE | **同一Dangerous Miss Family。** 一発=Negative、逃げ球=Positive、本塁打厳禁=Gold。失投時のlocation error distributionから導出 |
| 抜け球 | ADOPT | delivery failure時の特定方向へのmiss pattern |
| 乱調 | ADOPT | command / release reproducibilityの短期的高variance |
| 四球 | REINTERPRET | raw controlとは別に、zone entry / nibbling / count behaviorから生じるwalk-prone特性。制球との二重計上禁止 |
| ボール先行 / ストライク先行 | MERGE | **同一Early-count Approach Variant Family。** BALL_FIRST / NEUTRAL / STRIKE_FIRST等の排他的Behavior。command能力そのものとは分離 |
| シュート回転 | MOVE | **原則Neutral pitch-shape Descriptor。** side movement自体を欠点扱いしない。意図せぬ抜け・release errorは別Negative Traitで表現する |

## 4.3 Sequencing / Put-away / Context Execution

| 参照候補 | 判定 | Kneekuraでの扱い |
| --- | --- | --- |
| 緩急○ / 変幻自在 | MERGE | **intentional cadence manipulation（投球始動間隔の意図的操作）+ effective timing choice** のFamily。打者の予測・準備timingを実際に崩す技能として扱い、球速・spin・movement・BallFlightを直接強化しない。pitch-speed separationそのものはTrait Sourceに含めず、単なるrandom timing varianceでも成立させない。**BatteryのPitchCall主導権を尊重し、CATCHER_LEDではaccepted PitchCallを変更せず間だけを操り、PITCHER_LEDでは通常のpitch-selection層で配球とcadenceを統合計画できる。** Intent / execution / observed cadence surprise / batter adaptation Evidenceから投影する |
| 奪三振 / ドクターK | REINTERPRET | two-strike put-away pitch selection / execution Family |
| 対強打者○ / 主砲キラー | REINTERPRET | 強打者ラベルによるBuffではなく、高難度相手へのDecision / pressure response / learned matchup |
| 要所○ | REINTERPRET | Pressure / High-Leverage Familyへ統合候補。MatchImportance / Appraisalと同じ原因を二重適用しない |
| 安全圏○ | MOVE | Pressure / Psychology側へ。独立Traitとして必要か再検討 |
| ギアチェンジ | REINTERPRET | opponent/contextに応じたeffort allocation / pitch usage |
| 完全燃焼 / 全開 | MERGE | max-effort output上昇とfatigue costが不可分なTradeoff Family |
| 力配分 | ADOPT | output節約とfatigue savingのTradeoff / Behavior |

## 4.4 Stamina / Role / Readiness

| 参照候補 | 判定 | Kneekuraでの扱い |
| --- | --- | --- |
| 根性○ / ド根性 | MERGE | fatigue下でのmechanical execution resilience。疲労そのものを消さない |
| 尻上がり / 終盤力 | MERGE | pacing / late-game quality maintenance |
| スロースターター / 立ち上がり○ / トップギア | MERGE | **同一Early-game Readiness Family。** Negative / Positive / Goldを排他的に投影し、warm-up / early-game reproducibilityから導出 |
| 回またぎ○ | MOVE | relief multi-inning Role Suitability / workload handling |
| 緊急登板○ | MOVE | rapid warm-up / emergency-entry Role Suitability |
| 火消し | REINTERPRET | inherited-runner / emergency-entry pressure + readiness |
| ガソリンタンク | MERGE | Recovery A〜GのGold Tier候補。RecoveryCapacityから導出 |
| 鉄腕 | MERGE | Condition Sensitivity FamilyのGold / Master Tier。投手調子安定と同時保持・同時適用しない |

## 4.5 Runner Control / Pitcher Defense

| 参照候補 | 判定 | Kneekuraでの扱い |
| --- | --- | --- |
| クイック A〜G / 走者釘付 | MERGE | set-position motion-to-release speed / repeatability Graded Family + Gold。Underlying speed sourceは **G→F→E→D→C→B→A→Gold の順に厳密に速くなる**。G extremeはNORMAL×1.8 duration、A extremeはNORMAL/1.8、Gold extremeはNORMAL/2.5を上限とし、表示Grade自体から倍率を再適用しない |
| 牽制○ | ADOPT | pickoff technique |
| 対ランナー○ | REINTERPRET | runner-on-base時のexecution stability / attention allocation |
| 打球反応○ | ADOPT | pitcher fielding reaction skill |

**Source conflict:** ユーザー提供の赤特一覧にも「対ランナー」があり、説明文は「ランナーがいると能力が上がる」と正方向になっている。赤分類と説明が矛盾するため、この赤版だけは効果を推測修正せず保留する。

## 4.6 Pressure / Emotion / Relationship

| 参照候補 | 判定 | Kneekuraでの扱い |
| --- | --- | --- |
| 対ピンチ A〜G / 強心臓 / ノミの心臓 | MERGE | pressure-context response Graded Family。心理由来の差はAppraisal / ActiveEmotion発火・影響感度へ接続し、ActiveEmotion未成立時に同じ心理原因から別の直接能力Buffを掛けない |
| 打たれ強さ A〜G / 不屈の魂 | MERGE | negative-event後のemotional / execution recovery Family |
| 対左打者 A〜G / 左キラー | MERGE | platoon matchup Family。左右ラベルだけの魔法Buffは禁止 |
| 短気 | REINTERPRET | Appraisal -> anger / ActiveEmotion -> executionへの因果経路 |
| 闘志 / 闘魂 | MOVE | Psychology / Behavior Descriptor。無条件能力Buffにはしない |
| 威圧感(投手) / 存在感(投手) | MOVE | reputation / opponent appraisal。相手能力を直接下げない |

## 4.7 Career / Match Traitから外すもの

| 参照候補 | 判定 | 理由 |
| --- | --- | --- |
| 勝ち運 / 勝利の星 / 負け運 | MOVE | team win/lossを直接呼び込む因果は採用しない。Career / historical Descriptor候補 |
| 投打躍動 / 超投打躍動 | MOVE | 一方の結果が他方を直接Buffする形は不採用。将来Confidence / Emotion / adaptationで再検討 |
| フレーミング◎ | MOVE | 捕手Traitへ移動 |

## 4.8 投手 Green / Neutral Behavior

**Green採用**
- 速球中心
- 変化球中心
- テンポ○
- 投手調子安定
- 投手調子極端

`投手調子安定 / 投手調子極端 / 鉄腕` はCondition Sensitivity Familyとして同じsource of truthを共有する。鉄腕が有効なら投手調子安定を別に重ねない。

**Neutral / setup候補**
- 投球位置左
- 投球位置右

投球位置は能力上昇ではなくrelease geometryの選択 / setupとして扱う。

## 4.9 投手 Blue-Red候補

| 参照候補 | 判定 | 扱い |
| --- | --- | --- |
| 荒れ球 | REINTERPRET | high stuff / movement等の実在する球質 benefitとcommand variance costが同居するTradeoff Descriptor。「予測不能」そのものへ追加Buffを与えない |
| 全開 | MERGE | 完全燃焼Family |
| 力配分 | ADOPT | output reduction ↔ fatigue saving |
| ゴロピッチャー | MOVE | actual batted-ball distributionから導出するNeutral Descriptor |
| フライボールピッチャー | MOVE | actual batted-ball distributionから導出するNeutral Descriptor |
| ポーカーフェイス | MOVE | Psychology visibility / Green-Neutral Descriptor |

## 4.10 投手 Named Red候補

**採用 / 再解釈**
- 一発 -> Dangerous Miss FamilyのNegative tier
- 軽い球 -> Pitch Contact Quality FamilyのNegative tier
- 四球
- 抜け球
- スロースターター -> Early-game Readiness FamilyのNegative tier
- 寸前
- 短気
- 乱調
- ノミの心臓
- ボール先行

**Neutral Descriptorへ移動**
- シュート回転

**Match Traitから外す**
- 負け運

**Source conflict保留**
- 赤版 対ランナー

---

# 5. 野手 / 打者 / 捕手Trait カタログ

## 5.1 Contact / Power / Batted-ball Skill

| 参照候補 | 判定 | Kneekuraでの扱い |
| --- | --- | --- |
| アベレージヒッター / 安打製造機 | MERGE | contact precision / batted-ball quality Descriptor Family |
| パワーヒッター / アーチスト | MERGE | power swing時のexit velocity + launch generation Family |
| 流し打ち / 芸術的流し打ち | MERGE | opposite-field technique Family |
| 広角打法 / 広角砲 | MERGE | multi-direction hard-contact technique |
| プルヒッター / 引っ張り屋 | MERGE | pull-side power-transfer technique |
| ラインドライブ | REINTERPRET | actual launch distributionから導出するNeutral / Positive Descriptor。直接弾道Buffにしない |
| カット打ち | ADOPT | late contact / foul extension technique |
| 粘り打ち | ADOPT | two-strike adjustment / foul survival skill |

## 5.2 Zone / Pitch-type Skill

| 参照候補 | 判定 | 扱い |
| --- | --- | --- |
| インコースヒッター / 内角必打 | MERGE | inside-zone technique Family |
| アウトコースヒッター / 外角必打 | MERGE | outside-zone technique Family |
| ハイボールヒッター / 高球必打 | MERGE | high-zone technique Family |
| ローボールヒッター / 低球必打 | MERGE | low-zone technique Family |
| 対ストレート○ | ADOPT | fastball-family recognition / timing skill |
| 対変化球○ | ADOPT | breaking/off-speed recognition / adjustment skill |
| 初球○ / 一球入魂 | MERGE | first-pitch approach / execution Family |

## 5.3 Two-strike / Failure Adaptation

| 参照候補 | 判定 | 扱い |
| --- | --- | --- |
| 窮地○ / ヒートアップ | REINTERPRET | two-strike adaptation / execution under narrowing options |
| 三振 / 扇風機 | MERGE | two-strike recognition / adjustment weaknessのNegative Family |
| リベンジ / 逆襲 | REINTERPRET | previous-AB outcomeそのものではなく、in-game matchup learning / adjustment speed |
| 固め打ち / メッタ打ち | MOVE | 単なる「ヒット後Buff」は不採用。Confidence / timing stateとして将来再検討 |
| マルチ弾 | MOVE | HR後の直接Power Buffは不採用。Confidence / approach stateで再検討 |

## 5.4 Pressure / Match Context

| 参照候補 | 判定 | 扱い |
| --- | --- | --- |
| チャンス A〜G / 勝負師 | MERGE | pressure-context response Graded Family + Gold。心理由来の差は主にAppraisal / ActiveEmotion発火・影響感度のsourceとなり、ActiveEmotion未成立時に同じ心理原因から別の直接打力Buffを重ねない |
| 満塁男 / 恐怖の満塁男 | MERGE | 基本Pressure / High-Leverage Familyへ統合。極端で持続的なbases-loaded specializationを別表示する場合は、generic Clutchを再加算しない独立Subfamily Descriptorとする |
| サヨナラ男 / 伝説のサヨナラ男 | MERGE | Pressure / High-Leverage Familyへ統合。walk-off専用の魔法Buffは作らない |
| 決勝打 / 渾身の決勝打 | MERGE | Pressure / High-Leverage Familyへ統合。勝ち越し結果そのものを能力上昇条件にしない |
| 逆境○ / 火事場の馬鹿力 | REINTERPRET | trailing-game Appraisal / motivation response。点差ラベルから直接打力を上げない |
| 対エース○ / エースキラー | REINTERPRET | 「エース」ラベルBuffではなく高品質pitch / learned matchupへの適応 |
| 代打○ / 代打の神様 | MERGE | pinch-hit readiness / Role Suitability Family |
| ダメ押し | REJECT | 大量リードという結果状態から直接能力上昇する必要性が薄い |
| 帳尻合わせ | REJECT | 成績帳尻のための直接Buffは因果原則に合わない |
| 意外性 / 大番狂わせ | MOVE | Career / highlight Descriptor候補。Match能力Buffとしては曖昧 |
| いぶし銀 | MOVE | Style / Career Descriptor候補。因果効果が曖昧 |

## 5.5 Platoon

| 参照候補 | 判定 | 扱い |
| --- | --- | --- |
| 対左投手 A〜G / 左腕キラー | MERGE | platoon matchup Graded Family + Gold |

## 5.6 Bunt / Running

| 参照候補 | 判定 | 扱い |
| --- | --- | --- |
| バント○ / バント職人 | MERGE | bunt contact / placement technique |
| 内野安打○ / ロケットスタート | MERGE | bat-to-run transition / first-step acceleration Descriptor |
| 盗塁 A〜G / 電光石火 | MERGE | lead / start / acceleration / slide Graded Family + Gold |
| 走塁 A〜G / 高速ベースラン | MERGE | route / read / extra-base decision Graded Family + Gold |
| ヘッドスライディング / 気迫ヘッド | MOVE | slide-style Behavior / Green-Neutral候補。無条件speed Buffにしない |
| かく乱 / トリックスター | REINTERPRET | runner threatがpitcher/catcherのattention allocationへ与える実際の圧力 |
| プレッシャーラン | MOVE | legality / opponent error inductionをRule + Psychologyへ分離 |
| ホーム突入 / 重戦車 | MOVE | collision rule依存。Competition / RuleProfile側でのみ成立候補 |

## 5.7 Fielding / Throwing / Catcher

| 参照候補 | 判定 | 扱い |
| --- | --- | --- |
| 守備職人 / 魔術師 | MERGE | advanced fielding technique / route / transfer Family |
| 高速チャージ | ADOPT | bunt / slow-ball charging technique |
| 送球 A〜G / ストライク送球 | MERGE | throwing accuracy Graded Family + Gold |
| レーザービーム / 高速レーザー | REINTERPRET | arm velocity / trajectoryのDescriptor。肩力を再Buffしない |
| ホーム死守 / 鉄の壁 | MERGE | catcher / fielder tag-and-block execution Family |
| ブロッキング | ADOPT | catcher block technique |
| フレーミング○ / フレーミング◎ | MERGE | receiving / called-strike influence。RuleProfile依存 |
| キャッチャー A〜G / 球界の頭脳 | MERGE | pitcher handling / game-calling / communication Graded Family + Gold。投手能力を直接上げない |
| バズーカ送球 | REINTERPRET | catcher pop-time + throw velocity + accuracy Descriptor |

## 5.8 Durability / Recovery

| 参照候補 | 判定 | 扱い |
| --- | --- | --- |
| ケガしにくさ A〜G / 鉄人 | MERGE | injury-resistance Graded Family + Gold |
| 回復 A〜G | ADOPT | RecoveryCapacity Graded Family。投手/野手共通能力候補 |

## 5.9 Team / Reputation / Psychology

| 参照候補 | 判定 | 扱い |
| --- | --- | --- |
| ムード○ / 精神的支柱 / ムード× | MOVE | Relationship / Trust / Team Chemistry Descriptor。全員への直接Buff禁止 |
| 威圧感(野手) / 存在感(野手) | MOVE | reputation / opponent appraisal。投手能力を直接下げない |
| ささやき戦術 / ささやき破り | MOVE | Catcher Psychology / Communication。独立システム採用時のみ復活候補 |
| 人気者 | MOVE | Career / Presentation |
| チャンスメーカー / 切り込み隊長 | MOVE | batting-order role / Career Descriptor候補。結果ラベルを能力にしない |

## 5.10 Team Killer

各球団名付きキラーTraitは個別固定Traitにしない。

```text
Relationship / Familiarity Evidence
  -> targetTeamId
  -> current roster / pitch-shape / tactic overlap
  -> Descriptor
  -> 「○○キラー」
```

元候補の各球団キラーはすべて **MERGE -> parameterized Relationship Trait** とする。

---

## 5.11 Green / Neutralの排他的Behavior Family

GreenやNeutralでも同一意思決定軸の反対傾向は共存させない。

| Family | 排他的状態例 |
| --- | --- |
| Pitch Approach | 速球中心 / Balanced / 変化球中心 |
| Mound Position | 投球位置左 / 中央 / 投球位置右 |
| Swing Mode Preference | 強振多用 / Balanced / ミート多用 |
| Plate Aggression | 積極打法 / Balanced / 慎重打法 |
| Steal Aggression | 積極盗塁 / Balanced / 慎重盗塁 |
| Team-play Preference | チームプレイ○ / Neutral / チームプレイ× |
| Pitcher Condition Response | 投手調子極端 / Normal / 投手調子安定 / 鉄腕相当 |
| Batter Condition Response | 野手調子極端 / Normal / 野手調子安定 |

同じFamilyの反対Variantを複数表示しない。

一方、`積極走塁` と `積極守備` のように作用先が異なるBehaviorは別Familyなので共存可能。

# 6. Green Trait カタログ

## 6.1 投手

**Green採用**
- 速球中心
- 変化球中心
- テンポ○
- 投手調子安定
- 投手調子極端

Condition Response Familyは `EXTREME_SENSITIVE / NORMAL / STABLE / MASTER_STABLE(鉄腕相当)` 等の排他的Profileへ投影する。`EXTREME_SENSITIVE` を単純な下位能力とはみなさない。色が異なっても同一Familyなら共存させない。

**Neutral setupへ移動**
- 投球位置左
- 投球位置右

## 6.2 野手

**Green採用**
- 強振多用
- ミート多用
- 積極打法
- 慎重打法
- 積極盗塁
- 慎重盗塁
- 積極走塁
- 積極守備
- チームプレイ○
- チームプレイ×
- 野手調子安定
- 野手調子極端
- 春男
- 夏男
- 秋男

**Greenから外す**
- フル出場 -> RoleUsagePreference / manager usage policy。選手能力Buffではない
- 選球眼 -> actual recognition / discipline ability
- 人気者 -> Career / Presentation
- 国際大会○ -> Competition / Pressure Context
- お祭り男 -> 定義が大会・イベント依存のためCompetition / Condition側へ再設計

Greenは能力値上昇ではなくDecision / preference / condition-distribution tendencyへ作用する。

---

## 6.3 Green Stability / Hysteresis — CANONICAL

GreenはFast Stateではない。

内部Preferenceが少し揺れただけでUI Traitを変更しない。

```text
underlying preference
+ repeated voluntary / accepted behavior
+ role history
+ appraisal / internalization
+ time persistence
        ↓
hysteresis threshold
        ↓
Green display transition
```

同一Green Familyではenter threshold / leave thresholdを分け、短期往復を防ぐ。

Manager / Coach交代、役割変更、長期的な成功・失敗等は変化Catalystになれるが、一度の出来事で即切替しない。

Long-run Acceptance:
- 通常Playerが同じGreen Familyを1 season中に何度も往復しない
- **同じGreen Familyが1 seasonに5回前後変化する状態は明確なCalibration Failure**
- Hard runtime capではなく、slow-state dynamics / hysteresis / evidence persistenceで自然に防ぐ

---
# 7. Blue-Red Trait カタログ

## 7.1 投手

- 荒れ球 -> high stuff / movement等の実在する球質 benefit ↔ command variance cost。variance自体を魔法的な追加benefitにしない
- 全開 / 完全燃焼 -> max effort ↔ fatigue cost
- 力配分 -> output saving ↔ immediate quality cost

以下はBlue-RedではなくNeutral / other systemへ移動:
- ゴロピッチャー -> Neutral batted-ball Descriptor
- フライボールピッチャー -> Neutral batted-ball Descriptor
- ポーカーフェイス -> Psychology visibility

## 7.2 野手

- 悪球打ち -> expanded contact/chase behavior benefit ↔ chase / weak-contact risk
- 死球集中 -> **Blue-Redから外す。** plate-crowding / avoidance tendencyを表すNeutral Behavior候補。死球率そのものを直接変更しない

---

# 8. Named Red Trait カタログ

## 8.1 投手

**Match Traitとして残す候補**
- 一発
- 軽い球
- 四球
- 抜け球
- スロースターター
- 寸前
- 短気
- 乱調
- ノミの心臓
- ボール先行

**Neutral Descriptorへ再解釈候補**
- シュート回転

**Careerへ移動**
- 負け運

**Source conflict**
- 赤版 対ランナー

## 8.2 野手

| 参照候補 | 判定 | 扱い |
| --- | --- | --- |
| エラー | REINTERPRET | scoring-position等のpressure下fielding execution weakness。通常守備力との二重計上禁止 |
| 三振 / 扇風機 | MERGE | two-strike adjustment Negative Family |
| 併殺 | REINTERPRET | ground-contact tendency + running speed + contextから生じるDescriptor。併殺結果を直接増やさない |
| ムード× | MOVE | Team Chemistry / Relationship Descriptor |

---

# 9. 現時点で明確にMatch Traitへしない候補

直接結果Buff / Debuffになりやすいため、少なくとも現形ではMatch Traitへ入れない。

- 勝ち運
- 勝利の星
- 負け運
- 大番狂わせ
- 意外性
- ダメ押し
- 帳尻合わせ
- 投打躍動
- 超投打躍動

また以下は別システムへ移す。

- 人気者 -> Presentation / Career
- 精神的支柱 / ムード○ / ムード× -> Relationship / Team Chemistry
- 威圧感 / 存在感 -> Psychology / Reputation
- ささやき戦術 / ささやき破り -> Communication / Psychology
- ホーム突入 / 重戦車 -> RuleProfile-dependent running
- ゴロピッチャー / フライボールピッチャー -> Neutral Descriptor

---

# 10. Trait Familyの量を抑える統合方針

元候補の状況Traitを一対一で全部残すとTrait数が膨張する。

以下は統合優先候補。

```text
チャンス
満塁
サヨナラ
決勝打
要所
  -> Pressure / High-Leverage family + optional specialization evidence

初球
追い込まれ
  -> count-specific execution families

固め打ち
メッタ打ち
マルチ弾
  -> direct outcome buffとしては削除
  -> confidence / adaptation systemへ

○○キラー
  -> parameterized Relationship family
```

ユーザーが表面で理解しやすいことを優先しつつ、内部Evidenceは細分化可能とする。

---

# 10.1 敵対監査で追加した安全柵

### PressureとActiveEmotion

Pressure系Traitは「重要場面なので打力+X」の別系統Buffにしない。

```text
stable pressure-response traits
+ MatchImportance
+ personal stake
+ recent events
      ↓
Appraisal / EmotionPressure
      ↓
ActiveEmotion if threshold crossed
      ↓
execution / decision changes
```

同じ精神安定性・勝負欲等を、Pressure TraitとActiveEmotionから二重に性能へ掛けない。

### Condition Sensitivity

`投手調子安定 / 投手調子極端 / 鉄腕` のように同じCondition感度を表す表示は、色がGreen / Goldで異なっても同一Familyとして排他的にする。

### Usage preference

`フル出場` のように「交代されにくい」を意味するものは、選手のMatch能力ではなくRoleUsagePreference / manager policyへ移す。

### Family exclusivity across colors

色分類よりFamily identityを優先する。

- 軽い球 / 重い球 / 怪物球威
- 一発 / 逃げ球 / 本塁打厳禁
- スロースターター / 立ち上がり○ / トップギア
- 投手調子極端 / 投手調子安定 / 鉄腕
- 速球中心 / 変化球中心
- 強振多用 / ミート多用

等は、色が違っても同一Familyなら一つだけ有効にする。

### Tradeoff Descriptor

`荒れ球` は、実在する球質向上とcommand varianceの組み合わせを要約する。command variance自体に「読みにくいから能力低下」等の別Buffを付けない。

# 11. 最終設計判断

以下を採用済みとする。

1. G〜S境界は `G 0-19 / F 20-39 / E 40-49 / D 50-59 / C 60-69 / B 70-79 / A 80-89 / S 90-100`。
2. LEAGUE_RELATIVEの基準域は概ね50〜55付近。
3. チャンス / 満塁 / サヨナラ / 決勝打等はPressure / High-Leverage Familyへ統合を優先し、極端で持続的な専門性だけ追加Descriptor候補とする。
4. 軽い球 / 重い球は残すが、球質・軌道・contact結果から導出するDescriptorとし、直接Buff / Debuffにしない。
5. シュート回転は原則Neutral pitch-shape Descriptorへ移す。意図せぬ抜け・release errorは別Negative Trait。
6. 赤版「対ランナー」は、提示された赤分類と説明文が矛盾するため、意味を推測せず**カタログ採用保留 / source conflict**とする。確認されるまで実装しない。
7. 死球集中はBlue-Redから外し、plate-crowding / avoidance等のNeutral Behavior候補へ移す。
8. 参照元名称は設計上の対応ラベルとし、最終UI名称はKneekura独自名称を許可する。ただし一般野球語として自然な名称を無理に改名しない。

## 12. 名称ポリシー

Traitの内部ID、Family ID、UI表示名を分離する。

```text
stable internal family id
  -> localization / UI display name
  -> explanation text
```

参照元名称の一致をデータ互換性の条件にしない。

一般的な野球用語はそのまま利用できるが、固有色の強い名称についてはKneekura側で独自名称へ変更可能とする。

## 13. 最終敵対監査の合格条件

- 同一Trait FamilyのGold / A〜G / Named tierが同時適用されない
- Trait表示値がMatch Coreのsource of truthになっていない
- LEAGUE_RELATIVEの値を真能力へ逆算していない
- 国際大会・代表招集・対外大会への参加だけでratingContextLeagueIdを変更していない
- Headline Ratingの基準はCompetitionではなくAffiliationに紐づいている
- ABSOLUTE_PHYSICALがリーグ移籍で再スケールされない
- Suitabilityが汎用身体能力を二重計上しない
- Condition / CurrentFatigue / Stamina / Recoveryが同じ原因を二重適用しない
- Pressure / Relationship / Reputationが結果へ直接Buffを掛けない
- Descriptor Traitが元となる物理・技能を再加算しない
- 同じsource of truthを公開RatingとTraitの両方から二重入力していない
- RuleProfile依存Traitがルールを無視して常時発動しない
- Career / Historical DescriptorがMatch能力へ逆流しない
- source conflict項目を推測で実装しない

重大な矛盾がなければ08 / 09を設計承認済みへ昇格する。


## 14. 最終敵対監査結果

2026-09-19、以下の関連設計を横断して最終監査を実施した。

- `01-manager-experience.md`
- `02-rules-ratings-defense.md`
- `05-psychology-emotion.md`
- `06-future-systems.md`
- `08-player-traits-design-seed.md`
- 本09
- `2026-09-17-league-ecology-design.md`

確認項目:

- Family単位の排他
- Named Negative Extreme
- Rating / Trait二重計上
- Pressure / ActiveEmotion二重計上
- Condition / Fatigue / Stamina / Recovery境界
- ABSOLUTE_PHYSICAL / LEAGUE_RELATIVE / SUITABILITY境界
- League labelからMatch Coreへの直接補正禁止
- Presentation Projectionの逆流禁止
- Psychology UI境界
- source conflictの隔離

結果: **PASS**

重大な設計矛盾は確認されなかった。

唯一の既知source conflictである赤版「対ランナー」は、意味を推測せずカタログ採用保留・実装対象外とするため、承認を阻害しない。

この文書はここで計画完了とする。後続では、ここで確定した境界を変更せず、具体式・閾値・データ構造・テスト実装を設計する。



Team traits / player relationship design candidate (USER REVIEW REQUIRED):
- `docs/game-design/34-team-traits-and-relationship-network-DRAFT.md`


Team Trait Catalog (USER REVIEW REQUIRED):
- `docs/game-design/35-team-trait-catalog-DRAFT.md`


---

## Popularity / Reputation follow-up

`人気者` の移管先設計:
- `docs/game-design/50-popularity-reputation-architecture-DRAFT.md`

`人気者` はFan Affection / Career / Presentationへ移す。

`威圧感 / 存在感` はPopularityから切り離し、Scouting / Manager Belief / Psychology側で別途扱う。Popularity labelをManager tactical inputにしない。


### Star / Superstar follow-up

`人気者` remains Career / Presentation.

`Star / Superstar` are separate Career/competition statuses and may connect to:
- Tactical Gravity
- high-salience Condition / Psychology

through:
- `docs/game-design/51-star-superstar-big-stage-architecture-DRAFT.md`

No direct raw ability modifier is granted by the label.

---

## 14. 2026-09-22 CANONICAL REFINEMENT — Trait Acquisition

Trait Family自体のSource of Truthは本09。

取得・Recognition・成長・覚醒・CatalystのSource of Truthは:
- `docs/game-design/53-player-development-trajectory-breakthrough-v1.md`

とする。

Family-level原則:
- one dramatic resultだけでTraitをunlockしない
- actual source state changeまたは十分なRecognition Evidenceを要求
- Pressure系はAppraisal / ActiveEmotionと二重Buffしない
- Green系はstable Behavior / Preferenceの変化から投影
- Named Goldは同一FamilyのMaster Tierで下位Gradeと同時適用しない

特に:

```text
ノビ G -> ... -> ノビ A -> 怪童
```

をCanonical tier structureとする。`ノビ○`はCanonical UI / data tierとして生成しない。
## 15. 2026-09-22 CANONICAL REFINEMENT — Trait Lifecycle & Command Interaction

1. Trait Family分類は09のみをSource of Truthとし、53/実装側で名前から推測しない。
2. G〜A型13 FamilyはCurrent Source Stateに応じて上下する。
3. Graded Family GoldもCurrent Master Tierなので降格可能。
4. Consolidation済みNamed Blue learned masteryは原則Career中に消失しない。
5. Persistent Blue / Goldは身体能力を永久維持するBuffではなく、習得技術の保持。
6. Greenは本人のSlow Default Preference。
7. Green stored preferenceとActual Actionを分離する。
8. explicit Manager instructionはGreen Traitを削除しないが、Actual Actionを優先的に方向づけられる。
9. Red / Descriptor / Relationship Traitは各Source Stateに従って動的に変化できる。
10. Fixed Trait count capは置かないが、Trait Density Guardと有限OpportunityでTraitまみれを防ぐ。
11. Green transitionはhysteresisを持ち、頻繁なseason内往復をCalibration Failureとする。