# Manager Architecture v1 — CANONICAL

更新日: 2026-09-22  
状態: **CANONICAL / DESIGN FROZEN v1。実装前。**

監査:
- `docs/game-design/48-manager-architecture-adversarial-audit.md`

この文書は監督設計のSource of Truth。
39 / 40 / 43 / 45 / 46 / 47のDRAFTで矛盾する箇所は本書を優先する。

---

# 1. Product Goal

Kneekura Mini Baseballの監督は:

> **能力値で勝敗Buffを撒く存在ではなく、不完全な情報から野球を考え、決断し、選手へ伝え、結果から学ぶPerson Agent**

とする。

目標:

- 強い監督の野球を観察して学べる
- 無能な監督にも「なぜそう判断したか」がある
- 同じ能力でも思想 / 性格で野球が変わる
- 昭和 / 平成 / 令和 / 未来の野球観を同じEngineで表現
- 名采配 / 迷采配 / 珍采配を同じ因果Systemから出す
- User / CPUが同じLegal Baseball Action Spaceを使う

---

# 2. Frozen Principles

以下をv1恒久原則とする。

1. **User / CPU Same Legal Action Space**
2. **CPU never reads World Truth**
3. **Manager ratings never directly modify raw player ability or win probability**
4. **Philosophy != Skill**
5. **Decision quality != Result**
6. **Era is Context, not Ability**
7. **Named tactics are descriptors, not buffs**
8. **Historical tactics must emerge from generic mechanisms**
9. **Future tactics are not hard-coded unlocks**
10. **Human User tactical input is not overwritten by low Manager IQ**
11. **Player instruction cannot create unavailable ability**
12. **Manager is important but never a monocausal dynasty / dark-era explanation**
13. **Simple Surface, Deep Simulation**

---

# 3. Canonical Manager State

Manager本体のSource of Truthを5要素へ限定する。

```ts
type ManagerAgentState = {
  skills: ManagerSkillProfile;
  philosophy: ManagerPhilosophy;
  temperament: ManagerTemperament;

  beliefs: ManagerBeliefState;
  strategyMemory: ManagerStrategyMemory;
};
```

分類:

```text
STATIC / SLOW
  Skill
  Philosophy
  Temperament

DYNAMIC
  Belief State
  Strategy Memory
```

以下はManager本体へ重複保持しない:

- Knowledge -> Belief State
- Adaptation -> Skill
- Authority -> Manager-Player relational state
- Trust -> relationship state
- Staff quality -> external Staff context
- Era -> Environment context

---

# 4. Public Manager Skills — Six Axes

内部True Skillは0–100。

```text
采配   Tactical Judgment
分析   Analysis
適応   Adaptation
選手眼 Player Evaluation
運用   Operations
統率   Leadership / Communication
```

## 采配

現在の局面で:

- relevant candidateを思いつく
- candidateを比較する
- timingを逃さない
- meaningful alternativeを見落としにくい

能力。

## 分析

- statistics
- opponent patterns
- uncertainty
- tactical evidence
- causal signal

をどれだけ適切に解釈するか。

## 適応

新Evidenceから:

- Belief
- Game Plan
- Strategy Policy

をどれだけ適切に更新できるか。

## 選手眼

- readiness
- fatigue
- role fit
- current form
- position suitability

を観測から推定する能力。

True Ability読取ではない。

## 運用

- bullpen resources
- starter workload
- rest
- roster availability
- multi-game horizon

を持続可能に扱う能力。

## 統率

- instruction clarity
- role explanation
- player acceptance
- conflict handling
- communication

の質。

---

# 5. Public S–G Display & Overall Summary

Player Ratingと同じ境界を使用。

```text
S 90–100
A 80–89
B 70–79
C 60–69
D 50–59
E 40–49
F 20–39
G 0–19
```

ただしUser UIはTrue Skillを直接表示しない。

```text
True Skill
 -> observed evidence / reputation
 -> public S–G estimate
```

Established manager:
- confidence高
- grade安定

