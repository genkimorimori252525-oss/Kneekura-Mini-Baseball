# Kneekura Mini Baseball — Current Design Handoff

更新日: 2026-09-20  
対象branch: `jolly/core-foundation-plan-2026-09-17`

この文書は、新しいChatGPT / Jolly sessionが設計思想を最短で復元するためのhandoff。

## Document Lifecycle / Source Precedence Guard — 2026-09-22

このhandoffでは、**ファイル名ではなく文書内の現在Statusと後継Canonical文書を優先**する。

AI / Agent向け強制ルール:

1. ファイル名に `-DRAFT` が残っていても、それだけで「未確定」と判定しない。
2. `ARCHIVED` / `SUPERSEDED` / `旧計画` は履歴資料であり、現在の設計候補・未確定計画として数えない。
3. `VALIDATION CATALOG` は検証資料であり、現在の設計計画として数えない。
4. 後継 `CANONICAL / DESIGN FROZEN` 文書がある場合、旧DRAFTより後継を優先する。
5. 「まだ実装されていない」「数値校正が残っている」「Future Referenceである」ことと、「設計が未確定」であることを混同しない。

### 現在、USER REVIEW REQUIREDとして残る設計

- `32-roster-development-architecture-DRAFT.md`
- `34-team-traits-and-relationship-network-DRAFT.md`
- `35-team-trait-catalog-DRAFT.md`
- `38-team-mood-manager-interventions-DRAFT.md`
- `41-manager-appointment-and-incompetence-DRAFT.md`
- `42-manager-market-and-front-office-selection-DRAFT.md`

### 旧計画 / 後継へ統合済み

以下は **旧計画**。未確定計画一覧へ入れない。

- `39-manager-philosophy-and-command-architecture-DRAFT.md`
- `40-manager-ratings-era-and-strategy-evolution-DRAFT.md`
- `43-manager-strategy-evolution-architecture-DRAFT.md`
- `45-manager-decision-engine-and-temperament-DRAFT.md`
- `46-manager-rare-tactics-psychological-play-and-decision-log-DRAFT.md`
- `47-manager-candidate-evaluation-and-gimmick-control-DRAFT.md`

これらの後継Source of Truthは:

- `49-manager-architecture-v1.md` — **CANONICAL / DESIGN FROZEN v1**

`44-manager-real-world-tactical-stress-tests-DRAFT.md` は **VALIDATION CATALOG** であり、未確定計画ではない。

### ファイル名だけDRAFTが残るCanonical文書

以下はファイル名に `-DRAFT` が残っているが、内容は **CANONICAL / DESIGN FROZEN v1**。未確定計画として数えない。

- `50-popularity-reputation-architecture-DRAFT.md`
- `51-star-superstar-big-stage-architecture-DRAFT.md`

補足:
- `52-star-superstar-genesis-v1.md` はCanonical supplement。
- 古い節に `CURRENT DRAFT` 等の時系列記録が残っていても、この節のSource Precedenceを優先する。

---

# 1. Game Slogan

> **一見シンプルだが、奥深い。**

表面の操作を複雑にしない。

内部Simulationは現実的・因果的にしてよい。

```text
Simple User Action
        ↓
Deep Hidden Simulation
        ↓
Understandable Baseball Result
```

---

# 2. Match Philosophy

Match CoreはOutcome-firstではなくCausal。

```text
Pitch World State
+ Batter Swing State
 -> Bat-Ball Contact
 -> Batted Ball Initial State
 -> Ball Physics
 -> Defender Perception / Movement
 -> Baseball Result
```

PresentationはMatch Coreを観測するだけ。

ASCII / Drone-Artを正史にしない。

---

# 3. No Magic Modifier

絶対原則。

```text
label
 -> direct ability buff
```

を禁止する。

例:

```text
Bayernだから強い
Rivalだから+10
LeagueがMLBだから能力+5
金持ちだからcontact+5
```

は禁止。

必ず中間因果を通す。

---

# 4. Player / Trait Philosophy

RatingやTraitは可能な限り:

- perception
- timing
- acceleration
- accuracy
- decision
- recognition
- trajectory prediction
- appraisal
- ActiveEmotion

等の中間変数へ接続する。

Gold / Blue / Red等のTrait displayはsource of truthではない。

---

# 5. Psychology

Emotionは常時Buffではない。

```text
context
 -> PersonalStake
 -> Appraisal
 -> EmotionPressure
 -> threshold
 -> ActiveEmotion
 -> behavior / execution
```

Rivalryもここへ接続する。

---

# 6. League Ecology

League名による能力補正は禁止。

Leagueの個性は:

- player population
- development
- scouting
- tactical tendencies
- exposure / familiarity
- stadium / environment
- rules
- history

からEmergentに作る。

---

# 7. Competition Regions

国際大会上のRegionは4つ。

```text
ASIA_PACIFIC
AMERICAS
EUROPE
AFRICA
```

Australia / New Zealand / Pacificは:

```text
geographicRegion = OCEANIA
competitionRegion = ASIA_PACIFIC
```

APBCLへ参加する。

---

# 8. World Club Source Policy

原則:

```text
major baseball club culture exists
 -> real baseball clubs

baseball is not the major club culture
 -> real football clubs as baseball clubs
```

Explicit exception:

- ChinaはBaseball Leagueが存在してもFootball Club sourceを使う

Europe / Russia / West-South Asia / China / NZ-Pacific / Pan-AfricaはFootball-derived。

Japan / Korea / Taiwan / North America / Mexico / Caribbean / Cuba / AustraliaはBaseball-derived。

---

# 9. Current World Scale

Full Leagues: 21

Current initial clubs: **234**

```text
Asia-Pacific  7 leagues / 62 clubs
Americas      6 / 86
Europe        7 / 74
Africa        1 / 12
```

Taiwan:
- current CPBL 6 clubs
- 100-game Regular Season

