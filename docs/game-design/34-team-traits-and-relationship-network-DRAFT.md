# Team Traits & Player Relationship Network — DRAFT

更新日: 2026-09-20  
状態: **部分承認済み設計候補。USER REVIEW REQUIRED。実装前。**

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

# 0. User-approved Decisions — 2026-09-20

以下はユーザー承認済み。

1. Team Traitの色分類は **Blue / Red / Gold** を採用する。
2. Player Relationshipは **好感 / 信頼 / 連携** の3軸へ分ける。
3. 悪いRelationshipだけで打者のBase Batting Abilityを低下させない。
4. Relation由来の打撃効果は原則positive-sideに限定する。
5. 守備等の共同作業では低い連携が実際の連携ミスへつながり得る。
6. Team TraitはPennant中に取得・発動・減衰・消失できる。

文書全体はまだDRAFTであり、具体Trait一覧・閾値・式は追加監修が必要。

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

  affinity: number;      // 好感: 0..100
  trust: number;         // 信頼: 0..100
  coordination: number;  // 連携: 0..100

  sharedSuccessMemory: number;
  conflictMemory: number;

  lastMeaningfulInteraction: SeasonTime;
};
```

A -> B と B -> A は完全同値でなくてよい。

ただし守備連携のようなshared coordinationは双方の観測からDerivedしてよい。

## 3.1 好感 / Affinity

感情的な親しさ・好意。

主な作用先:

- positive emotional contagion
- teammate successへの喜び / 刺激
- clubhouse interaction
- conflict recovery

低いだけではBase Abilityを下げない。

## 3.2 信頼 / Trust

「この相手なら任せられる」という期待。

主な作用先:

- teammate callを信じてcommitするか
- mistake後も相手を信頼して次のplayへ入れるか
- catcher / pitcher decision acceptance
- tactical communication acceptance

信頼は好感と別。

仲が良くなくてもProfessional Trustが高いpairは成立する。

## 3.3 連携 / Coordination

一緒に動く時のshared timing / procedure familiarity。

主な作用先:

- fielding responsibility resolution
- cut-off relay
- double play
- cover movement
- rundown
- battery coordination
- selected baserunning cooperation

連携は最もjoint-action寄りの軸。

単なる友人関係では上がらない。

shared reps / practice / successful executionから主に形成する。

## 3.4 Directionality

好感と信頼は原則directional。

```text
A -> B affinity = 90
B -> A affinity = 62
```

を許可する。

連携は実装上directional evidenceを持ってもよいが、共同作業時は双方の連携・shared repsからPair CoordinationをDerivedする。

候補:

```text
PairCoordination
 = f(A->B coordination, B->A coordination, shared reps, role familiarity)
```



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


# 6.1 Batting Resonance Eligibility — 重要な線引き

Team Relationshipから生じる打撃連鎖は、**成功内容をそのまま相手へコピーしない。**

禁止:

```text
Slugger A hits HR
        ↓
Contact hitter B gets HR bonus
```

Bが本来持っていないPower / launch / bat-speed能力をRelationが作ってはいけない。

正しい構造:

```text
A succeeds
+ B has strong affinity / trust with A
        ↓
B receives positive emotional stimulus
        ↓
B's own offensive archetype determines expression
```

例:

```text
A = home-run slugger
B = home-run slugger
        ↓
HR event may activate POWER_RESONANCE in B
        ↓
B may choose / execute own existing power approach more confidently
```

一方:

```text
A = home-run slugger
B = contact / line-drive hitter
        ↓
B receives positive contagion
BUT
HR-specific resonance is ineligible
        ↓
B may instead express CONTACT_RALLY / LINE_DRIVE confidence
```

RelationはPlayer Archetypeを変えない。

---

# 6.2 Resonance Channel

打撃共鳴はPlayerのTrue Profileからeligible channelを選ぶ。

候補:

```ts
type OffensiveResonanceChannel =
  | "POWER"
  | "CONTACT"
  | "ON_BASE"
  | "SPEED_PRESSURE"
  | "NONE";
```

Channel判定候補:

- underlying power / bat speed
- launch-angle tendency
- hard-contact ability
- contact precision
- plate discipline
- baserunning aggression
- player behavior / swing preference

**Relation scoreからChannelを決めない。**

---

# 6.3 POWER Resonance

ON砲のような「片方が本塁打を打つと、もう片方もその試合で長打モードへ入りやすい」体験の候補。

必要条件候補:

```text
A hits HR
AND
B has POWER-eligible offensive profile
AND
A <-> B relationship is strong enough
AND
B meaningfully appraises A's success
        ↓
