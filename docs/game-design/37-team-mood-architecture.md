# Team Mood Architecture

更新日: 2026-09-20  
状態: **設計承認版。2026-09-20ユーザー承認。実装前。**

関連:
- `docs/game-design/05-psychology-emotion.md`
- `docs/game-design/08-player-traits-design-seed.md`
- `docs/game-design/20-simple-surface-deep-simulation.md`
- `docs/game-design/34-team-traits-and-relationship-network-DRAFT.md`
- `docs/game-design/35-team-trait-catalog-DRAFT.md`
- `docs/game-design/36-team-trait-dark-era-stress-test.md`

---

# 1. Design Goal

Team Moodは:

```text
team ability buff
```

ではない。

目的は:

- 勝っているClubの活気
- rebuilding Clubが息を吹き返す感覚
- 一人の中心人物が集団へ良い刺激を与える現象
- Starが多くても噛み合わないClub
- もめごと / 不満 / distrustで重くなる空気
- 成功 / 失敗がClubhouse全体へ伝播する現象

を因果的に表現すること。

---

# 2. Core Principle — Mood is a Social Environment

Team MoodはPlayer Abilityを直接変更しない。

```text
Team Mood
        ↓
social / emotional environment
        ↓
each Player's Appraisal
        ↓
EmotionPressure
        ↓
ActiveEmotion if threshold crossed
        ↓
actual behavior / execution
```

同じMoodでもPlayerごとに反応が違う。

---

# 3. Mood Maker is a Catalyst, not a Battery

最重要原則。

```text
Mood Maker joins
 -> team mood +20 forever
```

は禁止。

正しい構造:

```text
influential player
+ actual performance
+ visible effort
+ social integration
+ teammate trust
+ shared success
        ↓
positive signals spread faster
        ↓
team confidence / energy / cohesion rise
        ↓
new collective state becomes partly self-sustaining
```

一人のPlayerはTeam Moodを**生成する電池**ではなく、
Mood changeを加速させる**social catalyst**。

---

# 4. Why Catalyst Matters

Catalyst方式なら:

```text
star injured / absent
 -> team does NOT instantly lose all mood
```

が可能。

既に:

- shared confidence
- stronger relationships
- collective success memories
- role clarity
- positive routines

がTeam側へ拡散していれば、本人不在でもMoodは一定期間維持できる。

逆に:

```text
star joins
+ performs individually
BUT
socially isolated
+ teammates distrust him
+ role conflict
        ↓
limited mood diffusion
```

も可能。

---

# 5. Team Mood is a Vector, not One Number

```ts
type TeamMoodState = {
  confidence: number;   // 0..100
  cohesion: number;     // 0..100
  energy: number;       // 0..100
  tension: number;      // 0..100
  roleHarmony: number;  // 0..100
};
```

単一の「ムード80」に潰さない。

UIは単純化してよい。

---

# 6. Confidence / 自信

意味:

> 「このチームならやれる」という集団期待。

上昇要因候補:

- expectationを上回る勝利
- comeback
- strong opponentへの勝利
- repeated clutch success
- reliable star performance
- successful role execution

下降要因候補:

- repeated close losses
- blown leads
- failure in high-leverage situations
- expectationを大幅に下回る結果

作用:

- threat appraisalを少しpositive側へ動かしやすい
- mistake後のresetを速めやすい

能力を上げない。

---

# 7. Cohesion / 結束

意味:

> 「自分たちは同じ集団だ」というbelonging / mutual support。

主な入力:

- Player affinity network
- trust network
- tenure
- mutual support events
- newcomer integration
- shared adversity
- conflicts
- factionalization

作用:

- positive emotional contagion
- teammate successへの反応
- teammate mistake後のsupport
- communication willingness

友情の平均ではない。

---

# 8. Energy / 活気

意味:

> Clubhouse / dugoutの現在のemotional activation。

最もFastなMood軸。

上昇:

- exciting win
- breakout performance
- star arrival + success
- young player emergence
- comeback
- milestone
- positive fan reaction

低下:

- repeated flat losses
- fatigue
- long road grind
- hopeless game states
- unresolved stagnation

数日〜数週間で大きく変わり得る。

---

# 9. Tension / 緊張・不穏

意味:

> 失敗への恐怖、対立、外部圧力、内部摩擦の強さ。

入力:

- losing streak
- public conflict
- contract dispute
- role dissatisfaction
- manager-player friction
- fan / media pressure
- title-race pressure
- disciplinary incident