Australia:
- current 2026 ABL 4 clubs
- 108-game Regular Season
- Top-2 Final

All Full Simulation Leagues:
- minimum 100 Regular Season games

---

# 10. Club Philosophy

Club strength is not a single source-of-truth value.

Club data lifecycle:

```text
L0 Identity
L1 Institutional Slow State
L2 Seasonal State
L3 Live State
L4 Derived View
```

Real-world financial / club data is Initial Seed only.

Career begins:

```text
real-world snapshot
 -> initial world seed
 -> simulation starts
 -> real world disconnected
```

Existing Save must never be rewritten by future real-world changes.

---

# 11. Structural Giants

Real Madrid / Bayern / PSG / Barcelona等が長期的に強い理由はStructural Capital。

Examples:

- supporter capital
- brand capital
- commercial network
- stadium / assets
- institutional know-how
- recruitment network
- academy know-how
- financing access
- ownership backing

One bad season does not destroy these.

A giant becoming sustained bottom-tier requires explainable historic collapse.

Every `MEGA -> LOW` transition must be explainable from Club History.

---

# 12. Simple Surface Club UI

通常UIは原則5軸。

```text
資金力
人気
育成
スカウト
球場・設備
```

内部は0–100。

通常表示はS〜G。

These values are Initial Seeds / current summaries, never Match Core Buffs.

---

# 13. Club Initial Seed Files

- `26-club-initial-seed-rating-model.md`
- `27-asia-pacific-club-initial-seeds.md`
- `28-americas-club-initial-seeds.md`
- `29-europe-africa-club-initial-seeds.md`

All 234 clubs have initial five-axis seeds.

---

# 14. Rivalry

Rivalry is directional.

```text
A -> B
B -> A
```

are independent.

Traditional Rivalry:
- Slow historical base

Current Competitive Threat:
- Dynamic

Dominant Club targeting:
- Dynamic

Encirclement:
- observation of many independent Club decisions
- NOT a special Debuff

Numeric initial graph:
- `30-initial-directed-rivalry-graph.md`

---

# 15. Manager Strategy Boundary

Future Tactical Design will handle:

- ace targeting
- throwaway games
- direct-rival priority
- title-race priority
- anti-dominant-club encirclement

These must emerge from Manager AI decisions.

No League-level forced anti-giant mechanic.

---

# 16. Scouting

Scout is a Person Staff.

Scouting Department is an Institution.

Critical rule:

```text
Scout changes Knowledge
Scout does NOT change Player Truth
```

CPU Clubs must never read hidden true ability directly.

CPU recruitment must use:

```text
Club Knowledge Estimate
+ roster needs
+ manager preference
+ budget
+ contract demand
+ market competition
+ development plan
```

Scouts can:

- grow
- adapt
- gain experience
- build / lose network freshness
- be hired
- be poached
- be fired
- retire

Age alone must not equal decline.

Detailed design:
- `31-scouting-recruitment-system.md`

---

# 17. User Scouting Surface

Do not turn the game into staff-management spreadsheet.

Normal User interaction:

- hire / renew Scouting Director
- choose simple scouting emphasis
- request priority report on Player
- request priority Region
- view shortlist

Example:

```text
Scouting policy
○ Balance
○ Domestic Youth
○ International Youth
○ Immediate Help
```

Department details run in Background Simulation.

---

# 18. Recruitment Philosophy

Rich Club may fail badly.

Small Club may discover undervalued stars.

Recruitment chain:

```text
Scout / Analyst
 -> Knowledge
 -> Scouting Director
 -> GM / Sporting Director
 -> Manager fit input
 -> Negotiation
 -> Acquisition
 -> Usage / Development
 -> Outcome
```

A good Scout Report can still be ignored.

A good Player can still be a bad signing due to price / fit / usage.

---

# 19. CPU Club Principle

CPU must play by the same world rules.

No hidden infinite budget.

No hidden true-player knowledge.

No direct difficulty ability Buff.

CPU differences may come from:

- decision quality
- scouting quality
- planning horizon
- risk tolerance
- organizational quality

---

# 20. Competition Philosophy

Domestic postseason may use series.

International knockout:
- single-game elimination from knockout stage

Continental CL:
- Group Stage = 3-game series
- Knockout = single-game

Club World:
- same

Current Club World qualification:
- 4 Regional Champions
- defending Club World Champion
- host-region berth
- 10 performance berths
= 16

---

# 21. Key Documents

Recommended reading order for a new session:

1. `00-current-design-handoff.md`
2. `20-simple-surface-deep-simulation.md`
3. `16-club-economy-rivalry-design.md`
4. `18-club-state-lifecycle.md`
5. `19-club-structural-dominance-and-decline.md`
6. `21-world-club-source-policy.md`
7. `26-club-initial-seed-rating-model.md`
8. `30-initial-directed-rivalry-graph.md`
9. `31-scouting-recruitment-system.md`
10. competition docs 10–15 as needed

---

# 22. Do Not Regress

Do not:

- reintroduce ASCII as Match Core
- use direct league buffs
- make rivalry a direct ability buff
- make giant clubs collapse by random drift
- make Economic Band permanent
- give CPU true-player omniscience
- turn scouting into fixed Club-only number
- force User to manage accounting / sponsors / loans
- reduce Full League seasons below 100 games
- split Australia back out of Asia-Pacific competitions
- change international knockout back to long series without explicit redesign
- overwrite existing Save with future real-world updates

---

# 23. Next Natural Design Topics

Current natural next candidates:

1. Roster / Active / Reserve / Farm / Academy structure
2. Contract system
3. GM / Sporting Director / Manager authority split
4. Staff system beyond scouting
5. Draft / FA / Transfer / Loan integration
6. Player generation / amateur intake
7. CPU roster-building strategy
8. Manager tactical resource allocation

Use the same rule:

> Simulation may be deep. User control should remain simple.

---

# 24. USER REVIEW REQUIRED — Roster / Development Draft