POWER_RESONANCE pressure
```

作用先候補:

- positive ActiveEmotion activation probability
- confidence in existing power swing decision
- willingness to use existing launch / pull-power approach
- hesitation reduction

禁止:

- raw Power increase
- bat speed increase beyond true capability
- exit velocity bonus
- forced HR probability modifier

つまり、Bが元から持つPowerを**発揮しやすい心理 / 選択状態**へ入れるだけ。

---

# 6.4 Contact / Other Resonance

同じtriggerでも受け手のProfileが違えば違う形で出る。

例:

```text
Slugger A HR
        ↓
Contact hitter B
        ↓
CONTACT_RALLY
        ↓
positive confidence / timing commitment
        ↓
BはBらしくhitを狙う
```

```text
Contact hitter A gets clutch single
        ↓
Slugger B
        ↓
positive contagion may occur
BUT
Aのsingleを理由にBへContact能力を付与しない
```

**成功の形式ではなく、成功による感情刺激を共有する。最終的な表現は受け手自身の能力Profileが決める。**

---

# 6.5 Highest Batter Relationship Expression

高い好感・信頼・共有成功記憶を持つPower-compatible pair / clusterでは、Gold Team Trait候補として:

- 共鳴砲
- 連弾
- 双砲共鳴

等を表示可能。

これはTeam Traitだがscopeは全打者ではない。

```ts
type TeamTraitScope =
  | { kind: "TEAM_ALL" }
  | { kind: "UNIT"; unitId: string }
  | { kind: "PAIR"; playerIds: [PlayerId, PlayerId] }
  | { kind: "CLUSTER"; playerIds: readonly PlayerId[] }
  | { kind: "CONTEXTUAL_ELIGIBLE" };
```

POWER系共鳴は原則PAIR / CLUSTER scope。

チーム全員へHR resonanceを配らない。


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


# 10.1 Team Trait Color Contract — Approved

Team TraitはBlue / Red / Goldの3分類。

## Blue

有利な一時Team State。

例:

- 打線連鎖
- 守備連携
- 逆境オーラ
- 好機必打
- 鉄壁リリーフ陣

## Red

不利なTeam State / 悪い空気 / coordination breakdown。

例:

- タイムリー欠乏症
- 終盤恐怖症
- サヨナラ負け癖
- 初物苦手
- 5割の壁
- 連敗病

RedもDirect Outcome Debuffは禁止。

## Gold

Blue Familyのexceptional / master tier。

Goldと同FamilyのBlueは二重適用しない。

例:

```text
Blue: 打線連鎖
Gold: 共鳴打線 / 共鳴砲
```

```text
Blue: 守備連携
Gold: 鉄壁連携
```

Goldも魔法Buffではなく、非常に強いunderlying evidence / shared stateの表示とする。


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
2. Batting ResonanceをActiveEmotion + own-archetype expressionで確定するか
3. Pair / Cluster Team Trait Scopeを正式採用するか
4. Team Traitの有効期限をSHORT / MEDIUM / SEASON / EVIDENCE_BASEDで持つか
5. 「暗黒期」を独立Traitにせず、複数Red Traitの重なりとして扱うか
6. Rally Resonanceの発動にlineup adjacencyを必須とするか、同一試合内なら離れた打順でも成立させるか
7. POWER / CONTACT / ON_BASE / SPEED_PRESSUREのChannel境界値をどう定義するか
8. Gold Team Traitの取得条件をshared success回数 / relation / current evidenceでどう組むか


Team Trait Catalog (USER REVIEW REQUIRED):
- `docs/game-design/35-team-trait-catalog-DRAFT.md`

---

# 28. Offseason Relationship Carryover

Player Relationship自体はSeason終了でresetしない。

## Affinity / 好感

- 原則carryover
- off-seasonだけで急落しない
- 長期間の疎遠 / conflict / transfer context等でslow change

## Trust / 信頼

- 原則carryover
- role change / repeated failure / betrayal-like event等で変化
- 同じClubに残れば比較的維持しやすい

## Coordination / 連携

- carryover可能だが、3軸で最もrole依存
- 同じ守備位置 / battery / unitなら高く維持
- role change / long separation / new tactical systemでdecay
- transferした場合はactive coordinationからDormant Shared Experienceへ移行可能

例:

```text
SS A + 2B B
5 seasons together
coordination = high

B transferred
 -> pair coordination no longer active
 -> shared experience is not erased

3 years later reunion
 -> starts above zero
 -> faster re-synchronization possible
```

RelationshipはPlayer間Historyであり、Team Traitより長寿命。

Team TraitのSeason Boundary policyは `35-team-trait-catalog-DRAFT.md` を参照する。
