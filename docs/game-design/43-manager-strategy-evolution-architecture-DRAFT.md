# Manager Strategy Evolution Architecture — DRAFT

更新日: 2026-09-20  
状態: **設計候補。USER REVIEW REQUIRED。実装前。**

関連:
- `docs/game-design/39-manager-philosophy-and-command-architecture-DRAFT.md`
- `docs/game-design/40-manager-ratings-era-and-strategy-evolution-DRAFT.md`
- `docs/game-design/41-manager-appointment-and-incompetence-DRAFT.md`

---

# 1. Goal

以下を一つの因果Systemで扱う。

- Strategy Hypothesis
- 戦術の自動発明
- 戦術拡散
- Coaching Tree
- 時代Metaの自動進化
- 未来野球のEmergence

最重要原則:

> **未来戦術を名前付きイベントとして脚本化しない。**

戦術は小さなDecision PrimitiveとContext Ruleの組み合わせから生成する。

---

# 2. Seven-Layer Architecture

```text
L0 Baseball Environment
        ↓
L1 Tactical Primitives
        ↓
L2 Manager Belief Model
        ↓
L3 Strategy Hypotheses
        ↓
L4 Experiment / Learning
        ↓
L5 Strategy Diffusion / Lineage
        ↓
L6 League Meta / Counter-Strategy
        ↓
future hypotheses
```

---

# 3. L0 — Baseball Environment

Era名そのものを原因にしない。

Environmentに持たせる:

- rules
- available statistics
- video / tracking technology
- medical / fatigue knowledge
- staff specialization
- roster rules
- ball / stadium environment
- player population
- league schedules
- substitution restrictions
- communication tools

```text
Era
 = derived historical label

Environment
 = actual causal input
```

昭和 / 平成 / 令和 / future eraはEnvironmentの違いから現れる。

---

# 4. L1 — Tactical Primitive

Strategyを最初から名前付きClassとして持たない。

Primitive例:

## Offense
- lineup slot assignment
- swing aggression prior
- zone selectivity
- power/contact intent
- bunt threshold
- steal threshold
- hit-and-run threshold
- extra-base aggression

## Pitching
- starter pull threshold
- times-through-order weight
- fatigue tolerance
- reliever leverage threshold
- platoon matchup weight
- pitch-family preference
- zone / chase preference

## Defense
- fielder starting position
- shift aggressiveness
- infield depth
- outfield depth
- bunt-defense positioning
- runner-hold priority

## Roster / Usage
- call-up threshold
- demotion threshold
- rest threshold
- veteran / youth preference
- role stability
- lineup rotation

---

# 5. Context Pattern

PrimitiveはContextと組み合わせる。

候補Context:

- inning
- score differential
- outs
- base state
- leverage
- batter hand
- pitcher hand
- batter archetype
- pitcher archetype
- times through order
- fatigue
- bullpen availability
- recent workload
- park
- opponent tendencies
- season objective
- roster depth

戦術は:

```text
Context Pattern
 -> preferred action / threshold
```

の集合。

---

# 6. Strategy Policy

内部StrategyはPolicy Rule setとして保持する。

```ts
type TacticalPolicyRule = {
  context: ContextPattern;
  action: TacticalAction;
  weight: number;
  threshold?: number;
};

type StrategyPolicy = {
  rules: readonly TacticalPolicyRule[];
  objectiveWeights: ObjectiveWeights;
};
```

これにより名前のないStrategyも存在可能。

例:

```text
if:
  starter third time through
  AND leverage high
  AND rested top reliever available

then:
  increase pull probability strongly
```

---

# 7. Named Strategy is a Descriptor

「オープナー」「スモールボール」等の名称はSource of Truthではない。

```text
actual Policy pattern
        ↓
pattern recognition
        ↓
human-readable descriptor
```

新しい戦術は最初、名前がなくてもよい。

後からMedia / League / UIがLabelを付ける。

---

# 8. L2 — Manager Belief Model

CPU ManagerはWorld Truthを直接見ない。

```text
observations
+ reports
+ statistics
+ scouting
+ own experience
+ staff input
        ↓
Manager Belief State
```

Beliefには:

- expected effects
- uncertainty
- sample size
- recency
- opponent-specific estimates
- player-specific estimates

を持つ。

---

# 9. Causal Belief, not only Correlation

Managerは単純な勝敗相関だけを学習しない。

仮説例:

```text
"先発を早く降ろすと勝つ"
```