新規draft:
- `docs/game-design/32-roster-development-architecture-DRAFT.md`

これは**未承認**。

将来このテーマへ触れるSessionは、実装・正史化・詳細設計の前に必ずユーザーへ:

> このRoster / Reserve / Farm / Academy仮設計を採用してよいか

を確認すること。

確認前にapproved扱いしない。

Draftの主な候補:
- First Team
- Reserve / Second Team
- Farm / Development
- Academy
- Loan / External Assignment
- Club RightsとCurrent Assignmentの分離
- DevelopmentはPlaying Time / Coaching / Environmentから因果的に発生
- CPUもHidden Potentialを直接読まない
- exact roster人数やFA / Draft細則は未決定

---

# 25. APPROVED — Rivalry Lifecycle

次にユーザーが詰めたいテーマ。

2026-09-20にユーザー承認。

ユーザー案:

```text
initial / historical rivalry
 -> permanent historical core

later-emergent rivalry
 -> event-driven increase
 -> can also decay over time
 -> eventually may disappear if no longer meaningful
```

狙い:
- 後天的Rivalryが増え続けて全Clubが宿敵になるのを防ぐ
- 伝統的Derbyは消えない
- Title race / elimination / incident等から新しい因縁を作れる
- 後天的因縁は無関係な年月が続けば薄れる

**正式設計は `docs/game-design/33-rivalry-lifecycle-model.md` を正とする。**

重要追加原則:
- 初期Real-world rivalryと後天Game-world rivalryを同じ歴史Labelで表示しない
- Emergent Rivalryは強くても「近年の宿敵 / 因縁」と表示する
- Historical / Traditional LabelはInitial Seed由来だけに許可する
- 異地域間Rivalryも実際のSave Historyが十分なら成立可能


Rivalry lifecycle design (APPROVED):
- `docs/game-design/33-rivalry-lifecycle-model.md`


Team traits / player relationship design candidate (USER REVIEW REQUIRED):
- `docs/game-design/34-team-traits-and-relationship-network-DRAFT.md`


Team Trait Catalog (USER REVIEW REQUIRED):
- `docs/game-design/35-team-trait-catalog-DRAFT.md`


---

# 26. CURRENT DESIGN — Team Traits / Relationship

2026-09-20 current work:

- `08-player-traits-design-seed.md` was expanded into the Special Ability / Trait System Master Plan.
- Player Relationship axes approved: `Affinity / Trust / Coordination`.
- Team Trait colors approved: `Blue / Red / Gold`.
- Negative relationship alone must not lower batting true ability.
- Batting resonance expresses the receiver's own archetype; teammate success never grants an incompatible ability.
- Defensive coordination may degrade from low coordination / communication because defense is joint action.
- Team Traits are temporary Pennant states and may be acquired / fade / expire.
- Team Trait Catalog draft contains 91 candidates across offense, pitching, defense, context, environment, relationship and negative team-state families.

Current files:
- `docs/game-design/34-team-traits-and-relationship-network-DRAFT.md`
- `docs/game-design/35-team-trait-catalog-DRAFT.md`

Next intended design order:
1. review / trim Team Trait Catalog
2. Team Mood
3. Manager Ability
4. Popularity / Reputation


---

# 27. APPROVED — Anti-Monocausal Principle

2026-09-20 ユーザー承認。

重要な恒久原則:

> **一つの便利なSystemだけで、複雑な長期現象を全部説明しない。**

特にTeam Traitは:

```text
proximate-state layer
= 今どう噛み合っている / 崩れているか
```

であり、

```text
universal root cause
= なぜ10年・20年弱いか
```

ではない。

長期低迷は:

- Scouting
- Development
- Roster Construction
- Manager / Front Office
- Economy / Institutional State
- Player Retention / Succession

等の上流原因を必要とする。

この原則をTeam Mood / Manager Ability / Popularity設計にも適用する。


Team Mood design (APPROVED):
- `docs/game-design/37-team-mood-architecture.md`


---

# 28. APPROVED — Team Mood

2026-09-20 approved design:

- Team Mood is a social-psychological environment, not a team ability buff.
- Mood is a vector: Confidence / Cohesion / Energy / Tension / Role Harmony.
- Mood Maker is a **catalyst, not a battery**.
- A star arrival may create Hope, but sustained mood change requires actual performance + credibility + social integration + diffusion.
- Once positive state diffuses into collective confidence / relationships / routines, the catalyst can be absent without instant collapse.
- Public Popularity is separate from Clubhouse Influence.
- Multiple Mood Makers have diminishing returns; they may also conflict.
- Team Mood feeds Player Appraisal / emotional contagion / recovery / communication willingness, never raw batting or pitching ratings.
- Team Mood and Team Traits must not create circular self-amplifying modifiers.
- Anti-Monocausal Principle applies: Team Mood alone never explains a 100-loss turnaround or star-heavy collapse.

Draft:
- `docs/game-design/37-team-mood-architecture.md`

Next review questions:
- approve the five Mood axes
- approve catalyst model for Mood Maker
- decide UI visibility
- decide offseason carryover calibration


Manager intervention layer for Team Mood (USER REVIEW REQUIRED):
- `docs/game-design/38-team-mood-manager-interventions-DRAFT.md`


---

# 29. CURRENT DRAFT — Team Mood Manager Interventions

User feedback: current Team Mood model felt too cold because the manager had no satisfying way to intervene.

Current candidate principle:

> User does not manipulate Mood directly. User acts on the causes of Mood through ordinary baseball / personnel decisions.

Candidate actions:
- clarify roles
- individual meeting
- delegate mediation to a trusted leader
- stabilize lineup / defensive pairings
- rest / temporarily remove a player
- introduce new blood via call-up / signing / trade
- encourage competition
- deliberately wait / do nothing

Every action has tradeoffs and requires time. No button gives direct `Mood +10`.

Mild issues may improve in several games; moderate issues take weeks; severe conflicts may require roster or leadership changes.