First-time / low-evidence manager:
- `?`
- `B?`
- approximate band

等を許可。

「監督はなってみるまで分からない」を守る。

2026-09-22 refinement: **Public Overall Manager Rating S〜Gを許可する。**

```text
6 public skill estimates
+ role-relevant observed evidence
 -> Public Overall S〜G
```

OverallはSimple Surface用のDerived Summary。`ManagerAgentState`へ新しいOverall True Skillを追加しない。

禁止:

```text
Overall A
 -> decision quality +10%
 -> win probability +X
```

詳細を見たくないUserはOverallで一目比較し、詳細Userは6能力 / Philosophy / Temperament / evidence confidenceを見る。First-time / low-evidence ManagerのOverallにも `?` / `B?` 等を許可する。

---

# 6. Manager Philosophy — Baseball Preference Only

Philosophyは:

> **何を良い野球だと考え、どの選択をDefaultとして好むか**

を表す。

Skillではない。

v1 core families:

## Offense

- running aggression
- steal emphasis
- power vs contact
- plate patience
- small-ball preference
- lineup stability
- platoon usage

## Pitching Usage

- starter leash
- fixed bullpen roles vs leverage usage
- matchup-relief emphasis
- intentional-walk / avoidance preference

## Defense

- shift aggression
- positioning aggressiveness
- run-prevention posture

## Roster / Role

- veteran vs youth
- rest rotation
- role stability vs competition
- development vs win-now

## Evidence Style

- data-heavy vs observation / intuition-heavy
- opponent-specific vs self-style

Pitch-family / inside-outside等のpitch-level細部は、
v1 Manager PhilosophyのSource of Truthにしない。
Pitching Coach / Battery / Game Planへ委譲可能。

Media behavior / public accountabilityもfuture system。

---

# 7. Manager Temperament — Five Neutral Axes

```ts
type ManagerTemperament = {
  riskAppetite: number;
  decisionPace: number;
  policyPersistence: number;
  noveltyAppetite: number;
  consultationStyle: number;
};
```

全軸は価値中立。

## Risk Appetite

```text
conservative <-> risk-seeking
```

## Decision Pace

```text
deliberative <-> quick-commit
```

早い:
- opportunityを逃しにくい
- premature commitment risk

遅い:
- evidenceを待てる
- actionが遅れるrisk

## Policy Persistence

```text
easy-to-switch <-> stick-with-plan
```

低:
- new evidenceへすぐ変更
- noiseへ過反応risk

高:
- overreactionを防ぐ
- outdated plan persistence risk

Adaptation Skillとは別。

## Novelty Appetite

```text
conventional <-> exploratory
```

旧:

- Openness
- Experimentation Tendency
- Novelty Seeking

をここへ統合。

## Consultation Style

```text
self-directed <-> consultative
```

Staff inputをどれだけ候補生成 / Belief更新へ入れるか。

相談型だから優秀とは限らない。

---

# 8. Manager Belief State

CPU監督はTruthではなくBeliefから判断。

```text
game observation
statistics
scouting
staff reports
player communication
career experience
        ↓
Manager Belief State
```

Beliefは:

- estimate
- uncertainty
- evidence strength
- recency
- context scope

を持つ。

例:

```ts
type Estimate<T> = {
  mean: T;
  uncertainty: number;
  evidence: number;
};
```

CPUがHidden True Ability / hidden future resultを読むことは禁止。

---

# 9. Strategy Memory

```ts
type ManagerStrategyMemory = {
  activePolicies: readonly StrategyPolicy[];
  hypotheses: readonly StrategyHypothesis[];
  decisionEvidence: readonly TacticalEvidenceSummary[];
};
```

boundedで保持。

低confidence / duplicate hypothesisは:

- merge
- archive
- discard

する。

無限に戦術Memoryを増やさない。

---

# 10. Tactical Primitive

Strategyは名前付きClassではなくPrimitiveから作る。

## Offense

- lineup assignment
- swing / patience directive
- bunt
- steal
- hit-and-run
- extra-base aggression