High Tensionだけで能力を下げない。

各Playerが:

- excitementとして受ける
- pressureとして受ける
-ほぼ影響を受けない

のどれになるかはPersonality / Appraisal次第。

---

# 10. Role Harmony / 役割納得

意味:

> 「自分の役割・周囲の役割・起用方針が理解され、受け入れられているか」。

入力:

- lineup stability
- bullpen role clarity
- playing-time expectations
- manager communication
- contract / status expectation
- star hierarchy
- position competition

Starを多数集めた時に重要。

```text
many great players
+ limited roles
+ unclear hierarchy
        ↓
roleHarmony may fall
```

True Abilityは高いまま。

---

# 11. Manager Trust is Upstream, not Mood

ManagerへのTrust自体はTeam Moodの軸に含めない。

理由:

Manager Ability設計と分離するため。

```text
Player / Team trust in manager
        ↓
Role Harmony
Tension
Cohesion
```

へ入力する。

Manager Trustは別source stateとして後続設計する。

---

# 12. Public Popularity is Also Separate

```text
Public Popularity
 !=
Clubhouse Influence
```

メディア人気が高いPlayerがMood Makerとは限らない。

逆に地味なVeteranがClubhouse中心人物でもよい。

Popularity設計とTeam Moodを分離する。

---

# 13. Clubhouse Influence

PersonごとにTeam Moodへのsocial influenceを持てる。

ただし固定`Mood Maker +10`ではない。

候補:

```ts
type ClubhouseInfluence = {
  socialCentrality: number;
  credibility: number;
  expressiveEnergy: number;
  supportiveBehavior: number;
  conflictAmplification: number;
};
```

Derived inputs:

- relation network centrality
- tenure
- leadership behavior
- teammate trust
- current role
- actual performance credibility

---

# 14. Influence Requires Credibility

大物でも全く活躍していなければ、performance由来のpositive signalは弱くなり得る。

```text
star reputation
+ no current contribution
 -> limited performance credibility
```

逆に無名若手でも:

```text
unexpected breakout
+ visible effort
+ teammates like / trust him
 -> strong positive catalyst
```

があり得る。

---

# 15. White Sox-type Turnaround Motif

モデル上の流れ:

```text
historically bad recent seasons
        ↓
low confidence / low energy priors

new star joins
        ↓
actual home runs / visible contribution
+ social integration
+ teammate interaction
        ↓
high-salience positive signals
        ↓
Confidence rises
Energy rises
Cohesion may rise
        ↓
other players' positive Appraisal becomes easier
        ↓
team success spreads beyond the original player
        ↓
collective state becomes self-sustaining
```

重要:

```text
one star
 -> everyone batting +5
```

ではない。

StarはTurnaroundの**Trigger / Catalyst**になれるだけ。

---

# 16. Star-heavy Dysfunction Motif

逆方向も可能。

```text
many high-ability stars
+ overlapping desired roles
+ hierarchy ambiguity
+ personal conflicts
+ manager distrust
        ↓
Role Harmony falls
Tension rises
Cohesion falls
        ↓
coordination / appraisal / support deteriorate
        ↓
actual team may underperform talent
```

ただし:

```text
bad mood
 -> all stars ability -10
```

は禁止。

Talentは残るので、個人技で普通に勝つ日もある。

---

# 17. Team Mood Update Inputs

Candidate event families:

## Performance events

- win / loss relative to expectation
- comeback / blown lead
- high-leverage success / failure
- streak
- upset
- elimination

## Person events

- breakout star
- milestone
- leadership action
- conflict
- apology / reconciliation
- newcomer integration
- injury / return
- release / trade

## Role events

- benching
- promotion
- closer change
- captain / leader appointment
- position change
- playing-time dispute

## Organization events

- manager change
- front-office controversy
- ownership instability
- public disciplinary issue

Event名そのものではなく、Player Appraisal / Social Salienceを介してMoodへ入れる。

---

# 18. Expectation-adjusted Result

単純に:

```text
win = +1 mood
loss = -1 mood
```

にはしない。

```text
Result Salience
 = result
 + expectation gap
 + leverage
 + dramatic context
```

例:

- 最下位候補が王者候補に逆転勝ち → 大きなpositive event
- 王者候補が最下位候補に辛勝 → 小さなpositive
- 王者候補が大敗 → 大きなnegative