では粗すぎる。

より良いHypothesis:

```text
"third time through
 + batter advantage
 + fresh high-quality reliever available
 -> expected run prevention improves"
```

Analysis Skillが高いほどContextを分離しやすい。

---

# 10. L3 — Strategy Hypothesis

```ts
type StrategyHypothesis = {
  id: StrategyHypothesisId;

  trigger: ContextPattern;
  candidatePolicy: StrategyPolicy;

  expectedEffects: EffectEstimate;
  confidence: number;
  uncertainty: number;

  evidenceFor: EvidenceSummary;
  evidenceAgainst: EvidenceSummary;

  origin: HypothesisOrigin;
  lineage?: StrategyLineageId;
};
```

Hypothesisはまだ「信じている戦術」。

Truthではない。

---

# 11. Hypothesis Origins

候補:

- SELF_OBSERVATION
- STAFF_SUGGESTION
- OPPONENT_OBSERVATION
- COACHING_LINEAGE
- PLAYER_FEEDBACK
- STATISTICAL_PATTERN
- INDEPENDENT_REDISCOVERY
- MUTATION_OF_EXISTING_POLICY

これにより「誰から学んだか」をHistoryとして保持可能。

---

# 12. Automatic Invention

自動発明は完全Randomな奇策生成にしない。

新Hypothesisは既存Policyからの小さな変形を基本とする。

候補Mutation:

- threshold shift
- context narrowing
- context expansion
- two rules combination
- action substitution
- priority inversion
- role reassignment
- sequencing change

例:

```text
existing:
  starter -> reliever

mutation:
  reliever -> bulk starter

condition:
  opponent top order first inning
```

からOpener-like policyが生まれる。

---

# 13. No Random Genius

禁止:

```text
random roll succeeds
 -> manager discovers unbeatable strategy
```

必要:

```text
observable anomaly
+ plausible hypothesis
+ roster capability
+ experiment opportunity
+ evidence
        ↓
possible innovation
```

革新的Managerでも大量の失敗仮説を持ち得る。

---

# 14. Who Innovates

Innovation frequency候補:

```text
Experimentation Tendency
+ Analysis
+ Adaptation
+ tactical curiosity
+ staff quality
+ available information
+ organizational freedom
- current competitive risk
```

Experimentation TendencyはPhilosophy。

Analysis / AdaptationはSkill。

---

# 15. L4 — Experiment Budget

CPUが毎試合奇策を試すのを防ぐ。

各Manager / TeamにExperiment Budgetを持たせる。

Budget消費候補:

- unusual lineup
- new bullpen sequence
- extreme shift
- new role assignment
- tactical threshold test

Budget増加:

- low-stakes games
- rebuilding season
- spring / preseason
- large lead / deficit
- high experimentation tendency

Budget減少:

- postseason
- title race
- severe instability
- recent failed experiments
- low risk tolerance

---

# 16. Safe Exploration

新戦術は原則small testから始める。

```text
Hypothesis
 -> limited-context trial
 -> repeated trial
 -> confidence grows
 -> wider deployment
```

High-risk Managerのみ初期から大規模導入し得る。

---

# 17. Evidence Update

Experiment結果を単純な:

```text
win = good
loss = bad
```

にしない。

Evidenceは対象Intermediate Outcomeを見る。

例:

Opener-like strategyなら:

- first-inning run prevention
- target hitters faced
- bullpen load
- bulk pitcher performance
- downstream availability cost

等。

Manager Analysisが低ければNoisy Resultに過剰反応することもある。

---

# 18. Analysis vs Adaptation

分離を明確にする。

```text
Analysis
 = evidenceを正しく読む

Adaptation
 = belief / policyを更新する
```

例:

```text
Analysis S + Adaptation F
 -> 問題点には気づく
 -> でも方針を変えない

Analysis D + Adaptation S
 -> すぐ変える
 -> しかしNoiseに振り回される
```

---

# 19. Tactical Judgment Role

采配SkillはHypothesis生成能力ではない。

```text
known beliefs
+ current context
        ↓
choose action now
```

を担当する。

これにより:

- 研究者型監督
- 現場判断型監督
- 両方強い監督

を分離できる。

---

# 20. Strategy Promotion Lifecycle

```text
IDEA
 -> HYPOTHESIS
 -> LIMITED_TRIAL
 -> PROVISIONAL_POLICY
 -> ESTABLISHED_POLICY
 -> DEFAULT_POLICY
 -> OBSOLETE / DORMANT
```