## Pitching Usage

- starter continuation / removal
- reliever selection
- matchup weighting
- role override

## Defense

- arbitrary legal defensive coordinates
- infield depth
- outfield depth
- special alignment
- five-infielder alignment

## Roster / Usage

- substitution
- rest
- role assignment
- promotion / demotion where rules permit

---

# 11. Tactical Grammar

新Strategy生成は自由Random mutationではなくGrammarを使う。

```ts
type TacticalRule = {
  context: ContextPattern;
  action: TacticalAction;
  parameters: TacticalParameters;
  preconditions: readonly TacticalPrecondition[];
};
```

新Hypothesisは:

- threshold shift
- context narrowing
- context expansion
- compatible rule composition
- legal action substitution
- sequencing change

から生成。

必ず:

- RuleEngine legality
- roster feasibility
- player feasibility

を通る。

---

# 12. Named Strategy Is Derived

```text
Actual Policy Behavior
        ↓
Behavior Signature
        ↓
Human-readable Descriptor
```

例:

- Opener
- JFK / YFK的勝利の方程式
- Small Ball
- Five-infielder heavy
- Leverage Bullpen

Labelは結果の要約。

Label自体にBuffなし。

---

# 13. Three Instruction Layers

```text
A. Default Philosophy
B. Game Plan
C. Immediate Command
```

## Default Philosophy

season-level / long-term default。

## Game Plan

opponent / roster / game-specific override。

## Immediate Command

situation-specific action。

UserはいつでもDefaultを上書き可能。

---

# 14. Hard Sign vs Soft Directive

## Hard Sign

- squeeze
- steal sign
- intentional walk
- pitcher change
- defensive alignment

等。

原則従う。

実行失敗はPlayer / communication / timing / physics側。

## Soft Directive

- aggressive running
- patient approach
- power emphasis
- green light
- attack / avoid tendency

Player own tendency / perception / tactical understandingと合成。

---

# 14.1 Player Green Preference Boundary — CANONICAL REFINEMENT

`09-player-trait-catalog.md` のGreen TraitはPlayer本人の**Default Policy / Slow Preference**。

ManagerのInstructionとは別Source。

```text
no instruction
 -> Player Green Preference is the main default prior

Soft Directive
 -> Manager preference + Player preference are blended

Hard Sign / Immediate Command
 -> command is normally intended to take precedence
 -> comprehension / communication / trust / compliance / autonomy may still affect actual response
```

Hard Signを受けたからPlayerのGreen Traitを消去しない。
反対にGreen Traitを理由にHard Signを自動無視させない。

Userの明示Commandも同じHuman Control boundaryに従う。

---
# 15. Player Response

```text
Manager Instruction
+ Player tendency
+ Player perception
+ tactical understanding
+ Manager trust
+ autonomy
+ current emotion
+ context
        ↓
Final Intent
        ↓
Physical execution
```

Manager commandから結果を直接作らない。

---

# 16. Decision Engine — Canonical Flow

```text
1. Decision Trigger
2. Observed Context
3. Manager Belief Slice
4. Legal Action Set
5. Candidate Admission
6. Feasibility Filter
7. Forecast Distributions
8. Hard Constraint Check
9. Dominance Pruning
10. Context / Horizon Comparison
11. Temperament-sensitive Near-tie Resolution
12. Chosen Action
13. Instruction Encoding
14. Player Response
15. Canonical Match Simulation
16. Decision Trace
17. Evidence / Belief / Strategy Update
```

---

# 17. Fast Path / Deliberative Path

## Fast Policy Path

routine situation:

```text
known context
 -> established policy
 -> legality / feasibility
 -> execute
```

## Deliberative Search

起動例:

- high leverage
- unexpected opponent action
- policy conflict
- high uncertainty
- championship / elimination
- milestone
- novel strategy candidate

Candidate searchはbounded。

---

# 18. Candidate Admission

Candidate sources:

- established policy
- Game Plan
- obvious legal alternative
- staff suggestion
- Strategy Hypothesis
- emergency response
- Tactical Grammar variation

