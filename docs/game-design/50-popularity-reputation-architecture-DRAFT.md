# Popularity / Star Status Architecture — DRAFT

更新日: 2026-09-20  
状態: **CANONICAL / DESIGN FROZEN v1。実装前。**

関連:
- `docs/game-design/08-player-traits-design-seed.md`
- `docs/game-design/09-player-trait-catalog.md`
- `docs/game-design/20-simple-surface-deep-simulation.md`
- `docs/game-design/37-team-mood-architecture.md`
- `docs/game-design/49-manager-architecture-v1.md`

---

# 1. Revised Goal

「人気者」を野球能力・采配・対戦警戒から切り離す。

Popularity Systemの責務は:

- 観客の集まりやすさ
- 歓声 / ブーイング / 応援演出
- グッズ / ファンイベント等の二次的なCareer表現
- 世間での注目
- 放送 / Presentation上の扱い

まで。

禁止:

```text
人気者
 -> 相手投手が警戒
 -> 敬遠率上昇
```

相手を警戒するかどうかはManager / Player側の:

- data
- scouting
- opponent history
- current ability estimate
- game context

から決める。

PopularityはManager Decision Engineへ入力しない。

---

# 2. Three Separate Public Statuses

```text
人気者
Star
Superstar
```

を別概念にする。

---

# 3. 人気者 / Fan Favorite

定義:

> **能力や格とは独立して、ファンから親しまれ、応援されやすい人物。**

重要:

```text
人気者
 != Star
 != Superstar
```

例として想定する人物像:

- 明るく親しみやすい
- ファンサービスで愛される
- 独特なキャラクター
- 長く球団に在籍
- 地元との結びつきが強い
- ベンチ / 球場を盛り上げる存在
- 成績以上にファンから好かれる

川崎宗則やAlex Ramirezのような「人そのものを見たくなる」タイプを設計Motifとする。

ただし実在人物固有のTraitをhard-codeしない。

---

# 4. Fan Favorite Effects

人気者の効果は原則Presentation / Career side effectのみ。

候補:

- home attendance interest slightly rises
- player introduction cheers become louder
- fan signs / chants / banners appear more often
- merchandise demand rises
- fan-event salience rises
- retirement / return appearances receive stronger reaction
- broadcast camera / commentary may feature the player more often

これらはすべて二次的。

禁止:

- batting / pitching / fielding buff
- teammate buff
- opponent debuff
- manager tactical change
- hidden clutch bonus
- automatic Team Mood improvement

---

# 5. Popularity Does Not Need Baseball Greatness

```text
role player
+ strong fan affection
 -> 人気者
```

可能。

逆に:

```text
elite player
+ low fan attachment
 -> not necessarily 人気者
```

も可能。

これにより「人気者」を競技力の別名にしない。

---

# 6. Star

定義:

> **現在の競技世界で、中心選手として広く注目される存在。**

Star成立はPopularityではなく主に:

- current performance
- role importance
- awards / records
- playing time
- memorable baseball moments
- league visibility
- sustained relevance

からDerivedする。

```text
high competitive prominence
+ broad awareness
        ↓
Star
```

Starだからファンに好かれるとは限らない。

---

# 7. Superstar

定義:

> **Starの中でも、競技上の卓越性と広い認知が長期間・広範囲で成立した象徴的存在。**

候補条件:

- elite competitive prominence
- sustained performance
- major awards / records
- league-wide or national awareness
- repeated high-salience events
- broad cross-audience recognition

場合によっては国際的認知も含む。

```text
Star
+ exceptional sustained prominence
+ very broad awareness
        ↓
Superstar
```

ただしSuperstarはPopularityの上位Tierではない。

---

# 8. Orthogonal Relationship

三者は独立。

```text
人気者 = affection axis
Star = competitive prominence + recognition
Superstar = extreme sustained star status
```

例:

## A

```text
人気者: YES
Star: NO
Superstar: NO
```

愛されるRole Player。

## B

```text
人気者: YES
Star: YES
Superstar: NO
```

人気も実力もある主力。

## C

```text
人気者: NO
Star: YES
Superstar: NO
```

強いがFan Favoriteとは限らない。

## D

```text
人気者: YES / NO
Star: YES
Superstar: YES
```

SuperstarでもFan Favoriteかどうかは別。

---

# 9. Popularity Internal State

