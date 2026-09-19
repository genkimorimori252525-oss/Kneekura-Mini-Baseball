# Popularity & Reputation Architecture — DRAFT

更新日: 2026-09-20  
状態: **設計候補。USER REVIEW REQUIRED。実装前。**

関連:
- `docs/game-design/05-psychology-emotion.md`
- `docs/game-design/08-player-traits-design-seed.md`
- `docs/game-design/09-player-trait-catalog.md`
- `docs/game-design/34-team-traits-and-relationship-network-DRAFT.md`
- `docs/game-design/37-team-mood-architecture.md`
- `docs/game-design/49-manager-architecture-v1.md`
- `docs/game-design/20-simple-surface-deep-simulation.md`

---

# 1. Goal

PowerPro系の「人気者」「威圧感」「存在感」等を、
謎のMatch Buffではなく、

- fans
- media / public attention
- opponent beliefs
- career history
- presentation

へ因果的に接続する。

重要:

> **Popularityは能力ではない。  
> ReputationはTruthではない。  
> Clubhouse InfluenceはPopularityではない。**

---

# 2. Core Separation

最低限、以下を分離する。

```text
Exposure / Awareness
= どれだけ知られているか

Public Favorability
= そのAudienceからどれだけ好意的に見られているか

Reputation
= どんな人物 / 選手だと思われているか

Clubhouse Influence
= Team内部でどれだけ人へ影響するか
```

最後のClubhouse InfluenceはTeam Mood / Relationship側のSource of Truth。

Popularity側へ複製しない。

---

# 3. Popularity is Derived

「人気」を単一の先天Statにしない。

概念:

```text
Awareness
+ positive Favorability
+ audience relevance
        ↓
Popularity presentation
```

したがって:

```text
very famous + disliked
 -> famous, but not "人気者"

locally known + strongly loved
 -> local 人気者

internationally known + broadly liked
 -> global star-level popularity
```

が可能。

---

# 4. Audience-specific Standing

Popularityは世界共通一個の数値にしない。

同じPersonでもAudienceごとに違う。

候補:

```ts
type AudienceStanding = {
  audience: AudienceKey;
  awareness: number;
  favorability: number;
  confidence: number;
};
```

AudienceKeyはsparse。

候補:

- current club supporters
- former club supporters
- local / regional audience
- league-wide neutral audience
- rival supporters
- national general audience
- international / competition-region audience

全Person × 全Audienceのdense matrixは禁止。

意味のあるAudienceだけ保存する。

---

# 5. Awareness != Favorability

## Awareness

「知っている人の多さ / 認知の強さ」。

増加要因候補:

- playing time
- league visibility
- performance
- memorable events
- awards / records
- postseason / international competition
- media exposure
- transfers
- rivalry
- unusual style / distinctive identity

Awarenessは比較的slow decay。

## Favorability

「好かれている / 応援したいと思われる程度」。

入力候補:

- performance relative to expectations
- loyalty / long tenure
- underdog story
- public behavior
- memorable hero moments
- local identity
- fan interaction / media persona
- controversy / conflict
- rival identity

FavorabilityはAwarenessより速く変化可能。

---

# 6. No Fixed "Home Run = Popularity +X"

Eventから直接Popularityを足さない。

```text
Canonical Event
+ salience
+ match importance
+ audience relevance
+ prior narrative / expectations
+ media reach
        ↓
Public Exposure
        ↓
Audience Appraisal
        ↓
Awareness / Favorability update
```

例:

```text
solo HR in 10-0 game
 !=
walk-off HR in championship game
```

同じHRでもPublic impactが異なる。

---

# 7. Public Appeal — Optional Slow Input

能力だけでPopularityが決まらないよう、
Person側に「注目を好意へ変換しやすい個性」を持たせる余地を残す。

候補:

```text
Public Appeal
```

ただし:

```text
Public Appeal
 -> automatic popularity
```

は禁止。

Exposureがなければ知られない。

Public AppealはAudience Appraisalへのsmall input候補。

詳細軸へ分解するかは未確定。

v1では単一slow factorでもよい。

---

# 8. Reputation != Popularity

Reputationは:

> **そのPersonについて、観測者が「こういう人 / 選手だ」と信じている内容。**

人気とは別。

例:

```text
Awareness: very high
Favorability: low
Reputation:
  feared slugger
  selfish
  clutch
```

のような状態も可能。

---

# 9. Reputation Is Observer Belief

ReputationはTruthを直接読まない。

```text
actual events
+ statistics
+ media narratives
+ repeated observation
+ hearsay / public discourse
        ↓
Reputation Belief
```

したがって:

- accurate reputation
- exaggerated reputation
- outdated reputation
- unfair reputation
- small-sample myth

が存在可能。

---

# 10. Reputation Evidence

候補モデル:

```ts
type ReputationSignal = {
  topic: ReputationTopic;
  direction: number;
  strength: number;
  confidence: number;
  evidence: number;
  lastUpdatedAt: SeasonTime;
};
```

Topic候補は必要以上に増やさない。

初期Family候補:

## Baseball Threat / Quality

- feared hitter
- ace
- difficult baserunner
- defensive specialist
- dangerous in clutch situations

## Reliability / Professionalism

- dependable
- inconsistent
- injury concern
- disciplined / prepared

## Social / Leadership

- leader
- mentor
- selfish
- difficult teammate

## Public Persona

- entertainer
- quiet professional
- controversial
- fan-friendly

## Tactical / Manager Reputation

Managerにも同じArchitectureを再利用できる。

- aggressive tactician
- conservative
- innovator
- stubborn
- strong postseason reputation

ただしManager Truth SkillをReputationから生成しない。

---

# 11. Reputation Descriptor, Not Ability

禁止:

```text
"勝負強いと評判"
 -> Contact +5
```

Reputationは:

- public presentation
- opponent belief
- manager belief if evidence is limited
- media narrative
- market / career context

へ作用し得る。

True Abilityは別。

---

# 12. "威圧感 / 存在感" Reinterpretation

既存Player Trait Catalogの判断を採用する。

```text
actual sustained threat
+ opponent observation
+ league-wide reputation
+ current context
        ↓
opponent Appraisal
        ↓
pitch / swing / tactical decision
        ↓
possible ActiveEmotion
```

禁止:

```text
威圧感
 -> opponent ability -10
```

例:

強打者へのReputationが高いPitcher / Managerなら:

- avoid zone more
- intentional-walk candidate more likely
- careful pitch selection
- defensive positioning changes

等が起こり得る。

その結果として:

- walk増加
- hitter-friendly counts
- fewer pitches in zone

等が生じる可能性はある。

これはReputationの実在する因果結果。

---

# 13. Reputation Can Be Wrong

重要Stress Test:

```text
small-sample success
+ huge media exposure
        ↓
"clutch hitter" reputation

but
true clutch-specific ability = ordinary
```

Opponentがその評判を信じれば:

```text
more cautious approach
 -> actual pitch distribution changes
```

可能。

しかしPlayer abilityは変わらない。

---

# 14. Popularity != Clubhouse Influence

Team Mood設計の承認済み境界を維持。

```text
Public Popularity
 !=
Clubhouse Influence
```

例:

```text
superstar
Popularity S
Clubhouse Influence D
```

可能。

逆:

```text
quiet veteran catcher
Popularity D
Clubhouse Influence S
```

可能。

「人気者」だからTeam Mood上昇は禁止。

---

# 15. Popularity != Reputation

さらに:

```text
popular
 != respected by opponents

feared
 != liked by fans

famous
 != good
```

を守る。

---

# 16. Popularity Descriptor — "人気者"

PowerPro的「人気者」はCareer / Presentation Derived Descriptorとする。

成立候補:

```text
meaningful Awareness
+ clearly positive Favorability
within relevant fan audience
        ↓
"人気者"
```

Trait自体は追加効果を持たない。

Source of Truth:

```text
AudienceStanding
 -> presentation projection
 -> 人気者
```

---

# 17. Scope-specific Popularity

PopularityはScopeを表示できる。

候補:

- 地元人気
- 球団人気
- リーグ人気
- 全国人気
- 国際人気

ただし通常UIでは全部並べない。

例:

```text
人気: A
主な支持: 地元 / 球団ファン
```

Optional detailでAudience別。

---

# 18. Star Status is Derived

「スター性」を独立Magic Statにしない。

候補:

```text
high Awareness
+ strong recent relevance
+ major performance / narrative
+ sustained visibility
        ↓
Star Status descriptor
```

Star Statusが能力を上げない。

---

# 19. Infamy / Villainy

High Awareness + Negative Favorabilityも価値ある状態。

```text
high awareness
+ strong negative favorability
        ↓
infamous / villain-like public status
```

これにより:

- away boos
- rivalry salience
- media attention
- opponent emotional significance

等が出せる。

Popularity modelを「好かれるほど有名」という一方向にしない。

---

# 20. Crowd Reaction

AudienceStandingからPresentationへ:

- cheers
- boos
- louder introduction
- banner / chant probability
- camera / broadcast focus
- retirement tribute
- return-to-former-club reaction

等を生成可能。

Crowd reaction itselfはMatch ability buffではない。

ただしPlayerが実際にCrowd EventをAppraiseすれば、
05 Psychology経由でEmotionPressureへ作用可能。

---

# 21. Media / Headline Salience

Awareness / Reputationにより:

- media coverage probability
- headline prominence
- storyline persistence

が変わり得る。

ただしMedia Systemの詳細は別設計。

Popularity側は:

```text
salience input / output contract
```

だけ持つ。

---

# 22. Career Consequences

将来接続候補:

- fan-vote all-star selection where competition rules permit
- jersey / merchandise demand
- attendance interest
- sponsor / commercial demand
- ceremonial role
- retirement attention
- Hall / legacy narrative
- club willingness to retain icon
- trade backlash / excitement

ただし:

```text
Popularity
 -> salary +X automatically
```

は禁止。

Front Office / EconomyがPopularityを一入力として評価する。