「Rare Candidate」という別Classは作らない。

全候補へ:

```text
noveltyDistance
practiceFamiliarity
opponentExposure
```

等のmetadataを付ける。

Novelty AppetiteがAdmission thresholdに作用。

したがって奇策好きは一試合に複数回奇策可能。

---

# 19. Candidate Evaluation — Six Channels

巨大な単一Utilityを作らない。

## A. Competitive Outcome

- run / out / advancement distribution
- immediate win context
- field coverage

## B. Resource / Health

- bullpen availability
- pitcher fatigue
- injury risk estimate
- bench / roster future options
- next-game resource state

## C. Execution Feasibility

- player skill
- tactical understanding
- practice familiarity
- communication complexity
- timing

## D. Opponent / Information Response

- likely counteraction
- observable signaling
- preparation mismatch
- information gained
- opponent uncertainty

Surpriseはここへ含む。
独立Buffにしない。

## E. Human / Role Consequence

必要な場合だけ:

- role acceptance
- player request
- trust
- role stability

Team Mood direct modifier禁止。

## F. Exceptional Objective Relevance

rare:

- record / milestone
- retirement
- championship symbolism
- explicit player promise

---

# 20. Forecast is a Distribution

Managerは一点予測ではなく:

```text
expected outcome
+ uncertainty
+ downside
+ robustness
```

を見る。

Manager Forecastはcheap approximate model。

Canonical Match Coreを未来までTruth simulationしない。

---

# 21. Dominance Pruning

候補をすぐweighted sumしない。

Manager Belief上で:

```text
Candidate A
clearly worse in all relevant dimensions
        ↓
discard
```

を行う。

残ったViable Frontierだけ比較。

これによりweight tuning暴走を防ぐ。

---

# 22. Temperament Mainly Resolves Ambiguity

候補差が大きい時:

```text
obvious better candidate
 -> personality usually does not overturn
```

候補差が小さい時:

- risk appetite
- decision pace
- persistence
- novelty appetite
- consultation

が強く出る。

監督の「性格」は合理性破壊装置ではない。

---

# 23. Planning Horizons

```text
Pitch / At-bat
Game
Series
Season
Development / Career
```

を必要な範囲だけ見る。

例:

title-deciding game:

```text
future pitching preservation weight ↓
win-now weight ↑
```

ordinary April game:

```text
season workload value remains high
```

---

# 24. Objective Context

固定Objective Vectorを毎回全部加算しない。

ContextによりRelevant Objectiveをactivate。

通常:

- win now
- resource preservation
- health

特殊:

- development
- milestone
- symbolic role

Objectiveは結果Buffではない。

---

# 25. Psychological / Information Tactics

相手心理を直接変更禁止。

```text
visible unusual action
 -> opponent observes
 -> existing Player Appraisal system
 -> EmotionPressure
 -> ActiveEmotion only if threshold crossed
```

Manager側は:

```text
estimated Appraisal distribution
```

しか持たない。

同じ行為が:

- disturb
- motivate
- do nothing

すべてあり得る。

05 PsychologyをSource of Truthとする。

---

# 26. Surprise

Surpriseは独立Valueではない。

初見Actionにより:

- opponent Belief uncertainty
- preparation mismatch
- response latency

が変わり得る。

Repeated exposureで自然に減衰。

---

# 27. Exploration Gate

in-world `Experiment Budget`は持たない。

新Hypothesisを実戦投入するか:

```text
plausible competitive benefit
+ learning value
+ Novelty Appetite
- uncertainty
- stakes
- execution complexity
- downside risk
        ↓
Exploration Gate
```

で判断。

High stakesではthresholdが自然に上がる。

---

# 28. Strategy Hypothesis Lifecycle

```text
IDEA
 -> HYPOTHESIS
 -> LIMITED USE
 -> PROVISIONAL POLICY
 -> ESTABLISHED POLICY
 -> DEFAULT POLICY
 -> DORMANT / OBSOLETE
```

