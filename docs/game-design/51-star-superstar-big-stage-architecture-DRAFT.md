# Star / Superstar Big-Stage Architecture — DRAFT

更新日: 2026-09-20  
状態: **USER DIRECTION APPROVED / 詳細MechanicsはDRAFT。実装前。**

関連:
- `docs/game-design/05-psychology-emotion.md`
- `docs/game-design/08-player-traits-design-seed.md`
- `docs/game-design/09-player-trait-catalog.md`
- `docs/game-design/37-team-mood-architecture.md`
- `docs/game-design/49-manager-architecture-v1.md`
- `docs/game-design/50-popularity-reputation-architecture-DRAFT.md`

---

# 1. Core Separation

```text
人気者 / Fan Favorite
= affection / entertainment / crowd appeal

Star
= competitive prominence / tactical gravity

Superstar
= exceptional Star
+ broad recognition
+ iconic salience
+ demonstrated ability to rise under spotlight
```

これらを一つのPopularity ladderにしない。

---

# 2. Fan Favorite

Fan FavoriteはCareer / Presentation中心。

- cheers
- attendance interest
- merchandise
- fan events
- lovable personality
- local attachment

Match tactical inputにはしない。

```text
Fan Favorite
 -> NO intentional-walk logic
 -> NO matchup caution
 -> NO raw Match ability buff
```

---

# 3. Star

Starは単なる知名度ではない。

定義:

> **現在の競技世界で、相手が対策を組む価値がある中心的Player。**

Source候補:

```text
true / estimated competitive ability
+ sustained performance
+ role centrality
+ opponent evidence
+ broad recognition
        ↓
Star Status
```

Star label自体から能力を作らない。

---

# 4. Tactical Gravity

Star / Superstarは戦術へ影響する。

ただし:

```text
Star label
 -> opponent ability debuff
```

は禁止。

代わりにManager側へ:

```text
known threat
+ matchup evidence
+ leverage
+ role centrality
+ scouting confidence
        ↓
Tactical Gravity
```

を作る。

候補影響:

- dedicated game plan
- careful pitch allocation
- leverage reliever usage
- defensive positioning focus
- intentional-walk candidate admission
- bench / matchup planning
- base-running containment
- attack-around / avoid-zone policy

Manager Skill / Philosophy / Beliefが最終判断を行う。

---

# 5. Star Label Is Not Tactical Oracle

Managerが:

```text
SUPERSTAR tag visible
 -> automatically walk
```

は禁止。

Star / Superstar statusは:

- scouting attention priority
- preparation salience
- opponent importance prior

には使える。

実際のActionはManager Beliefによる。

したがってData-heavy ManagerとIntuition-heavy Managerで対応が変わる。

---

# 6. Match Salience

Big-stage behaviorのContext Source。

```ts
type MatchSalience = {
  championshipWeight: number;
  eliminationWeight: number;
  rivalryWeight: number;
  internationalWeight: number;
  audienceWeight: number;
  personalLegacyWeight: number;
};
```

Derived examples:

- championship-deciding game
- pennant / title-deciding series
- elimination game
- WBC / international tournament
- historic rivalry game
- major milestone stage

「天王山」というLabel自体をBuffにしない。

---

# 7. Spotlight Response

Player側にBig-stage responseを持たせる。

候補:

```ts
type SpotlightResponse = {
  activation: number;
  stability: number;
  pressureConversion: number;
};
```

意味:

## Activation

注目 / stakesが高いほど集中状態へ入りやすいか。

## Stability

高圧力で通常のexecutionを保てるか。

## Pressure Conversion

Pressureを:

- positive arousal
- focus
- assertiveness

へ変換しやすいか。

これはraw Contact / Power / Velocityではない。

---

# 8. Big-stage Condition Shift

既存Condition / Psychologyへ接続。

```text
Match Salience
+ Personal Stake
+ Spotlight Response
+ recent state
        ↓
Appraisal
        ↓
Condition / ActiveEmotion distribution
        ↓
actual execution
```

高Spotlight Responseなら:

- good Conditionへ寄りやすい
- positive ActiveEmotionへ入りやすい
- pressureによるexecution collapseが起きにくい