失敗すれば途中でDROP。

Dormant Policyは環境変化で再発見可能。

---

# 21. User-created Strategy

User自身はHypothesis AIに行動を決められない。

Userが:

- repeated Game Plan
- repeated threshold
- repeated lineup pattern
- custom saved policy

を使った場合、その実行履歴をStrategyとして観測する。

```text
User behavior
 -> observable Policy signature
 -> opponents learn from it
```

Userが未来戦術の発明者になることも可能。

---

# 22. Strategy Signature

戦術比較用にBehavior Signatureを作る。

候補:

- starter hook distribution
- steal attempt context
- bunt context
- platoon intensity
- lineup churn
- leverage reliever usage
- shift location pattern
- rest distribution

似たPolicy同士を距離計算できるようにする。

これにより:

- imitation
- derivative strategy
- independent rediscovery

を区別する。

---

# 23. L5 — Strategy Diffusion

StrategyはGlobal Unlockにしない。

伝播経路:

- opponent observation
- assistant / coach tenure
- manager mentorship
- player / coach movement
- public game evidence
- analyst study
- league-wide visible success

各経路でTransfer Fidelityを変える。

---

# 24. Observation Diffusion

対戦相手はStrategyの内部Ruleを読めない。

見えるのは:

- actual substitutions
- lineups
- pitch usage
- shifts
- running decisions

そこから推定する。

```text
observed behavior
 -> inferred strategy
 -> uncertainty
```

なので誤模倣も起こり得る。

---

# 25. Coaching Tree

Coaching TreeはSkill inheritanceではない。

継承可能:

- tactical priors
- known hypotheses
- terminology
- practice routines
- decision frameworks
- trust in certain evidence types

継承しない:

- Analysis Skill
- Adaptation Skill
- Tactical Judgment
- Leadership

```text
same school of thought
 != same ability
```

---

# 26. Idea Lineage Graph

```ts
type StrategyLineageEdge = {
  fromPerson: PersonId;
  toPerson: PersonId;
  hypothesisId: StrategyHypothesisId;
  transferType:
    | "ASSISTANT_TENURE"
    | "MENTORSHIP"
    | "OBSERVATION"
    | "STAFF_MOVE"
    | "INDEPENDENT_REDISCOVERY";
  fidelity: number;
};
```

Save内に「戦術思想の家系図」を持てる。

---

# 27. Independent Rediscovery

同じようなStrategyが別系統で独立発生してもよい。

Behavior Signatureが似ていてもLineageが無ければ:

```text
independent rediscovery
```

とする。

これにより世界が不自然に一人の発明者へ集約されない。

---

# 28. L6 — League Meta

League Metaを単一のBuff値にしない。

Metaは:

```text
distribution of active policies
+ player population
+ rules
+ roster construction
+ counter-strategies
```

からDerivedする。

例:

```text
starter usage length distribution
bunt frequency
steal frequency
platoon usage
shift intensity
reliever leverage usage
```

等。

---

# 29. Meta is Observation, not Controller

禁止:

```text
Meta = bullpen era
 -> all managers bullpen +20
```

正しい方向:

```text
many managers independently adopt bullpen-heavy policies
        ↓
League Meta descriptor:
"bullpen-heavy era"
```

Metaは結果の要約。

---

# 30. Era Prior

新人Managerは何もない真空から始めない。

```text
current league meta
+ mentors
+ organization
+ personal experience
        ↓
initial priors
```

これがEraのCommon Senseになる。

しかし逸脱可能。

---

# 31. Counter-Strategy

相手戦術が普及すると、その戦術を対象にしたHypothesisが生まれる。

例:

```text
opponents use early relievers
        ↓
batting order / bench usage adjusts
        ↓
new counter-policy
```

Counterが普及すると元StrategyのEdgeが縮小する。

---

# 32. Strategy Edge is Contextual

「この戦術は+5%強い」という永久値は禁止。

```text
Strategy Edge
 = policy
 × roster fit
 × opponent policy
 × environment
 × information advantage
```

同じStrategyでも時代・球団・相手で価値が変わる。

---

# 33. Meta Cycle

```text
Innovation
 -> Early Advantage
 -> Observation
 -> Diffusion
 -> Counter
 -> Edge Compression
 -> New Innovation
```

これを固定周期にしない。

実際の採用行動の集積から発生させる。

---