Popularityは単純な1bit Traitではなく、
内部ではAudienceごとのFan Affectionを持てる。

候補:

```ts
type FanStanding = {
  audience: AudienceKey;
  awareness: number;
  affection: number;
};
```

ただし通常UIでは複雑に見せない。

Audience候補:

- current club fans
- former club fans
- local region
- league-wide fans
- national audience
- international audience

意味のあるAudienceのみSparse保存。

---

# 10. Awareness and Affection

## Awareness

どれだけ知られているか。

## Affection

どれだけ「応援したい / 見たい / 好き」と思われているか。

人気者は:

```text
sufficient Awareness
+ high Affection
        ↓
Fan Favorite descriptor
```

ただしScope依存。

```text
local hero
nationally unknown
```

も可能。

---

# 11. Why Popularity Changes

候補入力:

- public personality
- fan interaction
- distinctive character
- long tenure
- local identity
- memorable moments
- comeback story
- underdog story
- ceremonial moments
- media exposure

成績もExposureを増やす一因にはなれるが、
人気そのものを自動生成しない。

---

# 12. Public Appeal

前DraftのPublic Appeal案は簡素化して残す候補。

目的:

> 同じ程度に知られていても、人によって「好かれやすさ」が違うことを説明する。

候補:

```text
Public Appeal
```

単一slow factor。

ただし直接:

```text
Public Appeal 90
 -> 人気者
```

にはしない。

実際のExposure / fan responseが必要。

詳細なCharisma / Humor / Looks / Media Skill等への分解はv1では行わない。

---

# 13. Popularity Update

```text
Career / Public Event
        ↓
Exposure
        ↓
Relevant Audience
        ↓
Fan response
        ↓
Awareness / Affection update
        ↓
Popularity presentation
```

「ホームラン1本 = 人気+3」の固定加算は禁止。

---

# 14. Star Status Update

Star StatusはPopularityとは別に:

```text
competitive performance
+ role importance
+ sustained visibility
+ major achievements
        ↓
Star evidence
```

で更新。

StarはBaseball Career Descriptor。

Popularity systemと二重加算しない。

---

# 15. Superstar Status Update

Superstarは短期爆発だけでは成立しにくい。

候補:

```text
Star status
+ sustained elite performance
+ major achievements
+ broad recognition
+ persistence
        ↓
Superstar
```

一週間の大活躍でSuperstarにはしない。

---

# 16. Tactical Responsibility Boundary — Revised

重要な責任分界。

```text
Fan Favorite / 人気者
 -> NO Manager tactical input

Star / Superstar
 -> may create Tactical Gravity
 -> Manager still owns the decision
```

Managerの警戒は:

```text
scouting
+ performance data
+ current player estimate
+ matchup history
+ role centrality
+ Star / Superstar-level competitive prominence
+ context
        ↓
Manager Belief
        ↓
tactical decision
```

Star / Superstarは戦術上の重要人物になり得る。

ただし:

```text
Superstar label
 -> automatic intentional walk
```

は禁止。

詳細:
- `docs/game-design/51-star-superstar-big-stage-architecture-DRAFT.md`

---

# 17. Reputation Split Off

前DraftでPopularityと一緒に扱っていた:

- feared hitter
- clutch reputation
- tactical reputation
- 威圧感 / 存在感

はPopularity Systemから外す。

これらは将来:

```text
Scouting / Manager Belief / Psychology / Public Reputation
```

の境界で別途整理する。

少なくともPopularityからManager Decisionへ流さない。

---

# 18. Crowd Presentation

人気者:

- cheering volume
- chant frequency
- signs / towels / banners
- fan reaction on introduction
- stronger homecoming reception

Star:

- broadcast focus
- pregame introductions
- featured matchup presentation
- media headline priority

Superstar:

- event-like arrival
- league / national spotlight
- larger away-game attention
- milestone presentation

これらはPresentation。

Match abilityへ直接フィードバックしない。

---

# 19. Attendance

人気者 / Star / SuperstarはAttendance interestの入力になれる。

ただし:

```text
one popular player
 -> stadium always sold out
```

は禁止。

Attendanceは将来:

- club popularity
- team performance
- stadium
- opponent
- day / event
- ticket environment
- player draw

等の複合結果。

Popularityは小さな一入力。

---

# 20. Merchandise / Commercial Side Effects

候補:

- jersey sales
- merchandise
- fan-event demand
- sponsor visibility
- player-feature content

ただしFront Office micromanagementへはしない。

UserはPopularity meterを育成するために毎週営業活動をしない。

---

# 21. Transfer

移籍してもPopularity履歴は残る。

```text
old club fans
 -> affection / nostalgia may persist

new club fans
 -> awareness carries over
 -> affection develops separately
```

Star / Superstar statusも原則resetしない。

ただし新LeagueではAwareness Scopeが変わり得る。

---

# 22. Retirement / Legacy

人気者は引退後も「愛された選手」として残り得る。

Star / SuperstarはLegacyへ接続可能。

ただしHall / Legacy詳細は将来設計。

---

# 23. Match Effect Boundary — Revised

Fan Favorite / 人気者はMatch能力へ作用しない。

Star / Superstarもraw abilityを直接変更しない。

ただしStar / Superstarには別Source of Truthとして:

```text
Match Salience
+ Spotlight Response
 -> Condition / Appraisal distribution
 -> actual execution
```

を認める。

したがって大舞台で調子が上向きやすいPlayerは存在可能。

禁止:

- Contact / Power / Velocity等への固定加算
- Superstar labelそのものからの自動Buff
- guaranteed clutch success

詳細:
- `docs/game-design/51-star-superstar-big-stage-architecture-DRAFT.md`

---

# 24. No Team Mood Shortcut

```text
人気者
 -> Team Mood +
```

は禁止。

Clubhouse Influenceは別System。

人気者がClubhouseでも愛される場合は、
Relationship側に独立Evidenceが必要。

---

# 25. Simple UI

通常:

```text
人気者
スター
スーパースター
```

のDescriptor表示で十分。

Optional:

```text
人気
  球団ファン: とても高い
  全国: 高い

Star Status
  League Star

Superstar
  No
```

程度。

---

# 26. Stress Tests

1. beloved bench player can be 人気者 without being Star.
2. elite Star can exist without 人気者.
3. Superstar can be polarizing.
4. local 人気者 can remain nationally obscure.
5. transfer preserves former-club affection.
6. popularity raises cheers / fan interest but not tactical caution.
7. Manager does not use Popularity / Star labels for matchup decisions.
8. popular player does not automatically improve Team Mood.
9. Star status comes from competitive prominence, not affection.
10. Superstar requires sustained broad prominence.
11. all three statuses can coexist independently.
12. no status directly changes Match ability.

---

# 27. Current Recommended Decisions

推奨:

1. `人気者 / Star / Superstar` を別Descriptorにする。
2. 人気者はFan Affection中心。
3. StarはCompetitive Prominence + Awareness。
4. Superstarは長期・広域の極端なStar Status。
5. PopularityはManager Decisionへ接続しない。
6. Crowd / Attendance / Merchandise / Presentation程度の二次効果に限定。
7. Clubhouse Influenceとは完全分離。
8. Public Appealは人気形成のslow inputとして1軸だけ残す。
9. Reputation / 威圧感はPopularityから切り離し、別設計へ戻す。
10. 人気者は「強い選手」の別名にしない。


---

## Star / Superstar big-stage follow-up

2026-09-20 user clarified:

- `人気者` is largely secondary / fan-facing.
- `Star / Superstar` can matter tactically.
- Star / Superstar can also differ in high-pressure / big-stage Condition response.
- Manager still owns the tactical decision through scouting / data / Manager Belief.
- Superstar big-stage performance must route through underlying `Spotlight Response`, not a magic label buff.

Detailed draft:
- `docs/game-design/51-star-superstar-big-stage-architecture-DRAFT.md`


---

# 28. 本書の確定範囲

2026-09-20 user approved v1.

Canonical:

- 人気者 / Fan Favorite is fan-affection / presentation focused.
- Fan Favorite does not affect Manager tactical decisions.
- Crowd / attendance interest / merchandise / presentation are secondary effects.
- Clubhouse Influence is a separate Team Mood / Relationship source of truth.
- Star / Superstar are not one popularity ladder.
- Star / Superstar detailed competitive / big-stage mechanics are defined in:
  - `docs/game-design/51-star-superstar-big-stage-architecture-DRAFT.md`

Deferred:
- detailed Media simulation
- sponsor economics
- Hall / Legacy mechanics
- exact attendance / merchandise formulas
- exact Public Appeal calibration
