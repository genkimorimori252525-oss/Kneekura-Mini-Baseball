# Kneekura Mini Baseball — Current Design Handoff

更新日: 2026-09-20  
対象branch: `jolly/core-foundation-plan-2026-09-17`

この文書は、新しいChatGPT / Jolly sessionが設計思想を最短で復元するためのhandoff。

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


Manager philosophy / command architecture (USER REVIEW REQUIRED):
- `docs/game-design/39-manager-philosophy-and-command-architecture-DRAFT.md`


---

# 32. CURRENT DRAFT — Manager Philosophy / Commands

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


Manager ratings / era / strategy evolution (USER REVIEW REQUIRED):
- `docs/game-design/40-manager-ratings-era-and-strategy-evolution-DRAFT.md`


---

# 33. CURRENT DRAFT — Manager Ratings / Era / Strategy Evolution

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