# 34. Future Baseball Emergence

Future Baseballに特別な未来Ruleを置かない。

未来が変化する原因:

- player population evolution
- rule changes
- new measurement technology
- improved staff analysis
- changed roster economics
- accumulated strategic knowledge
- new counter-strategies

これらがStrategy Search Spaceの価値を変える。

---

# 35. Discovery Limits

現実性のため、Managerは存在しない情報を使えない。

例:

Tracking Technologyが無いEraで:

```text
exact launch angle database
```

を使ったHypothesisは禁止。

ただし:

```text
human observation
+ scorebook data
+ repeated experience
```

から似た結論へ早期到達することは許す。

---

# 36. Unknown Future, Known Physics

未来戦術が奇抜でも、Match Coreの物理・選手能力・Rulesを破らない。

```text
new strategy
 -> new decisions
 -> same causal baseball world
```

未来だから能力Buffが追加されることはない。

---

# 37. Innovation Does Not Equal Progress

新しい戦術が古い戦術より常に優れているとは限らない。

- failed innovations
- fads
- overreactions
- false correlations
- temporary matchup-specific ideas

も発生可能。

Leagueが一時的に間違ったMetaへ進むことすら許す。

---

# 38. Historical Memory

Save Historyに重要なStrategy Eventを記録する。

候補:

- first observed use
- first sustained use
- first championship-level success
- major adopter
- first counter-strategy
- league adoption milestone

ただし「発明者」はEvidenceが十分な場合のみ表示。

---

# 39. User-facing History

Optional UI候補:

```text
戦術史

2043
○○監督が救援投手の初回起用を継続的に採用

2045
同戦術がリーグ6球団へ拡大

2047
対策型打順が増加

2049
初回救援起用率がピークから低下
```

通常Playでは必須閲覧にしない。

---

# 40. Public Manager Profile

現在のManager画面では:

```text
能力
采配 A / 分析 S / 適応 A
選手眼 B / 運用 B / 統率 C

野球観
データ重視
継投早め
流動打順
実験的

最近の特徴
・先発3巡目前の継投が増加
・高Leverageで抑え以外も投入
・一部試合で新しい救援順を試行
```

程度に留める。

Hypothesis内部値は見せない。

---

# 41. CPU Computational Boundary

全Managerが全Action Spaceを総当たり探索しない。

Candidate generationを局所探索に限定。

```text
current policy
 -> small mutations
 -> plausible candidates
 -> limited evaluation
```

Sparse updatesを使い、毎Pitch全戦術を再設計しない。

---

# 42. Determinism

同じ:

- World Seed
- Manager State
- Evidence
- Inputs

なら同じHypothesis generation / updateになるよう deterministic RNGを使う。

Replay / debugging可能にする。

---

# 43. Anti-Exploit / Anti-Chaos

必要Guardrail:

- small-sample confidence penalty
- experiment budget
- high-stakes experimentation penalty
- failed-hypothesis cooldown
- policy complexity cost
- roster-fit requirement
- no hidden truth access
- no direct strategy buff

戦術数が無限増殖しないよう似たPolicyはclusterする。

---

# 44. Acceptance Tests

1. conservative but skilled managers can win without innovating.
2. innovative but poor-analysis managers can create bad fads.
3. high-Analysis low-Adaptation manager sees problems but changes slowly.
4. low-Analysis high-Adaptation manager overreacts.
5. identical tactics can independently emerge in different clubs.
6. coaching descendants inherit ideas, not skill.
7. successful strategies spread gradually.
8. observation can produce imperfect copies.
9. widespread strategies attract counters.
10. strategy edge shrinks when environment changes.
11. user-created policies can be observed and imitated by CPU.
12. CPU-created policies can be copied by user and work when causal context matches.
13. Era labels do not grant tactics; environment constrains available information.
14. future strategies can emerge without hard-coded future labels.
15. failed innovations and temporary fads are possible.
16. Match Core remains unchanged by strategy history; only decisions change.

---

# 45. Recommended Approval Order

First approve:

- Tactical Primitive + Context Pattern
- Manager Belief State
- Strategy Hypothesis lifecycle
- Experiment Budget / bounded exploration

Then approve:

- Diffusion
- Coaching Tree / Idea Lineage
- League Meta derivation
- Counter Strategy

Finally validate:

- historical era reconstruction
- long-run future-emergence soak
- user imitation of CPU strategy
- CPU imitation of user strategy