可能。

ただしGuaranteed successは禁止。

---

# 9. No Superstar Magic Buff

禁止:

```text
Superstar
 -> Contact +10
 -> HR probability +20%
```

正しい方向:

```text
high-pressure stage
+ strong Spotlight Response
        ↓
better chance of entering good performance state
        ↓
existing ability expressed more completely
```

弱いPlayerがSuperstar labelだけで強くなることはない。

---

# 10. Star vs Superstar

## Star

必要候補:

- high competitive prominence
- sustained important role
- broad league awareness

Big-stage responseはpositiveとは限らない。

Starでもpressure-sensitiveは存在可能。

## Superstar

Starに加えて:

- exceptional sustained competitive prominence
- broad / cross-audience recognition
- repeated iconic moments
- strong high-salience evidence
- high cultural / historical salience

を要求。

Superstarは「単に能力S」の別名ではない。

---

# 10.1 Superstar Archetypes

Superstarを一つの型へ固定しない。

候補:

## Dominant Superstar

```text
historic-level competitive ability / production
+ sustained elite results
+ broad recognition
        ↓
Superstar
```

実力そのものが時代を代表する型。

## Iconic Superstar

```text
elite competitive level
+ exceptional memorable moments
+ huge cultural salience
+ strong public recognition
        ↓
Superstar
```

統計的な圧倒性だけでは説明できない象徴性が強い型。

## Complete Superstar

```text
historic competitive dominance
+ broad / global recognition
+ iconic salience
+ repeated major-stage success
        ↓
Superstar
```

実力・認知・象徴性がすべて極端に高い型。

重要:

```text
Superstar
 != compensation for weaker ability
```

Superstar StatusはPlayer Abilityの代用品ではない。

同じSuperstarでも:
- competitive dominance
- iconic salience
- spotlight evidence
- public reach

の形が違ってよい。

---

# 11. Iconic Salience

長嶋茂雄型を説明するための重要概念。

```text
Iconic Salience
= how strongly a player's moments become remembered as part of baseball culture
```

Inputs候補:

- high-stakes success
- uniqueness of event
- size of audience
- championship / national significance
- repeated memorable moments
- longevity of public recall

これはPopularityの好感度とは別。

---

# 12. Competitive Greatness vs Iconicity

同じ時代に:

```text
Player A
  historic statistical dominance
  huge competitive value

Player B
  also elite
  exceptional iconic salience
  repeated memorable high-stage moments
```

が存在可能。

両者ともStar / Superstarになり得るが、
Superstar Presentationの質が違ってよい。

「記録」と「記憶」を一つの数字へ潰さない。

---

# 12.1 Superstar Minimum Competitive Floor

Superstarには最低限、Starとして成立する十分な競技力 / 実績を要求する。

```text
high publicity
+ weak competitive importance
 -> celebrity / popular figure
 -> NOT Superstar
```

一方で:

```text
historic ability
+ sustained elite results
+ broad recognition
 -> Superstar candidate
```

となる。

Iconic Salienceは実力の代替ではなく、
Superstarを「ただの高能力Player」から区別する追加軸。

---

# 13. Superstar Is Derived, Not Causal Label

Circularity防止。

```text
Spotlight Response
+ elite ability
+ actual high-stage performance
+ broad recognition
+ iconic events
        ↓
Superstar descriptor
```

その後:

```text
Superstar descriptor
 -> ability buff
```

は禁止。

EffectのSource of TruthはSpotlight Response等のunderlying state。

---

# 14. Becoming a Superstar

Candidate lifecycle:

```text
High-potential / elite Player
        ↓
Star
        ↓
sustained elite performance
+ broad recognition
+ major-stage opportunities
+ repeated memorable response
        ↓
Superstar candidate
        ↓
persistent evidence
        ↓
Superstar
```

一試合だけでSuperstarにはしない。

---

# 15. Late-blooming Superstar

若い頃からStarでなくてもよい。

```text
ordinary / good player
 -> breakout
 -> major-stage success
 -> sustained prominence
 -> national icon
```

可能。

---

# 16. Superstar Decline

加齢で能力が落ちても:

```text
Current Star Power
```

は低下し得る。

しかし:

```text
Legacy / Iconic Salience
```

は残り得る。

現役晩年のLegendを表現できる。

---

# 17. Opponent Tactical Response

Star / Superstar相手には、
実際にManager側でより深いDeliberative Searchが起こりやすくてよい。

候補:

```text
high Tactical Gravity
 -> opponent preparation priority ↑
 -> more candidate actions considered
```

例:

- attack vs avoid
- intentional walk
- matchup reliever
- special defensive positioning
- pitch sequencing emphasis

これは人気者効果ではない。

---

# 18. Spotlight and Opponent Attention

Opponentの厳しい対策そのものが、
Starのbig-stage performanceを難しくする。

```text
Star
 -> tactical attention ↑
 -> quality of opponent plan ↑
 -> challenge becomes harder

Spotlight Response
 -> player may still rise to challenge
```

だからStar / Superstarは単純な有利Traitではない。

---

# 19. Audience / Attendance

Star:

- draws attention
- media focus
- attendance interest
- featured matchup

Superstar:

- much larger draw
- national / international interest
- event-level presentation
- away-game draw
- merchandise / sponsorship salience

Fan Favorite:

- affection-heavy draw

同じ「客を呼ぶ」でも理由が違う。

---

# 20. Crowd Effect Boundary

Crowd自体は能力Buffではない。

```text
crowd intensity
 -> Player observes
 -> Appraisal
 -> ActiveEmotion / Condition
```

Spotlight Responseが高いSuperstarは、
この刺激をpositive directionへ変換しやすい可能性がある。

---

# 21. Pressure-sensitive Star

重要:

Starでも:

```text
high ability
+ high Tactical Gravity
+ poor Spotlight Response
```

は可能。

これにより:

- Regular Season Star
- postseason struggles
- WBC pressure struggles

等を表現可能。

Star = clutchではない。

---

# 22. Superstar Threshold

推奨:

Superstarには一定以上のHigh-stage evidenceを要求する。

ただし:

```text
one iconic moment
 -> automatic Superstar
```

は禁止。

必要:

- elite base
- sustained relevance
- broad recognition
- multiple / persistent iconic evidence

---

# 23. UI

通常:

```text
人気者
スター
スーパースター
```

をDescriptorとして表示。

Star / Superstar詳細:

```text
Star Status: Superstar

強み
・League-wide elite prominence
・大舞台での高い安定性
・全国 / 国際的な認知

注目
・相手の対策対象になりやすい
・高Salience Matchで調子が上向きやすい
```

内部数値はOptional。

---

# 24. Historical Motifs

## Shigeo Nagashima

Design motif:

- elite competitive achievement
- national-level recognition
- repeated memorable high-stage performance
- exceptional iconic salience

NPB itself has described him as a national superstar.

## Shohei Ohtani

Design motif:

- elite two-way competitive prominence
- global awareness
- high-stage international success
- iconic championship moments

These are validation motifs only.
No person-specific hard-code.

---

# 25. Acceptance Tests

1. Fan Favorite can exist without Star.
2. Star can influence opponent planning without popularity.
3. Star can struggle under pressure.
4. Superstar is not merely the highest raw ability tier.
5. Superstar tends to have strong high-stage evidence.
6. high Match Salience shifts Condition through Spotlight Response, not raw ability buffs.
7. Superstar can still fail in the biggest game.
8. opponent tactical attention makes Star situations harder, not easier.
9. iconic player can remain culturally huge after physical decline.
10. statistical greatness and iconic greatness are distinguishable.
11. Manager still owns all tactical decisions.
12. no Star / Superstar label directly changes physics.

---

# 26. Recommended Design Decision

Adopt:

```text
Fan Favorite
 -> affection / presentation

Star
 -> competitive prominence / tactical gravity

Superstar
 -> exceptional Star
  + broad recognition
  + iconic salience
  + strong spotlight-response evidence
```

Big-stage effect Source of Truth:

```text
Match Salience
+ Spotlight Response
 -> Condition / Appraisal
 -> execution
```

not:

```text
Superstar label
 -> magic performance buff
```