Userへcommercial micromanagementを要求しない。

---

# 23. Transfer / Trade Behavior

移籍でPopularityをresetしない。

例:

```text
old club supporters:
  attachment / nostalgia persists

new club supporters:
  awareness may already be high
  favorability starts from expectations / prior reputation
```

Rival transferなら:

- old audience favorability drop
- new audience excitement
- rival salience

等がEvent-drivenで発生可能。

固定ルールにはしない。

---

# 24. Local Hero

小規模League / Clubでも人気者は成立。

```text
global awareness low
+ local awareness high
+ local favorability very high
        ↓
local hero
```

世界的知名度が低いこととPopularityは矛盾しない。

---

# 25. Breakout Star

```text
low Awareness
+ unexpected performance
+ high-salience moments
        ↓
rapid Exposure
        ↓
Audience Appraisal
        ↓
Popularity may rise
```

ただし一週間の好調だけで全国Starへ瞬間昇格させない。

ExposureのScopeとpersistenceを要求。

---

# 26. Decline / Retirement

成績低下でPopularityを即消去しない。

```text
current relevance declines
but
historical attachment / legacy persists
```

Reputationは:

- current reputation
- legacy reputation

を将来分ける余地を持つ。

Retired legendのPopularity / Reputationを保存可能。

---

# 27. League / Region Boundaries

PopularityもDoctrineと同様、地域差を持つ。

```text
domestic star
 != automatically global star
```

Cross-region Awareness growthには:

- international competition
- transfer
- global media exposure
- records
- exceptional events

等のbridgeが必要。

ただし現代 / futureのMedia Environmentでbridge strengthは変わり得る。

---

# 28. Audience Appraisal

同じEventでもAudienceごとに違う。

例: rivalry walk-off HR

```text
home supporters
 -> strong positive

opponent supporters
 -> strong negative

neutral fans
 -> excitement / increased awareness
```

EventからGlobal Popularityへ直接加点しない。

---

# 29. Public Standing Update

候補flow:

```text
Canonical Career / Match Event
        ↓
Exposure Event
        ↓
Relevant Audiences selected
        ↓
Audience-specific Appraisal
        ↓
Awareness / Favorability update
        ↓
Reputation Evidence update
        ↓
Presentation / Career consequences
```

---

# 30. Anti-Monocausal Rule

Popularity単独で:

- player ability
- team winning
- development
- clubhouse mood
- contract success

を説明しない。

Reputation単独でも同様。

```text
Player Ability
+ Performance
+ Exposure
+ Audience
+ Career Context
+ Media
        ↓
public history
```

---

# 31. Simple Surface

通常Player UI候補:

```text
人気: A
知名度: 全国級

評判
・強打者として警戒されている
・ファン人気が高い
```

またはPowerPro-like Trait UIでは:

```text
人気者
威圧感
```

のみ表示し、
詳細画面で根拠へ掘れる。

---

# 32. Optional Deep View

```text
人気
  球団ファン      S
  リーグ一般      A
  全国            B
  海外            D

評判
  強打者          Very High confidence
  勝負強さ        Medium confidence
  リーダー        Low confidence
```

UI数値や文言は後続。

---

# 33. No Popularity Chore

Userへ:

- SNS更新
- 毎週ファンサ
- Media interview spam
- popularity meter grinding

を要求しない。

PopularityはCareer世界の結果として動く。

将来Media Eventを追加しても、
通常進行の必須Maintenanceにはしない。

Simple Surface, Deep Simulationを守る。

---

# 34. Determinism / Evidence

Popularity / Reputation updateもCareer simulationの正史。

同じ:

- events
- audience state
- media environment
- seed

なら同じ更新を再現可能。

重要Event / aggregate Evidenceを保存し、
全SNS投稿等のmicro-event保存は要求しない。

---

# 35. Initial Stress Tests

1. superstar with huge fame but low favorability
2. beloved local role player with low national awareness
3. quiet veteran with low popularity but high clubhouse influence
4. famous player with weak clubhouse influence
5. feared slugger who is disliked by rival fans
6. false "clutch" reputation from small sample
7. reputation changes opponent approach without changing raw ability
8. transfer preserves old-club audience history
9. retired legend remains famous after current ability disappears
10. breakout player gains exposure without instantly becoming global icon
11. domestic star remains relatively unknown abroad until bridge event
12. popularity never directly grants wins / batting / pitching skill

---

# 36. First Review Decisions

最初に確定したいのは以下。

1. Popularityを単一値にせず `Awareness + Favorability` へ分ける
2. Audience-specific Standingを採用する
3. ReputationをObserver Beliefとして分離する
4. Clubhouse Influenceを完全に別source of truthにする
5. 「人気者」をDerived Presentation Descriptorにする
6. 「威圧感 / 存在感」をReputation -> Opponent Appraisalへ接続する
7. Public Appealをslow inputとして持つか
8. local / league / national / international scopeを持たせる
9. PopularityはCareer / Presentation中心で、MatchへはCrowd / Appraisal経由のみ
10. Popularity maintenance choresを作らない