失敗 / Noise / Fadも許可。

「新しい = 強い」は禁止。

---

# 29. Evidence Update

勝敗だけで学習しない。

対象Strategyに関連するIntermediate Outcomeを見る。

例:

Opener-like idea:

- target batter outcomes
- first-inning prevention
- bulk pitcher effect
- bullpen downstream cost

Analysis Skillがevidence interpretationへ作用。

Adaptation Skillがpolicy updateへ作用。

---

# 30. Outcome Attribution

```text
good decision + bad outcome
bad decision + good outcome
```

を許可。

Result Bias等はBelief Update distortionとして表現可能。

独立巨大Bias systemにはしない。

---

# 31. Strategy Diffusion

Global unlock禁止。

伝播:

- opponent observation
- assistant tenure
- mentorship
- staff movement
- public evidence
- analyst study

Observerは内部Policyを直接読まない。

```text
visible behavior
 -> inferred policy
 -> uncertainty
```

誤模倣可能。

---

# 31.1 League-local Doctrine Diffusion — CANONICAL

Strategy / doctrine diffusion is **not globally uniform**.

Default topology:

```text
same club / staff tree
        strongest

same league / frequent opponents
        strong

same competition region
        medium

cross-league / cross-region
        weak by default
```

Reason:

- managers repeatedly observe opponents in their own league
- local media / analysts study the same competition
- coaches and players move more often inside familiar markets
- shared rules / schedules / ballparks create comparable evidence
- the same tactical idea may have different value under different player populations

Therefore:

```text
successful MLB policy
 != immediate NPB adoption

successful NPB policy
 != immediate MLB adoption
```

Cross-league doctrine transfer requires an actual bridge.

Bridge examples:

- manager / coach moves leagues
- player with tactical knowledge moves leagues
- analyst / front-office staff movement
- international tournament exposure
- interleague / exhibition competition
- public statistical / video evidence
- deliberate study by a high-Novelty / high-Analysis staff
- independent rediscovery

Each bridge transfers only observable / communicable knowledge.

No league receives the source Manager's hidden beliefs or exact calibrated confidence.

## Portability Friction

Even when a doctrine is learned, its local value must be re-evaluated.

```text
foreign doctrine
        ↓
local rules
+ local player population
+ ball / park environment
+ roster construction
+ opponent meta
+ available data
        ↓
local hypothesis
        ↓
adopt / modify / reject
```

This prevents a globally successful tactic from becoming an automatic universal optimum.

## League Tactical Culture is Derived

A league may be described as:

- bunt-heavy
- power-oriented
- aggressive-running
- leverage-bullpen-heavy
- starter-heavy

only after actual Manager policies produce that distribution.

League tactical culture is not a direct Modifier.

```text
local repeated success
+ local coaching lineage
+ local evidence
+ slow cross-league transfer
        ↓
persistent but changeable league doctrine
```

## Cross-league Transfer Delay

The Engine may model transfer probability / evidence accumulation through a League Knowledge Network.

Candidate conceptual edge:

```ts
type StrategyKnowledgeEdge = {
  fromCompetition: CompetitionId;
  toCompetition: CompetitionId;

  observationStrength: number;
  staffMobility: number;
  playerMobility: number;
  sharedDataAvailability: number;
  ruleSimilarity: number;
};
```

This is **not** a direct strategy-strength multiplier.

It only affects:

- whether another league notices the idea
- how accurately it is inferred
- how quickly enough evidence accumulates to test it

The edge must remain dynamic and may strengthen through globalization, staff movement, international competition or technology.

## Independent Development

A league does not need to import every idea.

The same tactical concept may emerge independently because similar constraints create similar hypotheses.

Thus:

```text
MLB invention
        X no direct transfer
NPB independent discovery
        ↓
similar observable doctrine
```

is valid.

## Acceptance Tests

