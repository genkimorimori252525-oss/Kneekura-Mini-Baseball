# Team Traits & Player Relationship Network — DRAFT

更新日: 2026-09-20  
状態: **設計候補。USER REVIEW REQUIRED。実装前。**

> この文書は、チーム特殊能力 / 選手間関係値の初期設計案。
> ユーザー承認前に正史化しない。

関連:
- `docs/game-design/05-psychology-emotion.md`
- `docs/game-design/08-player-traits-design-seed.md`
- `docs/game-design/09-player-trait-catalog.md`
- `docs/game-design/20-simple-surface-deep-simulation.md`
- `docs/game-design/31-scouting-recruitment-system.md`
- `docs/game-design/33-rivalry-lifecycle-model.md`

---

# 1. Core Idea

チーム特殊能力は:

```text
team-wide magic buff
```

ではなく、

```text
relationship
+ shared experience
+ recent events
+ confidence / pressure
+ coordination
+ tactical familiarity
        ↓
temporary team state
        ↓
named Team Trait
```

として表現する。

Team TraitはPennant中に:

- acquire
- activate
- weaken
- expire
- disappear

できる。

---

# 2. Three Separate Concepts

混同しない。

```text
Player Relationship
 = 選手同士の関係 / 信頼 / 共有経験

Team Mood
 = チーム全体の心理・雰囲気
   ※別設計で後続

Team Trait
 = 条件を満たした時に表面化する
   名前付きTeam State
```

---

# 3. Player Relationship Network

Relationはpair単位。

内部候補:

```ts
type PlayerRelationshipState = {
  fromPlayerId: PlayerId;
  toPlayerId: PlayerId;

  affinity: number;
  trust: number;
  communicationFamiliarity: number;
  sharedSuccessMemory: number;
  conflictMemory: number;

  lastMeaningfulInteraction: SeasonTime;
};
```

A -> B と B -> A は完全同値でなくてよい。

ただし守備連携のようなshared coordinationは双方の観測からDerivedしてよい。

---

# 4. Hard Rule — Bad Relationship Must Not Nerf Batting Skill

恒久原則。

禁止:

```text
Player A dislikes Player B
 -> A contact -5
 -> B power -5
```

禁止:

```text
new player joins
star dislikes newcomer
 -> star batting gets worse
```

野球の打撃は基本的に個人競技。

関係値が悪いだけでBase Batting Abilityを下げない。

---

# 5. Positive Batting Relationship

打撃ではRelationshipを**positive-only opportunity**として扱う。

```text
teammate success
+ strong positive relationship
+ lineup proximity
+ shared success memory
        ↓
positive emotional contagion
        ↓
motivation / confidence pressure rises
        ↓
ActiveEmotion = やる気
if threshold crossed
```

これにより:

- 連打が続きやすい
- 好調な打線がさらに勢いに乗る
- 仲の良い中軸が連鎖する

ことはあり得る。

ただし:

```text
relationship high
 -> contact +X
```

ではない。

本人のTrue Batting Skillは変えない。

---

# 6. Motif — Linked Hitters

モチーフ:

- Bass / Kakefu / Okada的な三者連続の爆発
- Ohtani / Trout的な連続長打・連鎖

これを固定人物Traitにしない。

```text
strong pair / cluster relationship
+ positive shared memories
+ actual lineup adjacency
+ current game success
        ↓
Rally Resonance
```

候補Team Trait:

- 打線連鎖
- 連打の気配
- 中軸共鳴

UI名称は後で確定。

---

# 7. No Negative Batting Chain from Relationship Alone

Relationが低い場合:

```text
positive contagion absent
```

になるだけ。

```text
negative relation
 -> batting penalty
```

にはしない。

ただし実際に:

- conflict
- harassment
- public dispute
- role dissatisfaction

等が本人の心理へ届いた場合、その**本人だけ**がCondition / Appraisal悪化する可能性はある。

これはRelationshipから全員へBuff/Debuffを撒く処理ではない。

---

# 8. Defense is Different

守備は複数人共同作業なので、低いcommunication / familiarityが実際の失敗を生み得る。

例:

```text
fly ball
↓
LF and CF both pursue
↓
communication confidence low
↓
call timing delayed
↓
both hesitate
↓
お見合い
```

また:

- cut-off relay
- cover responsibility
- double-play feed
- bunt defense
- rundown
- catcher / pitcher communication

等へ影響可能。

---

# 9. Defense Uses Coordination, Not Friendship

仲が良いだけで守備が上手くなるわけではない。

```text
shared reps
+ trust
+ communication familiarity
+ tactical understanding
        ↓
Defensive Coordination
```

友人ではなくてもProfessional Coordinationが高ければ問題ない。

逆に仲が良くても練習不足なら連携ミスは起こり得る。

---

# 10. Team Trait Definition