Draft:
- `docs/game-design/38-team-mood-manager-interventions-DRAFT.md`

This draft still requires user approval before becoming canonical.

---

# 30. APPROVED — Team Mood Rarity Boundary

2026-09-20 ユーザー承認。

重要原則:

> **Team Moodは勝敗の主役にしない。**

- most teams / most days = normal mood, no meaningful Match effect
- ordinary friendship / friction does not change winning ability
- only exceptional cohesion or serious dysfunction can materially affect Appraisal / contagion / communication / recovery
- raw player ability is never changed by Mood
- Team Traits remain the main baseball-facing proximate state
- Mood alone cannot grant Blue / Red Team Traits; independent baseball evidence is required
- Mood intervention should be rare enough not to become routine management work
- long-term winners / dark eras are still explained primarily by roster, scouting, development, manager, economy and Team Traits

Team Mood is a rare **social-psychological exception layer**, not a second team-rating system.


---

# 31. APPROVED — No Social Chore Principle

2026-09-20 ユーザー承認。

重要原則:

> **人間関係は“育てる義務”ではなく、“時々起こる意味のある出来事”として扱う。**

- ordinary relationships maintain themselves in background simulation
- no weekly meeting chores
- no hidden affection decay because the user did not click social actions
- no “keep everyone happy” optimization loop
- most relationship fluctuations do not require user action
- manager intervention appears only for meaningful dysfunction / opportunity

Team Mood / Relationship should add human texture without turning entertainment into social-maintenance labor.


Historical manager philosophy / command draft (SUPERSEDED / 旧計画):
- `docs/game-design/39-manager-philosophy-and-command-architecture-DRAFT.md`


---

# 32. HISTORICAL DRAFT — SUPERSEDED BY Manager Architecture v1

2026-09-20 current design work:

Core split:

```text
Manager Philosophy = what the manager prefers
Manager Skill      = how well the manager executes it
Manager Knowledge  = what the manager knows / believes
Manager Authority  = how well instructions are understood / accepted
Manager Adaptation = how the manager updates from new evidence
```

Important candidate principles:
- User and CPU managers use the same legal baseball action space.
- CPU has no hidden True Ability access.
- Human user's tactical choice is not overwritten by a fake Manager IQ roll.
- Manager philosophy is not inherently good/bad: aggressive steals, complete-game preference, data-heavy, intuition-heavy, youth-first, veteran-first etc. are context-dependent.
- Instructions have three levels: Default Philosophy / Game Plan / Immediate Command.
- Player final intent derives from manager instruction + player tendency + trust + tactical understanding + autonomy + context + emotion.
- Instructions never create player abilities the player does not possess.
- Manager traits do not directly add win probability or raw batting/pitching ability.

Initial philosophy families include:
- offense: running aggression, steal emphasis, power/contact, patience, small ball, lineup stability, platoon use, hot hand vs track record
- pitching: starter leash, bullpen role model, matchup relief, zone/chase, fastball/breaking, inside/outside, intentional walk
- defense: shift aggression, data positioning, run-prevention posture, arm/range preference
- roster: veteran/youth, promotion-demotion churn, rest policy, star privilege/equality, development/win-now
- information: data/intuition, pregame/adaptive, opponent/self-style, evidence patience, risk tolerance
- human management: autonomy/control, role stability/competition, intervention/hands-off, public accountability

Draft:
- `docs/game-design/39-manager-philosophy-and-command-architecture-DRAFT.md`


Historical manager ratings / era / strategy draft (SUPERSEDED / 旧計画):
- `docs/game-design/40-manager-ratings-era-and-strategy-evolution-DRAFT.md`


---

# 33. HISTORICAL DRAFT — SUPERSEDED BY Manager Architecture v1

2026-09-20 design direction:

Public CPU Manager ratings are proposed as six simple S–G grades:

```text
采配 / 分析 / 適応 / 選手眼 / 運用 / 統率
```

Internal values remain 0–100 and project to the same S–G boundaries as Player Ratings.

Important candidate principles:
- no overall Manager rating
- Philosophy and Skill are separate
- Era is Context, not Ability
- old-era managers are not inherently weaker
- each Era changes information availability, rules, staff tools, league priors and Meta
- managers may be ahead of their time through Analysis + Adaptation + experimentation + correct hypothesis + roster fit
- tactics are built from atomic decision primitives rather than only named historical classes
- CPU can form Strategy Hypotheses, test them, update beliefs, and gradually create new tactical patterns
- successful innovations can diffuse through assistants, coaching trees and opponent observation
- opponents can imitate and counter, causing Strategy Edge to shrink over time
- a user who copies a causally strong CPU Manager strategy should be able to improve when roster/context fit, but copying does not guarantee success
- future baseball should emerge from the strategy search space rather than a hard-coded 2100 meta

Draft:
- `docs/game-design/40-manager-ratings-era-and-strategy-evolution-DRAFT.md`


---

# 34. APPROVED DIRECTION — Manager Core / Incompetent Managers

2026-09-20 user accepted the proposed Manager core direction.

Approved direction:
- public Manager ratings use six S–G axes: 采配 / 分析 / 適応 / 選手眼 / 運用 / 統率
- no single Overall Manager rating
- Philosophy and Skill are separate
- User / CPU share the same legal baseball action space
- Manager instructions use Default Philosophy / Game Plan / Immediate Command
- Player final intent combines Manager instruction with Player tendency / trust / tactical understanding / autonomy / emotion / context
- Human User tactical choices are not randomly overwritten by a low Manager IQ stat
- Manager instructions never create abilities the Player does not possess

Important new requirement:
> **Manager employment does not guarantee competence.**

Weak managers can genuinely exist, including multiple D/E/F/G axes.

An incompetent manager can still be hired because Club hiring is an imperfect information process involving:
- reputation
- famous playing career
- internal promotion
- owner/front-office preference
- cost
- availability
- ideology fit
- emergency interim appointment
- mistaken evaluation