1. a successful doctrine can dominate one league for years without instant global adoption.
2. neighboring / highly connected leagues learn faster than isolated leagues.
3. a coach moving leagues can accelerate transfer.
4. imported doctrine may fail because local roster / rules / environment differ.
5. another league may independently discover a similar tactic.
6. no league has a permanent hard-coded baseball philosophy.
7. long-run globalization may increase cross-league convergence, but never forces it.
8. league-local tactical identities can persist while still evolving.

---

# 32. Coaching Tree

継承可能:

- priors
- hypothesis seeds
- terminology
- decision framework
- practice routines

継承禁止:

- Skill
- exact confidence
- hidden player beliefs

```text
same school
 != same ability
```

---

# 33. League Meta

MetaはControllerではなくDerived observation。

```text
active policy distribution
+ rules
+ player population
+ roster construction
        ↓
League Meta descriptor
```

Metaが:

```text
all managers +20 bullpen
```

のようなBuffを配ることは禁止。

---

# 34. Era

Eraは能力補正ではない。

変化:

- available statistics
- tracking / video
- medical knowledge
- staff specialization
- rules
- roster structure
- common priors

```text
Environment
 -> available evidence / prior
 -> Manager decisions
```

Old-era managerが低能力とは限らない。

---

# 35. Future Baseball

未来戦術を脚本化しない。

```text
new rules / technology / player population / economics
        ↓
different strategy value landscape
        ↓
new hypotheses
        ↓
adoption / failure / counters
        ↓
new meta
```

Unknown future,
same causal baseball world。

---

# 36. Anti-lock-in

Meta固定を防ぐ必須脱出路:

- new evidence
- counter-strategy
- independent rediscovery
- rule change
- technology change
- player population change
- staff movement
- Tactical Grammar exploration

Manager priorsはMetaから得てもよいが、
MetaはAction Valueへ直接加点しない。

---

# 37. Unusual / "Gimmick" Managers

奇策好きはNamed Traitではない。

例:

```text
high Novelty Appetite
+ quick Decision Pace
+ low Analysis
+ low Policy Persistence
        ↓
many unusual candidates admitted
+ weak calibration
        ↓
frequent odd decisions
```

ただし奇策へhidden penaltyなし。

普通の因果で:

- free baserunner
- uncovered field
- depleted bullpen
- execution confusion
- opponent adaptation

等がCostになる。

成功すれば本当に成功してよい。

---

# 38. Conservative Failure

逆も成立。

```text
low Novelty Appetite
+ high Policy Persistence
        ↓
valuable new option is never admitted
```

革新性だけが正義ではない。

---

# 39. Decision Log — Canonical

Decision Logは後付け作文ではない。

Decision時点のstructured trace。

```ts
type ManagerDecisionTrace = {
  decisionId: DecisionId;
  trigger: DecisionTrigger;
  observedFacts: readonly FactTag[];
  beliefSummary: readonly BeliefTag[];

  candidates: readonly CandidateDecisionTrace[];
  chosenAction: TacticalAction;

  acceptedRisks: readonly ReasonTag[];
  objectiveTags: readonly ReasonTag[];
  horizonTags: readonly ReasonTag[];

  result?: OutcomeSummary;
  learningUpdate?: LearningUpdateSummary;
};
```

UI文章はReasonTagから生成。

---

# 40. Decision Log Storage

```text
Routine
 -> aggregate only

Meaningful
 -> compact trace

Key Decision
 -> persistent full trace
```

Key判定候補:

- leverage
- unusualness
- candidate disagreement
- opponent response
- large learning update
- milestone
- championship

長期Saveでunbounded growth禁止。

---

# 41. User-facing Thought Log

通常UI例:

```text
8回表 1死一塁
投手交代 A → B

判断材料
・Aは3巡目
・球数増加
・Bを次打者により適すると評価
・Bは十分休養

受け入れたRisk
・Bを9回に使えなくなる可能性

見送った案
・A続投
```

表示しない:

- World Truth
- exact hidden true ability
- debug-only utility number

---

# 42. Opponent Thought Log

Default:

試合中:
- visible action only
- no full private belief leak