```ts
type ActiveTeamTrait = {
  traitId: TeamTraitId;
  polarity: "POSITIVE" | "NEGATIVE";
  sourceFamily: TeamTraitSourceFamily;

  activationCondition: TeamTraitCondition;
  acquiredAt: SeasonTime;
  expiresAt?: SeasonTime;
  evidenceStateId: TeamEvidenceStateId;

  strengthTier: number;
};
```

Source families候補:

- RELATIONSHIP_DERIVED
- COORDINATION_DERIVED
- MOMENTUM_DERIVED
- PRESSURE_DERIVED
- TACTICAL_DERIVED
- SLUMP_DERIVED
- CONTEXT_DERIVED

---

# 11. Team Trait is not Source of Truth

```text
actual team state
 -> Team Trait label
```

を原則とする。

禁止:

```text
Team Trait acquired
 -> magically raises team stats
```

Traitが作用する場合も:

- Appraisal
- emotion activation threshold
- communication timing
- role confidence
- tactical compliance
- recognition / preparation quality

等の中間変数へ接続する。

---

# 12. Positive Team Trait Candidates

## 打線連鎖

Source:

- positive relationship clusters
- recent shared success
- lineup continuity

Effect boundary:

```text
teammate hit / HR
 -> positive emotional contagion stronger
 -> next linked hitter more likely to activate positive state
```

Base contact / powerは上げない。

## 逆境オーラ

Source:

- repeated successful comebacks
- confidence under deficit

Condition:

- late inning
- trailing

Effect:

- positive appraisal under deficit
- panic / fear less likely
- motivation more likely

## 好機必打

Source:

- repeated high-leverage success
- stable positive expectation

Condition:

- high leverage / scoring chance

Effect:

- pressure appraisal more positive
- not direct Chance rating +1

## 鉄壁リリーフ陣

Source:

- bullpen role clarity
- repeated late-inning success
- catcher / bullpen trust

Effect:

- reliever pressure appraisal more stable
- role confidence
- catcher-pitcher communication

Pitching True Abilityは上げない。

## 守備連携

Source:

- shared defensive reps
- communication familiarity
- tactical continuity

Effect:

- lower communication latency
- clearer responsibility resolution
- smoother cut-off / cover movement

---

# 13. Context Team Trait Candidates

画像モチーフのように、Team TraitはCondition付きでよい。

例:

- Home specialist
- Day-game specialist
- comeback specialist
- deciding-game confidence

ただし`home +5`等ではなく、実在する:

- routine familiarity
- visual / environmental familiarity
- psychological expectation
- schedule adaptation

へ接続する。

---

# 14. Negative Team Traits Exist

Team TraitはPositiveだけではない。

Red Team Traitは:

> チーム全体にのしかかる悪い空気 / 失敗期待 / 連携崩壊

を表現できる。

ただしDirect Loss Bonusは禁止。

禁止:

```text
連敗病
 -> loss probability +10%
```

正しくは:

```text
recent repeated failure
        ↓
negative collective expectation
        ↓
pressure appraisal becomes harsher
        ↓
negative ActiveEmotion more likely
        ↓
communication / decision errors may emerge
        ↓
actual play determines result
```

---

# 15. Negative Trait Candidates

## タイムリー欠乏症

Source:

- repeated RISP failures
- repeated high-leverage failures

Condition:

- scoring position / high leverage

Effect:

- collective negative expectation rises
-焦り / 恐怖 / 打ち急ぎ等のAppraisalが出やすい

Base contactは下げない。

## 終盤恐怖症

Source:

- repeated blown leads
- repeated walk-off losses

Condition:

- late close game

Effect:

- pitchers / fieldersがpressureを重く受けやすい
- defensive communication hesitation
- decision finalization timing may worsen

## サヨナラ負け癖

Source:

- repeated walk-off losses

Condition:

- away / late / tied or narrow lead

Effect:

- negative anticipation
- bullpen / defense pressure

Direct walk-off probability modifierは禁止。

## 5割の壁

Source:

- repeated failures around a symbolic standings threshold

Condition:

- approaching .500 / specified threshold

Effect:

- collective pressure / expectation burden

## 初物苦手

これはMoodだけでなくPreparation / Scouting型。

Source:

- poor performance vs unseen starters
- weak pregame shared preparation

Condition:

- first exposure to unfamiliar starter

Effect:

- initial recognition confidence lower
- adaptation takes longer

Base batting能力を下げない。

## 連敗病

Source:

- losing streak
- repeated close losses

Effect:

- negative emotional contagion more likely
- positive contagion weaker
- defensive hesitation more likely

ただしstreak自体からLoss Chanceを加算しない。

---

# 16. Dark Era Emergence

「暗黒期」を一つの-10 Traitにしない。

むしろ:

```text
bad bullpen memories
+ poor relationships
+ losing streak
+ defensive miscommunication
+ manager trust problems
+ negative fan expectation
        ↓
multiple Red Team Traits coexist
        ↓
"everything goes wrong" feeling
```

を自然発生させる。

つまり:

> 暗黒期はResultではなく、複数の悪いStateが重なった観測結果。