Club AI must not read Manager True Skill directly.

Draft:
- `docs/game-design/41-manager-appointment-and-incompetence-DRAFT.md`


Manager market / Front Office selection (USER REVIEW REQUIRED):
- `docs/game-design/42-manager-market-and-front-office-selection-DRAFT.md`


---

# 35. CURRENT DRAFT — Manager Market / Front Office Selection

2026-09-20 current direction:

Manager ability and Manager appointment are separate systems.

```text
Manager True Skill
 !=
Manager Hiring Value
```

A Club does not know Manager True Skill directly. It evaluates candidates from career evidence, reputation, Club/OB relationship, interviews, tactical fit, salary, availability, ownership preference and Front Office estimates.

Candidate paths include:
- Club OB / former player
- external proven manager
- assistant / specialist coach
- farm / minor-team manager
- low-profile former player with a strong coaching career

Important concept:
> **監督は、なってみるまで分からない部分が大きい。**

Therefore genuinely weak first-time managers can be hired without randomness or cheating.

Club hiring styles can differ: OB tradition, proven-winner preference, development-first, innovator-seeking, stability-first, owner-driven etc.

Front Office itself has imperfect candidate-evaluation skill. CPU Clubs must not read hidden Manager True Skill.

Draft:
- `docs/game-design/42-manager-market-and-front-office-selection-DRAFT.md`


Historical emergent-strategy draft (SUPERSEDED / 旧計画):
- `docs/game-design/43-manager-strategy-evolution-architecture-DRAFT.md`


---

# 36. HISTORICAL DRAFT — SUPERSEDED BY Manager Architecture v1

2026-09-20 current design:

The remaining Manager evolution topics are organized as one seven-layer causal architecture:

```text
Baseball Environment
 -> Tactical Primitives
 -> Manager Belief Model
 -> Strategy Hypotheses
 -> Experiment / Learning
 -> Strategy Diffusion / Lineage
 -> League Meta / Counter-Strategy
 -> future hypotheses
```

Key candidate principles:
- future tactics are not hard-coded named unlocks
- a Strategy is a set of Context -> Action / Threshold policy rules
- named tactics such as opener are descriptors over actual policies
- CPU managers hold uncertain beliefs, not World Truth
- invention is bounded local mutation / recombination of existing policies, not random genius
- Experiment Budget prevents constant gimmick play
- evidence updates intermediate baseball outcomes, not only win/loss
- Analysis reads evidence; Adaptation changes beliefs/policies; Tactical Judgment chooses actions now
- Strategy lifecycle: IDEA -> HYPOTHESIS -> LIMITED_TRIAL -> PROVISIONAL -> ESTABLISHED -> DEFAULT -> OBSOLETE/DORMANT
- user-created repeated policies can be observed and imitated by CPU
- CPU-created policies can be copied by user
- Coaching Tree transfers ideas / priors, never Manager Skill
- League Meta is a derived distribution of actual strategies, not a global buff
- widespread strategies provoke counter-strategies
- future baseball emerges from rules, player population, information technology, economics and accumulated tactical knowledge
- innovations may fail; League Meta can temporarily follow bad ideas
- strategy history / lineage can be recorded as optional Save history
- computational search is sparse and local, not exhaustive

Draft:
- `docs/game-design/43-manager-strategy-evolution-architecture-DRAFT.md`

Recommended approval order:
1. Tactical Primitives + Context Patterns
2. Manager Beliefs + Strategy Hypothesis lifecycle
3. bounded Experiment / Learning
4. Diffusion + Coaching Tree
5. League Meta + Counter-Strategy
6. historical reconstruction + future-emergence soak


Manager real-world tactical stress tests (VALIDATION CATALOG / not an open plan):
- `docs/game-design/44-manager-real-world-tactical-stress-tests-DRAFT.md`


---

# 37. VALIDATION CATALOG — NOT A CURRENT PLAN

2026-09-20:

Historical stress tests were added for Manager Architecture.

Key cases:
- 栗山英樹: 1番・投手 大谷翔平
- 落合博満: 山井8回完全 -> 岩瀬9回
- 星野仙一: 前日160球の田中将大をGame 7の9回へ
- 渡辺久信: 岸孝之を中2日Long Relief
- 長嶋茂雄: 10.8三本柱継投
- 梨田昌孝: 代打・北川博敏
- 原辰徳: 内野5人シフト
- 工藤公康: 第2先発 / 日替わりLineup / 強打者Bunt
- Bobby Valentine: extreme lineup variation / YFK
- 岡田彰布: JFK
- 近藤貞雄: スーパーカートリオ / Green Light
- 緒方孝市: タナキクマル / Role Clarity / buster / squeeze / double steal
- 野村克也: 遠山・葛西の投手↔一塁switch / 松井-specific role development
- 王貞治: no-hit pitcherへ代打してplanned bullpen
- 西本幸雄: 江夏の21球でのsqueeze decision

Major architecture requirements revealed:
- Series Horizon
- secondary objectives such as records / symbolism
- Player willingness as advisory input
- arbitrary defensive coordinates
- between-pitch alignment changes
- opponent counter-action
- era-specific substitution legality
- pitcher-field-position switches when legal
- Green Light autonomy directives
- role reassignment
- sign inference / deception

Draft:
- `docs/game-design/44-manager-real-world-tactical-stress-tests-DRAFT.md`


Historical manager decision-engine / temperament draft (SUPERSEDED / 旧計画):
- `docs/game-design/45-manager-decision-engine-and-temperament-DRAFT.md`


---

# 38. HISTORICAL DRAFT — SUPERSEDED BY Manager Architecture v1

2026-09-20:

Manager personality is now explicitly separated from ability and baseball philosophy.

```text
Skill       = how well the manager reasons / executes
Philosophy  = what kind of baseball the manager prefers
Temperament = how the manager decides under uncertainty / pressure
```