試合後:
- optional structured decision review
- qualitative confidence / reasons
- no exact hidden scouting truth

Developer / Research mode:
- deeper trace allowed

---

# 43. Historical Stress-test Contract

以下をspecial-caseなしで表現可能であること。

- 1番・投手
- perfect-game中の継投
- 前日heavy workload Ace relief
- starter long relief on short rest
- three-ace emergency relay
- walk-off pinch hitter
- five-infielder alignment
- secondary starter
- extreme lineup churn
- fixed bullpen sequence
- green-light running
- pitcher-field-position switch where era rules permit
- squeeze inferred by defense
- unusual intentional walk with psychological intent

44のHistorical Stress Testはvalidation catalogとして維持する。

---

# 44. Human / CPU Contract

## CPU

```text
same legal actions
+ imperfect beliefs
+ Manager skills
+ philosophy
+ temperament
 -> decision
```

## Human User

User自身のAction選択をManager Skillで勝手に変更しない。

Manager avatar能力を導入する場合も影響先は:

- information quality
- staff recommendation
- communication
- role acceptance
- workload support

等。

---

# 45. Computational Boundaries

- no exhaustive full-game search every pitch
- routine Fast Path
- sparse Deliberative Search
- candidate count bounded
- hypothesis count bounded
- cheap Forecast Model
- no hidden Match Core future oracle
- seeded determinism for debugging

Candidate technical budgetはEngine optimizationであり、
Manager personality resourceではない。

---

# 46. Long-run Validation

最低:

- 10-season soak
- 50-season soak
- 100+ season soak
- multiple seeds

計測:

- manager style diversity
- manager style stability
- tactical adoption
- tactical extinction
- independent rediscovery
- rare/unusual action frequency
- lineup churn
- bullpen usage
- starter usage
- steal / bunt frequency
- shift frequency
- meta turnover
- manager result contribution
- roster result contribution
- compute time
- save growth

---

# 47. Failure Criteria

以下ならv1 validation failure。

- every manager converges to one optimal style
- one tactic dominates all contexts
- Manager rating overwhelms player roster quality
- novelty-loving managers spam free gimmicks without cost
- conservative managers can never discover anything
- psychology becomes frequent hidden performance modifier
- CPU sees hidden truth
- thought log contradicts actual decision trace
- future meta becomes permanently locked
- long save compute / storage grows unbounded
- human and CPU use different legal baseball rules

---

# 48. UI Contract

Normal Manager Profile:

```text
総合評価 A

能力
采配 A
分析 B
適応 A
選手眼 C
運用 A
統率 B

野球観
・早め継投
・出塁重視
・固定打順
・若手やや積極
・データ重視

性格
・慎重
・方針を簡単には変えない
・新戦術にはやや積極
```

30 slidersを通常画面へ出さない。

詳細はoptional。

---

# 49. Frozen v1 Boundary

v1へ新しいManager概念を追加する条件:

1. existing Skill / Philosophy / Temperament / Belief / Strategy Memoryで説明不能
2. at least multiple independent baseball casesへ適用可能
3. direct buffにならない
4. Source of Truthが重複しない
5. long-run simulationでbounded
6. historical special-caseにならない

一件の珍しい史実だけのために新statを追加しない。

---

# 50. Final v1 Summary

```text
Environment / Rules / Staff / Relationships
                    ↓
          Manager Agent
      ┌────────┬──────────┐
      │        │          │
    Skill  Philosophy  Temperament
      │        │          │
      └────┬───┴────┬─────┘
           ↓        ↓
        Belief   Strategy Memory
           └────┬────┘
                ↓
          Decision Engine
                ↓
          Legal Baseball Action
                ↓
       Instruction / Player Intent
                ↓
        Canonical Match Simulation
                ↓
        Evidence / Decision Trace
                ↓
        Learning / Strategy History
```

Public Overall S〜Gはこの構造を読みやすく要約するPresentation / observed estimateであり、上図のManager Agent Source of Truthへ追加しない。

この構造をManager Architecture v1としてfreezeする。