---

# 19. Mood Diffusion Through Relationship Network

Team全員へ同じ値を瞬時に配布しない。

```text
Event
↓
directly involved players
↓
high-affinity / high-trust connections
↓
clubhouse network
↓
team-level aggregate
```

Central Playerほどsignalを広く伝えやすい。

孤立Playerの感情は全体へ広がりにくい。

---

# 20. Player Susceptibility

同じTeam Moodでも反応は違う。

```ts
type MoodSusceptibility = {
  confidenceSensitivity: number;
  socialContagionSensitivity: number;
  pressureSensitivity: number;
  conflictSensitivity: number;
};
```

Mood 80だから全選手同じ効果、は禁止。

---

# 21. Mood -> Gameplay Boundary

Team Moodが触れてよいもの:

- Appraisal prior
- positive / negative emotion activation threshold
- emotional recovery speed
- communication willingness
- role acceptance
- support behavior
- hesitation under ambiguity

触れてはいけないもの:

- raw Contact
- raw Power
- raw Velocity
- raw Fielding
- direct win probability
- direct HR probability

---

# 22. Defense Interaction

Moodが低くてもFielding skill自体は落とさない。

ただし:

```text
high tension
+ low cohesion
+ ambiguous defensive play
        ↓
call hesitation more likely
```

は許可。

ここでもCoordination skillとMoodを分離する。

```text
Coordination
 = can we execute together?

Mood
 = are we currently willing / confident / calm enough to do it?
```

---

# 23. Batting Interaction

悪いMoodだけで打撃能力を落とさない。

各Playerで:

```text
Team Mood
+ personal susceptibility
+ personal situation
        ↓
Appraisal
        ↓
possible individual Condition / ActiveEmotion
```

本人が全く気にしていなければ打撃は普通。

これは既存Relationship ruleと整合する。

---

# 24. Team Trait Connection

Team MoodはTeam Traitのinputになれる。

例:

```text
high Confidence
+ high Energy
+ repeated comeback evidence
 -> Blue: 逆境オーラ candidate
```

```text
low Confidence
+ high Tension
+ repeated late losses
 -> Red: 終盤恐怖症 candidate
```

ただしTrait LabelをMoodへ再入力しない。

禁止loop:

```text
Red Trait
 -> Mood worsens
 -> same Red Trait stronger
 -> Mood worsens
...
```

Underlying Events / Statesだけを共有する。

---

# 25. Anti-Snowball

Positive Mood:

- does not directly make hits
- saturates
- mean-reverts without new evidence
- upset losses can cool confidence
- high confidence cannot exceed actual skill

Negative Mood:

- does not directly force errors
- new season partially resets
- meaningful success speeds recovery
- stable leaders can dampen negative contagion
- some players resist negative team mood

---

# 26. Anti-Mood-Maker Stacking

ユーザーが`ムードメーカーだけ9人`を集める最適解を防ぐ。

## Rule 1 — Diminishing Returns

social influenceはnetwork coverageが重複すると飽和。

```text
1 strong connector = useful
2 complementary connectors = useful
8 identical connectors = little additional effect
```

## Rule 2 — Credibility

Performance / trust / role credibilityが無ければ影響力は限定。

## Rule 3 — Compatibility

Influential personalities同士が対立すればTension sourceにもなる。

## Rule 4 — No Base Ability Buff

Mood Makerは勝利そのものを生成しない。

## Rule 5 — Role Cost

Mood MakerもRoster slot / contract / playing-time expectationを持つ普通のPlayer。

野球能力を無視して集めれば戦力が落ちる。

---

# 27. Mood Archetype Presentation

5軸からHeadline MoodをDerivedできる。

候補:

| Headline | Typical vector |
| --- | --- |
| 活気 | high Energy + Confidence |
| 一体感 | high Cohesion + Role Harmony |
| 平静 | low Tension + stable Confidence |
| 上昇気流 | rising Confidence + Energy |
| 重苦しい | low Confidence + low Energy |
| 焦燥 | high Tension + low Confidence |
| 不穏 | high Tension + low Cohesion |
| 内紛 | very low Cohesion + low Role Harmony + active conflicts |
| 無気力 | very low Energy + low Confidence |
| バラバラ | low Cohesion + low Role Harmony |

Headlineは説明用Derived View。

---

# 28. UI

通常画面候補:

```text
チームムード
  上昇気流

自信      A
結束      A
活気      S
緊張      D
役割調和  B

最近の要因
+ 若手主砲の活躍
+ 逆転勝ち 3回
+ 新加入選手がチームに定着
- 抑え投手の役割不安
```

ただし通常画面では5軸Rankを隠し、Headline + 2〜3理由だけでもよい。

---

# 29. Season Boundary

Mood axisごとにcarryover率を変える。

## Energy

ほぼreset。

Offseasonで大きくmean-revert。

## Confidence

partial carryover。

前年の成功 / 失敗Memoryを少し残すが、Spring / Opening weeksで再評価。

## Cohesion

最もcarryoverしやすい。

Roster continuity / relationship network次第。

## Tension

多くはdecay。

ただし未解決Conflict / contract dispute / factionalizationは残る。

## Role Harmony

manager / roster / role change時にrevalidate。

---

# 30. Roster Turnover

```text
high turnover
 -> cohesion continuity drops
 -> roleHarmony revalidation
 -> energy may rise from novelty OR tension may rise from uncertainty
```

方向は固定しない。

大量補強が自動で悪いわけではない。

---

# 31. New Star Arrival

New Star effectは3段階。

```text
1. Hope / Salience
   signing itself may raise Energy slightly

2. Validation
   actual performance raises credibility

3. Diffusion
   relationships / trust / shared success spread effect
```

1だけでは長続きしない。

```text
huge signing
+ poor performance
+ no integration
 -> initial excitement fades
```

---

# 32. Conflict

Conflictも一件でTeam Mood崩壊にはしない。

Impact depends on:

- involved players' social centrality
- public/private nature
- duration
- team factions
- manager response
- reconciliation
- current performance

Central stars同士の長期対立は大きなTension sourceになり得る。

---

# 33. Anti-Monocausal Rule

Team Moodだけで:

- 100-loss team turnaround
- dynasty
- 20-year dark era
- star-heavy collapse

を説明しない。

```text
Roster / Scouting / Manager / Development / Economy
+ Team Mood
+ Team Traits
+ Variance
        ↓
actual history
```

Team Moodは**social-psychological layer**。

---

# 34. Stress Tests

実装前に以下を通す。

1. bad team + great mood still usually lacks enough ability
2. great team + bad mood can still win through talent
3. one Mood Maker does not permanently carry team
4. multiple Mood Makers show diminishing returns
5. star injury does not instantly erase diffused positive mood
6. isolated star cannot easily lift whole team mood
7. conflicts among central stars can lower cohesion / role harmony
8. new season resets Energy but not all Cohesion
9. mood never modifies raw batting / pitching ratings
10. Team Traits and Team Mood do not form self-reinforcing circular modifiers

---

# 35. Approved Decisions


2026-09-20 ユーザー承認:

1. Team Moodは5軸 `Confidence / Cohesion / Energy / Tension / Role Harmony`
2. Mood Makerは固定BuffではなくSocial Catalyst
3. Public PopularityとClubhouse Influenceは分離
4. 新加入Starは `Hope -> Validation -> Diffusion`
5. Team MoodはPlayer Appraisal / emotional contagion / recovery / communication willingnessへ作用
6. raw Contact / Power / Velocity / Fielding / direct win probabilityへ作用しない
7. Mood Maker stackingにはdiminishing returnsを入れる
8. Star-heavy dysfunctionは低Cohesion / 低Role Harmony / 高Tensionとして表現可能
9. Season Boundaryでは軸ごとにcarryover挙動を変える
10. Anti-Monocausal Principleを適用し、Team Mood単独で長期勝敗史を説明しない

UIの具体表示、閾値、carryover率の数値校正は後続実装設計で決める。


ユーザーと詰める候補:

1. Mood 5軸 `Confidence / Cohesion / Energy / Tension / Role Harmony` でよいか
2. Mood Maker = fixed Traitではなくsocial catalystでよいか
3. Public PopularityとClubhouse Influenceを完全分離するか
4. 新加入Starは`Hope -> Validation -> Diffusion`の3段階でよいか
5. Headline MoodをDerived表示するか
6. Team MoodのRank / 数値をユーザーへどこまで見せるか
7. Offseason carryover率を具体的に決めるか
8. Manager TrustをMood外の上流Stateとして扱うか


Manager intervention layer for Team Mood (USER REVIEW REQUIRED):
- `docs/game-design/38-team-mood-manager-interventions-DRAFT.md`