Candidate Temperament axes:
- decisiveness
- conviction
- composure
- openness
- consultative style

These do not provide direct buffs.

Decision Engine candidate flow:

```text
Decision Trigger
 -> Observed Situation
 -> Manager Belief Slice
 -> Legal Action Set
 -> Candidate Generation
 -> Manager Forecast
 -> Objective / Horizon Evaluation
 -> Risk + Philosophy + Temperament
 -> Bounded Decision
 -> Instruction Encoding
 -> Player Interpretation
 -> Canonical Match Simulation
 -> Decision Memory / Learning
```

Important additions:
- Fast Policy Path for routine decisions
- Deliberative Search for high-leverage / unusual situations
- Decision Horizon Stack: pitch / at-bat / game / series / season / development
- Objective Vector: win-now / future resources / health / development / role stability / milestone / symbolic value
- low Manager Skill creates plausible reasoning defects, never random idiocy rolls
- Manager Forecast uses Beliefs, never Match Core hidden truth
- opponent responses are modeled sequentially
- hidden signs remain hidden; opponent may infer from observable cues
- outcome quality and decision quality are separated
- CPU decision reasons can be surfaced in simple user-facing explanations

Draft:
- `docs/game-design/45-manager-decision-engine-and-temperament-DRAFT.md`


Historical rare-tactics / psychological-play / Decision Log draft (SUPERSEDED / 旧計画):
- `docs/game-design/46-manager-rare-tactics-psychological-play-and-decision-log-DRAFT.md`


---

# 39. HISTORICAL DRAFT — SUPERSEDED BY Manager Architecture v1

2026-09-20:

Historical motif verified in public reporting:
Ichiro later asked Sadaharu Oh about being intentionally walked from the first inning during his BlueWave period; Oh explained that if the unusual treatment disturbed Ichiro's normal composure, that itself would benefit the Hawks.

Design consequence:
- Manager tactics may have uncertain psychological / information objectives in addition to direct baseball objectives.
- No action directly applies an opponent mental debuff.
- Visible unusual actions become stimuli; the opponent Player's own Appraisal / Emotion system determines reaction.
- Psychological targeting may work, do nothing, or backfire.
- Deliberative Search gets at most one bounded Rare Candidate; no random "crazy move" roll.
- Surprise decays as opponents observe repeated use.

New Manager Decision Log:
- stores trigger, observed context, manager beliefs, candidates, expected benefits/costs, objectives, horizon, philosophy/temperament influence, chosen action, opponent response, outcome, and learning update.
- User-facing log exposes reasons, not hidden World Truth.
- Opponent full thought logs are postgame by default; live full traces are reserved for optional Spectator / Research Mode.
- Important decisions are surfaced via a derived Importance score rather than dumping every routine decision.

Draft:
- `docs/game-design/46-manager-rare-tactics-psychological-play-and-decision-log-DRAFT.md`


Historical candidate-evaluation / gimmick-control draft (SUPERSEDED / 旧計画):
- `docs/game-design/47-manager-candidate-evaluation-and-gimmick-control-DRAFT.md`


---

# 40. HISTORICAL DRAFT — SUPERSEDED BY Manager Architecture v1

2026-09-20:

Candidate actions are evaluated from Manager Belief, never World Truth.

Subjective valuation includes:
- immediate baseball value
- future resource value
- health cost
- roster opportunity cost
- role/social cost
- opponent response risk
- uncertainty
- complexity
- information gain
- surprise
- psychological value
- symbolic value

Important distinction:
```text
Candidate Admission = does the manager think of the option?
Candidate Selection = does the manager actually choose it?
```

New personality tendency:
- Novelty Seeking = tendency to admit unfamiliar / unusual candidates
- it is not a Skill

A derived "gimmick addiction" pattern can emerge from:
```text
high Novelty Seeking
+ high Decisiveness
+ high Experimentation
+ low Analysis
+ poor uncertainty calibration
+ Result Bias
```

Such a manager can make several unusual decisions in one game, but there is no random comedy roll and no fixed hidden penalty.

Repeated weird tactics naturally lose Surprise and can accumulate execution complexity / opponent-learning costs.

Draft:
- `docs/game-design/47-manager-candidate-evaluation-and-gimmick-control-DRAFT.md`


---

# 41. CANONICAL — Manager Architecture v1

2026-09-20 adversarial audit completed.

Audit:
- `docs/game-design/48-manager-architecture-adversarial-audit.md`

Canonical design:
- `docs/game-design/49-manager-architecture-v1.md`

Status:
> **Manager Architecture v1 is DESIGN FROZEN.**

The adversarial audit found that the core causal direction was sound, but normalized several overlapping concepts before freeze.

Final Manager source of truth:

```text
STATIC / SLOW
  Skill
  Philosophy
  Temperament

DYNAMIC
  Belief State
  Strategy Memory

EXTERNAL
  Rules / Environment
  Staff Advice
  Manager-Player Relationships
  Match / Series / Season Context
```

Public six skills remain:
```text
采配 / 分析 / 適応 / 選手眼 / 運用 / 統率
```

Important corrections from the audit:
- Adaptation is a Skill, not a duplicate top-level system.
- Knowledge is the dynamic Belief State.
- Authority / Trust is relationship-derived, not a personal Manager stat.
- Temperament is frozen to five value-neutral axes:
  Risk Appetite / Decision Pace / Policy Persistence / Novelty Appetite / Consultation Style.