---

# 17. Anti-Snowball Guardrails

Red Traitが自己増殖して永遠に負け続けるのを防ぐ。

候補安全柵:

- no direct win/loss probability modifier
- no base batting/pitching rating debuff
- one failure does not refresh every Red Trait
- same source event has cooldown
- positive meaningful events accelerate recovery
- player mental stability can resist team pressure
- roster turnover can weaken old negative memories
- manager change may reset tactical / trust-related traits
- Red Trait has evidence decay / expiry

---

# 18. Team Trait Lifecycle

候補:

```text
EVIDENCE
 -> CANDIDATE
 -> ACTIVE
 -> FADING
 -> EXPIRED
```

取得条件:

- enough evidence
- source state threshold crossed

消失条件:

- expiry
- source evidence decays
- opposite evidence accumulates
- roster / manager context changes

---

# 19. Duration Families

画像モチーフを採り入れ、Team Traitごとに有効期限を持てる。

候補:

- SHORT: days / 1–3 weeks
- MEDIUM: 1–3 months
- SEASON: until season end
- EVIDENCE_BASED: source stateが閾値を下回るまで

恒久Team Traitは原則作らない。

歴史的Club Identityとは分離する。

---

# 20. Relationship Change

Relationは固定しない。

増加候補:

- shared success
- repeated lineup / battery pairing
- mutual support events
- long tenure
- successful comeback together
- mentoring

減少候補:

- public conflict
- role competition
- blame after mistake
- ignored tactical communication
- transfer dispute
- personal incident

ただしRelation低下が即Base Ability低下にはならない。

---

# 21. Relationship Clusters

Relation GraphからClusterを作れる。

例:

```text
A ↔ B high
B ↔ C high
A ↔ C high
        ↓
strong trio cluster
```

Lineup上で近接すれば:

- Rally Resonance
- positive emotional contagion

が出やすい。

守備位置が近接すれば:

- communication
- coordination

が高まりやすい。

---

# 22. Clubhouse Conflict Boundary

Relationshipが低いだけではGameplay penaltyを与えない。

ペナルティが出るのは:

```text
low relationship
+ actual conflict event
+ player appraisal
+ persistent dissatisfaction
        ↓
individual condition / mood impact
```

原則:

> 悪い関係の犠牲になるのは、関係の当事者と共同作業だけ。

無関係なスター選手の打撃まで落とさない。

---

# 23. Team Mood Boundary

Team Moodは次テーマ。

この文書では以下だけ確定候補。

```text
Relationship Network
        ↓
one input to Team Mood

Recent Team Events
        ↓
another input to Team Mood

Team Mood
        ↓
may help create Team Traits
```

Team MoodとTeam Traitを同一値にしない。

---

# 24. Screenshot Motif Reinterpretation

添付画像のようなTeam Special Ability UI:

- 逆境オーラ
- サヨナラ系
- Day / Home specialist
- 鉄壁リリーフ
- 好機必打
- タイムリー欠乏
- 初物苦手
- 5割の壁

という「名前付き・期間付き・条件付き」の体験は維持できる。

ただし内部は:

```text
named team trait
 -> causal intermediate state
 -> actual play
```

であり:

```text
named team trait
 -> direct outcome probability
```

にはしない。

---

# 25. User-facing Simplicity

通常画面:

```text
チーム得能

[青] 打線連鎖
      連打時に勢いが広がりやすい
      残り: 18日

[青] 守備連携
      内外野の連携が安定
      今季終了まで

[赤] タイムリー欠乏症
      得点圏で悪い空気が出やすい
      残り: 9日
```

内部Relation GraphやAppraisal数値は表示不要。

---

# 26. Test Principles

- negative player relationship alone never lowers batting true ability
- positive relationship can create positive contagion opportunity
- defense coordination can suffer from low communication familiarity
- friendship alone does not raise fielding skill
- Team Trait never directly changes win probability
- Team Trait never directly adds contact / power / velocity
- Red Team Trait may affect Appraisal / coordination / decision timing
- Dark Era can emerge from several Red states without a single "暗黒補正"
- new player conflict does not nerf unrelated star batting
- Team Trait can appear and disappear during pennant
- CPU Club uses same system
- no renderer dependency

---

# 27. Approval Questions

次にユーザーと詰める点:

1. RelationのPublic UIを数値表示するか、段階表示だけにするか
2. BattingのPositive Relationship効果をActiveEmotion経由に限定するか
3. Defensive CoordinationをRelationから分離した別値にするか
4. Team TraitのBlue / Red / Gold分類を採用するか
5. Team Traitの有効期限をSHORT / MEDIUM / SEASON / EVIDENCE_BASEDで持つか
6. 「暗黒期」を独立Traitにせず、複数Red Traitの重なりとして扱うか
7. negative relationshipのPenaltyを共同作業 / 当事者心理だけに限定するか
8. Rally Resonanceの発動をlineup adjacency + relation clusterから作るか