- Openness / Experimentation / Novelty Seeking are merged into Novelty Appetite.
- Giant 12-term scalar utility is rejected. Candidate comparison uses six forecast channels + dominance pruning + context/horizon evaluation.
- `Rare Candidate` is no longer a special action class. Unusualness is candidate metadata.
- in-world `Experiment Budget` is removed. Exploration uses a causal Exploration Gate.
- Surprise is not a standalone reward; it affects opponent uncertainty / preparation.
- psychological tactics must route through the existing Player Appraisal / ActiveEmotion architecture.
- Manager Decision Log is immutable structured trace from decision time, never post-hoc narrative invention.
- full routine traces are not permanently stored; only meaningful / key decisions persist.
- public S–G Manager ratings are observed estimates of hidden True Skill, so first-time managers can remain uncertain.
- automatic strategy invention is constrained by a Tactical Grammar and RuleEngine legality.
- League Meta is a derived description, not a global tactical buff.
- Coaching Tree transfers ideas / priors, never Manager Skill.
- User / CPU same Legal Action Space and no direct Manager buffs are frozen principles.

Historical Stress Test remains a validation catalog:
- `docs/game-design/44-manager-real-world-tactical-stress-tests-DRAFT.md`

Pre-freeze draft files 39 / 40 / 43 / 45 / 46 / 47 are archived design work. Their useful detail may remain as rationale, but 49 is authoritative where conflicts exist.

Required future validation before implementation sign-off:
- 10 / 50 / 100+ season multi-seed soak tests
- tactical diversity / convergence
- rare tactic frequency
- manager identity stability
- meta turnover
- manager-vs-roster contribution
- compute / save growth

Front Office / Manager hiring docs 41 / 42 remain separate DRAFT work and are **not** included in the Manager Architecture v1 freeze.


---

# 42. CANONICAL REFINEMENT — League-local Doctrine Diffusion

2026-09-20 user requested that manager doctrine / tactical ideas should diffuse much more easily inside a league than across leagues.

This is now part of Manager Architecture v1.

Canonical rule:

```text
same club / staff tree
 -> strongest transfer

same league / frequent opponents
 -> strong

same competition region
 -> medium

cross-league / cross-region
 -> weak by default
```

Cross-league spread requires actual bridges such as:
- manager / coach movement
- player movement
- analyst / staff movement
- international competition
- public video / statistical evidence
- deliberate study
- independent rediscovery

Imported doctrine is always re-evaluated under local:
- rules
- player population
- ball / park environment
- roster construction
- opponent meta
- available information

League tactical culture is Derived from actual policies, never a hard-coded buff or permanent identity.

This allows one league to remain bunt / small-ball heavy while another becomes air-ball / power oriented, without preventing later convergence or independent tactical discovery.

Canonical file:
- `docs/game-design/49-manager-architecture-v1.md`

Canonical refinement commit:
- `4379927cdae5b337b3f74b50f878608e9894acf7`


---

# 43. CANONICAL v1 — Popularity / Reputation

2026-09-20 design started.

Canonical v1 (legacy filename retains `-DRAFT`):
- `docs/game-design/50-popularity-reputation-architecture-DRAFT.md`

Core separation:

```text
Exposure / Awareness
= how widely a person is known

Public Favorability
= how positively a specific audience sees the person

Reputation
= what observers believe the person is like

Clubhouse Influence
= internal social influence; separate Team Mood / Relationship source
```

Important candidate principles:
- Popularity is derived from Awareness + positive Favorability; not a raw baseball ability.
- Popularity is audience-specific rather than one global scalar.
- very famous + disliked and locally beloved + globally unknown are both possible.
- Reputation is observer belief, not Truth; it can be accurate, exaggerated, outdated, or wrong.
- `人気者` becomes a Career / Presentation descriptor derived from AudienceStanding.
- `威圧感 / 存在感` route through Reputation -> Opponent Appraisal / tactical response, never direct opponent ability debuff.
- Public Popularity remains separate from Clubhouse Influence.
- crowd reaction can become a Player Psychology stimulus, but Popularity never directly modifies batting/pitching ability.
- local / league / national / international awareness scopes are supported.
- transfers preserve audience history rather than resetting popularity.
- popularity / media maintenance chores are prohibited.

First open decision:
whether a slow `Public Appeal` person factor is needed to help explain why equally successful players can differ in fan popularity.


---

# 44. APPROVED DIRECTION — Fan Favorite / Star / Superstar Split

2026-09-20 user corrected the Popularity boundary.

Canonical direction for the ongoing Popularity design:

```text
人気者
= fan affection / lovable public figure

Star
= competitive prominence + broad recognition

Superstar
= exceptional, sustained, wide-scope Star status
```

These are not one progression ladder.

Important:
- a beloved role player can be `人気者` without being a Star
- an elite Star may not be a `人気者`
- a Superstar may be polarizing
- Popularity / Star labels never feed Manager tactical decisions
- opponent caution / intentional walks / matchup planning remain driven by scouting, data, opponent history and Manager Belief
- Popularity effects are secondary: attendance interest, cheers, fan presentation, merchandise / event salience
- no direct Match buff
- no automatic Team Mood increase
- Clubhouse Influence remains separate
- Reputation / 威圧感 is removed from Popularity ownership and deferred back to Scouting / Manager Belief / Psychology

Canonical v1 file (legacy filename retains `-DRAFT`):
- `docs/game-design/50-popularity-reputation-architecture-DRAFT.md`

Refinement commit:
- `9f436e9a93ec70487162afddcee70164c4156c28`


---

# 45. APPROVED DIRECTION — Star / Superstar Big-stage Mechanics

2026-09-20 user clarified that Fan Favorite and Star/Superstar have different responsibilities.

```text
人気者 / Fan Favorite
= affection / crowd / secondary Career presentation

Star
= competitive prominence / tactical gravity

Superstar
= exceptional Star
 + broad recognition
 + iconic salience
 + strong high-stage evidence
```

Important:
- Fan Favorite does not affect Manager tactical decisions.
- Star / Superstar may influence opponent preparation and tactical attention through Manager Belief.
- Manager remains the owner of actual decisions such as intentional walk, matchup relief, defensive positioning, etc.
- Star / Superstar labels never directly modify raw ability.
- Big-stage performance uses a separate underlying `Spotlight Response` profile.
- high Match Salience (title-deciding games, elimination games, WBC/international, major rivalry, legacy moments) can shift Condition / Appraisal.
- strong Spotlight Response makes good Condition / positive activation more likely under pressure, but does not guarantee success.
- Superstar status is derived from elite competitive prominence + broad recognition + iconic/high-stage evidence. The label does not feed back as a magic buff.
- statistical greatness and iconic greatness must remain distinguishable.
- Shigeo Nagashima and Shohei Ohtani are validation motifs, not hard-coded persons.

Canonical v1 file (legacy filename retains `-DRAFT`):
- `docs/game-design/51-star-superstar-big-stage-architecture-DRAFT.md`

Commits:
- `eda18e2e4f900f150e04aee25e541e40612291cf`
- `a6246897d1eea914f1441356831212201a377454`


---

# 46. REFINEMENT — Superstar Archetypes

2026-09-20 user clarified that Superstar must not be framed as "iconicity instead of ability."

Superstar can include overwhelming competitive greatness.

Three useful derived archetypes:

```text
Dominant Superstar
= historic-level competitive ability / production
+ broad recognition

Iconic Superstar
= elite competitive level
+ exceptional cultural / memorable salience

Complete Superstar
= historic competitive dominance
+ broad / global recognition
+ iconic salience
+ repeated major-stage success
```

Important:
- Superstar is never a substitute for weak ability.
- A minimum Star-level competitive floor is required.
- publicity alone does not create Superstar.
- different Superstars can have different shapes across competitive dominance / iconic salience / spotlight evidence / public reach.
- Superstar label remains derived and never grants raw ability.

Updated draft:
- `docs/game-design/51-star-superstar-big-stage-architecture-DRAFT.md`

Refinement commit:
- `d0080e55c7613abfb50cb75bd6e569d2d3ebe422`


---

# 47. REFINEMENT — Star / Superstar Rarity

2026-09-20 user clarified that even Star status should be difficult to earn, and Superstar should be extremely rare.

Design rule:

```text
Star
= rare competitive-center status

Superstar
= historically exceptional status
```

No hard quotas:

```text
one Star per club
one Superstar per league
top-N auto assignment
```

are prohibited.

Instead strict evidence gates create rarity.

Star Gate requires:
- high league-relative competitive prominence
- sustained high-level performance
- central competitive role
- meaningful opponent attention
- broad league awareness
- persistence

Superstar Gate requires Star-level foundation plus exceptional evidence such as:
- historic competitive dominance OR exceptional iconic salience
- sustained elite relevance
- broad / cross-audience recognition
- major-stage evidence
- historical persistence

Important:
- several years as a Star does not automatically create Superstar
- some eras may have no active Superstar
- rare eras may contain multiple overlapping Superstars
- most strong regular players remain non-Star
- Superstar rarity is calibrated through multi-season soak, not hard caps
- Star is mainly league-relative; Superstar requires broader historical / cross-league significance
- current Star/Superstar status can fade while Legacy status persists

Updated draft:
- `docs/game-design/51-star-superstar-big-stage-architecture-DRAFT.md`

Refinement commit:
- `5e9ad9b8d25709a42eac307b9050fba0d7bc07bd`


---

# 48. CANONICAL — Popularity / Star / Superstar v1

2026-09-20 user approved and froze the design.

Canonical files:
- `docs/game-design/50-popularity-reputation-architecture-DRAFT.md`
- `docs/game-design/51-star-superstar-big-stage-architecture-DRAFT.md`

Final distinction:

```text
人気者 / Fan Favorite
= affection / crowd / presentation

Star
= rare competitive-center status
+ tactical gravity

Superstar
= historically exceptional Star
+ broad recognition
+ iconic salience
+ strong high-stage evidence
```

Important:
- Fan Favorite does not affect tactical decisions.
- Star / Superstar can matter tactically, but actual decisions remain owned by Manager Belief / scouting / data / context.
- no label gives a raw ability buff.
- high-pressure performance uses Match Salience + Spotlight Response -> Condition / Appraisal.
- Star itself is rare; Superstar is extremely rare.
- no fixed quota; some eras may have zero Superstar.
- exceptional eras may contain multiple Superstars.
- Superstar is not compensation for weak ability.
- Current status and Legacy status may diverge.
- Clubhouse Influence remains separate from Popularity.

Remaining work is implementation and calibration, not architecture.


---

# 49. CANONICAL — Star / Superstar Genesis v1

2026-09-20 user approved the generation-first rare candidate model.

Canonical:
- `docs/game-design/52-star-superstar-genesis-v1.md`

Core rule:

```text
Star / Superstar Candidate
= rare hidden generation predisposition

Star / Superstar Status
= later Career evidence / recognition
```

Candidate is not destiny.

A rare genesis profile may bias:
- Spotlight Potential
- Pressure Stability Potential
- Pressure Conversion Potential
- Iconic Potential
- Public Magnetism Potential

Hard boundary:
- Match Core never reads STAR_CANDIDATE / SUPERSTAR_CANDIDATE.
- Match only reads realized Spotlight Response, Condition, Appraisal, ActiveEmotion, actual ability and Match Salience.

Superstar emergence:

```text
latent predisposition
× baseball ability
× development
× opportunity
× major-stage access
× actual outcomes
× public reach
× era context
× luck
 -> observed Career
```

Consequences:
- a Superstar candidate may never become a Star
- a non-candidate may rarely become a Star
- ordinary baseline -> fully acquired Superstar is extremely rare
- some eras may have no realized Superstar
- user normally discovers exceptional players through repeated Career evidence, not a visible destiny badge

This permits a Nagashima-type player:
elite but not necessarily the statistical #1, exceptional under spotlight, repeatedly successful on major stages, culturally iconic.

It also permits dominant Complete Superstars with historic true ability + production + broad recognition + major-stage success.

Canonical commit:
- `3097c562cda3bc67caf0a4bdebc956a86f900d4f`