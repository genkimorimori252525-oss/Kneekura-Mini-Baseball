# Manager Decision Engine & Temperament — DRAFT

更新日: 2026-09-20  
状態: **設計候補。USER REVIEW REQUIRED。実装前。**

関連:
- `docs/game-design/39-manager-philosophy-and-command-architecture-DRAFT.md`
- `docs/game-design/40-manager-ratings-era-and-strategy-evolution-DRAFT.md`
- `docs/game-design/43-manager-strategy-evolution-architecture-DRAFT.md`
- `docs/game-design/44-manager-real-world-tactical-stress-tests-DRAFT.md`

---

# 1. Goal

CPU監督の一回の采配を、以下の同じEngineで説明する。

- 通常の継投
- 代打
- 盗塁
- スクイズ
- 守備シフト
- 内野5人
- AceのEmergency Relief
- 完全試合中の継投判断
- Seriesを見越した投手運用
- unusual / innovative tactic

成功した時だけでなく、迷采配・珍采配も同じEngineから出す。

---

# 2. Three Distinct Manager Layers

監督の個性を三つに分離する。

```text
Skill
= どれだけ上手く判断 / 実行できるか

Philosophy
= 何を好み、何を価値ある野球と考えるか

Temperament
= 不確実性・圧力・対立・迷いの中で
  どう決断する人か
```

禁止:

```text
大胆な性格
 -> 采配 +5

慎重な性格
 -> 勝率 -3%
```

TemperamentはDecision Processを変える。

---

# 3. Decision Engine Overview

```text
Decision Trigger
        ↓
Observed Situation
        ↓
Manager Belief Slice
        ↓
Legal Action Set
        ↓
Candidate Generation
        ↓
Manager Forecast
        ↓
Objective / Horizon Evaluation
        ↓
Risk + Philosophy + Temperament
        ↓
Bounded Decision
        ↓
Instruction Encoding
        ↓
Player Interpretation / Response
        ↓
Canonical Match Simulation
        ↓
Post-decision Evidence
        ↓
Belief / Strategy Memory Update
```

---

# 4. Decision Trigger

毎Pitchすべてを再計算しない。

Decision Trigger例:

- batter changes
- count reaches important state
- runner state changes
- pitcher fatigue crosses threshold
- leverage jumps
- opponent substitution
- defensive alignment exposed
- injury / discomfort signal
- new inning
- planned role boundary
- unexpected opponent behavior
- milestone / record state
- elimination / championship condition

Routine situationなら既存Policyを使う。

---

# 5. Two-path Decision Model

## 5.1 Fast Policy Path

普通の局面。

```text
known context
 -> established policy
 -> legal check
 -> execute
```

例:

- 通常の守備位置
- 予定通りの7回セットアッパー
- 普段の打順
- 標準的な代打判断

低コスト。

## 5.2 Deliberative Search Path

以下で起動:

- high leverage
- unusual context
- opponent surprise
- policy conflict
- large uncertainty
- major record / championship context
- strategy experiment opportunity

```text
generate several plausible candidates
 -> forecast
 -> compare tradeoffs
 -> choose
```

名采配はこのPathから生まれることが多いが、
Routine Policyから良い采配が出てもよい。

---

# 6. Manager Belief Slice

CPU監督はWorld Truthを使わない。

その局面で必要な情報だけをBeliefから読む。

例:

```ts
type ManagerBeliefSlice = {
  playerEstimates: PlayerEstimate[];
  opponentEstimates: OpponentEstimate[];
  fatigueEstimates: FatigueEstimate[];
  tacticalHypotheses: StrategyHypothesisRef[];
  staffAdvice: AdviceEstimate[];
  uncertainty: UncertaintyProfile;
};
```

低い選手眼 / 分析能力ではEstimateが粗くなる。

---

# 7. Legal Action Set

RuleEngineがそのEra / League / Situationで合法なActionを返す。

例:

- continue pitcher
- replace pitcher
- move pitcher to legal field position
- pinch hit
- pinch run
- intentional walk
- defensive alignment
- five-infielder alignment
- bunt / squeeze
- steal sign
- soft green light
- lineup / role changes when allowed

野村型「投手↔一塁」も、
当時のRulesで合法なら普通のAction組み合わせとして扱う。

---

# 8. Candidate Generation

全Actionを総当たりしない。

Candidate source:

1. Default Philosophy
2. Current Game Plan
3. Established Policies
4. Staff Suggestions
5. Strategy Hypotheses
6. Contextual emergency actions
7. Small tactical mutations

例:

```text
1点を絶対防ぎたい
1死二三塁
        ↓
Candidate:
- normal infield
- infield in
- intentional walk
- five infielders
- pitcher change
```

「内野5人」という専用Legendary Actionは不要。

---

# 9. Candidate Recall Skill

采配能力の一部として:

> **良い候補を思いつけるか**

を扱う。

低采配Manager:

- obvious candidatesしか出ない
- important alternativeを見落とす

高采配Manager:

- contextに適した合法候補を複数思い出せる
- unusual but plausible optionを候補へ入れられる

ただしUnknown Future StrategyにはStrategy Hypothesis / Experimentの裏付けが必要。

---

# 10. Manager Forecast Model

各CandidateについてManager自身の予測を作る。

重要:

> Match Coreを未来までTruthで覗かない。

Manager ForecastはBeliefから作るApproximate Model。

```text
Believed player ability
+ believed opponent tendency
+ fatigue estimate
+ park / rules
+ current context
+ tactical hypothesis
        ↓
Predicted consequences
```

予測対象:

- run expectancy
- out / base advancement distributions
- pitcher survival / fatigue
- bullpen cost
- injury risk estimate
- next-inning resource state
- opponent likely response
- role / communication consequence

---

# 11. Forecast Accuracy

公開6能力との接続:

## 采配
候補生成・局面比較・Timing。

## 分析
Belief材料の解釈、uncertainty処理、相手傾向推定。

## 適応
新EvidenceでForecast / Policyを更新。

## 選手眼
Player readiness / role fit / fatigue等のEstimate。

## 運用
Future resource cost、投手負荷、Roster Horizon評価。

## 統率
選択後のInstruction clarity / acceptance / role consequence。

同じActionを選んでも、その理由・見通しの質が違う。

---

# 12. Objective Vector

Managerは単一の「この試合の勝率」だけを最大化しない。

候補Objective:

```ts
type ManagerObjectiveState = {
  winNow: number;
  futureGameValue: number;
  playerHealth: number;
  seasonResourceValue: number;
  developmentValue: number;
  roleStability: number;
  milestoneValue: number;
  symbolicValue: number;
};
```

通常はwinNowが中心。

他ObjectiveはContextによって有効になる。

---

# 13. Decision Horizon Stack

一つのHorizonだけで考えない。

```text
Pitch Horizon
At-bat Horizon
Game Horizon
Series Horizon
Season Horizon
Career / Development Horizon
```

例:

## 10.8型

```text
title-deciding single game
 -> Series/Season future-resource value nearly collapses
 -> elite starters become relief candidates
```

## Regular Season April

```text
one ordinary game
 -> season workload retains large value
 -> ace emergency relief unlikely
```

---

# 14. Milestone / Symbolic Objective

落合2007型、田中2013型のために必要。

ただしMagic Bonusにしない。

候補:

- no-hitter / perfect game opportunity
- retirement game
- championship-clinching moment
- symbolic closer role
- player promise / request

これらはDecision Objectiveへ入るだけ。

```text
symbolic value
 != better pitch execution
```

---

# 15. Player Request / Willingness

Playerが:

- 続投したい
- 行かせてほしい
- 休みたい
- roleを変えたい

等をManagerへ伝えられる。

ManagerはAdvisory Inputとして受け取る。

```text
Player request
+ trust
+ health estimate
+ manager philosophy
        ↓
decision weight
```

Player requestがPhysical Stateを上書きしない。

---

# 16. Expected Utility — Conceptual

内部概念:

```text
Action Value
 =
Expected Baseball Value
+ Future Resource Value
+ Manager Objective Value
- Risk Cost
- Health Cost
- Role / Social Cost
- Complexity Cost
```

ただしこれはGame Designer向け概念。

UIへ数値表示しない。

---

# 17. Risk is a Distribution, not a Penalty

Managerは平均結果だけでなく分布を見る。

例: 内野5人

```text
Benefit:
  ground ball / short infield hit prevention ↑

Risk:
  uncovered outfield region ↑
  extra-base damage if ball escapes ↑
```

同じ期待値でも:

- one run absolutely cannot score
- multiple runs do not matter much

で選択が変わる。

---

# 18. Temperament Model

PersonalityはSkill / Philosophyから独立。

初期候補:

```ts
type ManagerTemperament = {
  decisiveness: number;
  conviction: number;
  composure: number;
  openness: number;
  consultativeStyle: number;
};
```

---

# 19. Decisiveness

```text
熟考型 <-> 即断型
```

高:
- limited evidenceでもDecisionをcommitしやすい
- high-leverageで早く動ける
- premature commitment risk

低:
-追加Evidenceを待つ
- overreactionを避けやすい
- actionが一歩遅れる場合

采配Skillとは別。

---

# 20. Conviction

```text
方針変更しやすい <-> 信念が強い
```

Adaptationとの違い:

```text
Adaptation Skill
= 変えるべき時を理解できるか

Conviction
= どれだけEvidenceを要求してから実際に変えるか
```

高Convictionが名将にも頑固な失敗にもなる。

---

# 21. Composure

```text
Pressure-sensitive <-> 冷静
```

high pressureで:

- candidate omission
- risk estimate distortion
- routine abandonment

がどれくらい起きるか。

Composureが低くても毎回失敗するわけではない。

---

# 22. Openness

```text
馴染みの方法重視 <-> 新しい考えも検討
```

影響:

- staff suggestion acceptance
- unfamiliar candidate consideration
- opponent innovation study
- hypothesis generation breadth

Experimentation Philosophyとは別。

```text
Openness
= ideaを候補に入れるか

Experimentation Tendency
= 実戦で試すのを好むか
```

---

# 23. Consultative Style

```text
自己決定型 <-> 相談型
```

Staff / Player inputの利用度。

相談型だから優秀ではない。

Staffが悪ければ悪い情報を取り込む可能性もある。

---

# 24. Personality Should Mostly Be Felt

TemperamentをS–G能力にしない。

通常UI候補:

```text
性格
冷静 / 信念型 / 相談型
```

または行動から感じさせる。

Optional Detailのみ:

- 即断傾向
- 信念の強さ
- 冷静さ
- 新奇性への開放
- 相談傾向

を表示可能。

---

# 25. Philosophy vs Temperament Examples

## A

```text
Philosophy:
  早め継投
  Data-heavy

Temperament:
  熟考型
  高Conviction
  冷静
```

→ 継投は早めだが、根拠が揃うまでPlanを崩さない。

## B

```text
Philosophy:
  早め継投
  Data-heavy

Temperament:
  即断型
  低Conviction
  Pressure-sensitive
```

→ 同じ思想でも試合中の動きがかなり違う。

---

# 26. Bounded Rationality

CPU監督をPerfect Optimizerにしない。

能力差はRandom Failureだけではなく:

- candidate omission
- inaccurate belief
- shallow forecast
- wrong horizon
- noisy evidence weighting
- opponent-response underestimation
- social consequence misreading

として現れる。

これが「無能な監督」を具体的に作る。

---

# 27. No Dice-roll Idiocy

禁止:

```text
Manager Tactical Rating D
 -> 30% chance to choose random bad action
```

代わりに:

```text
low Tactical Judgment
 -> fails to generate good candidate
 -> compares wrong quantities
 -> notices leverage late
 -> overvalues familiar action
```

とする。

---

# 28. Opponent Response Model

候補評価時に相手の反応も予測する。

ただし相手の未来Decisionを知るわけではない。

例: 内野5人

```text
5-infielder alignment shown
        ↓
offense observes
        ↓
possible pinch hitter / approach change
        ↓
defense may reconsider
```

Analysisが低いとOpponent Counterを軽視する場合がある。

---

# 29. Sequential Tactical Duel

一回の采配を単発にしない。

```text
Manager A acts
↓
observable world changes
↓
Manager B observes
↓
B acts / declines to act
↓
A gets another legal decision point
```

これにより:

- shift vs pinch hitter
- steal threat vs pitchout
- bunt show vs buster
- reliever matchup vs pinch hitter

などを表現する。

---

# 30. Hidden Intention / Observable Action

相手が見えるものと見えないものを分ける。

Observable:
- defensive position
- substitution
- bullpen warming
- lineup
- runner lead
- batter stance changes

Hidden / uncertain:
- exact steal sign
- squeeze sign
- intended pitch sequence
- internal game plan

PerceptionによってHidden Intentを推測できる。

---

# 31. Deception

Manager / Playerは意図を隠すActionを使える。

候補:

- fake bunt
- delayed steal
- decoy bullpen warmup
- defensive disguise
- pitch sequence feint

ただし「Deception +10」という結果Buffは作らない。

相手Beliefを変える情報Actionとして扱う。

---

# 32. Communication Layer

Chosen ActionをPlayerへ伝える段階を独立。

```text
Chosen Action
 -> Instruction Encoding
 -> Player receives
 -> understands / appraises
 -> Final Intent
```

統率 / Communicationが効く。

Hard Signでも:

- sign confusion
- late sign
- misunderstanding

はrareにあり得る。

---

# 33. Role of Trust

Trustは命令遵守率の単純Buffにしない。

Soft Directiveでは:

- Player accepts manager premise
- changes own threshold more strongly

Hard Signでは原則従うが:

- safety abort
- confusion
- conflict

の解釈へ影響。

---

# 34. Decision Memory

重要DecisionはMemoryとして残す。

```ts
type TacticalDecisionMemory = {
  contextSignature: ContextSignature;
  action: TacticalAction;
  predictedOutcome: EffectEstimate;
  observedOutcome: OutcomeSummary;
  opponentResponse?: TacticalAction;
  confidenceChange: number;
};
```

Strategy Hypothesis更新へ使う。

---

# 35. Outcome Attribution

負けたから采配が悪い、にしない。

例:

```text
excellent five-infielder decision
 -> weak contact happens to land in gap
 -> loss
```

Manager Analysisが高ければ:

「結果は悪かったが仮説は否定されない」

と判断できる。

逆に悪い采配が偶然成功しても過信しない場合がある。

---

# 36. Manager Bias / Error Patterns

個人ごとにPersistent Biasを持てる。

候補:

- reputation bias
- recency bias
- sunk-cost persistence
- veteran bias
- overconfidence
- underconfidence
- matchup overfitting
- result bias

ただし全員へ大量に付与しない。

Personality / historyから一部だけ形成。

---

# 37. Bias is not Trait Buff

BiasはDecision weightingの歪み。

例:

```text
Result Bias
 -> successful bad decision gets overvalued
 -> same policy repeated
```

将来Experience / Staff influenceで弱まる場合もある。

---

# 38. Example — 内野5人

```text
Trigger:
  late inning
  1 out
  runners 2nd/3rd
  one run critical

Belief:
  batter ground-ball tendency high
  current infield strong
  outfield hit concedes anyway

Candidates:
  normal
  infield in
  intentional walk
  five infielders

Forecast:
  five infielders improves short-ground coverage
  leaves huge outfield exposure

Objectives:
  prevent one run NOW

Temperament:
  decisive / risk-tolerant philosophy

Decision:
  five infielders

Opponent:
  pinch hitter / approach change

Manager:
  reconsider or stay

World:
  actual pitch / contact / fielding physics
```

Result can be success or failure.

---

# 39. Example — 山井 -> 岩瀬

```text
Trigger:
  top 9th
  1-run lead
  perfect game alive
  championship-clinching game

Belief:
  Yamai condition estimate
  Iwase closer reliability
  opponent order
  fatigue / injury
  bullpen readiness

Candidates:
  continue Yamai
  use Iwase

Objectives:
  championship win
  record opportunity
  role consistency
  player preference

Decision:
  depends on objective weights + belief + temperament
```

No historical script.

---

# 40. Example — 前日160球Ace Relief

```text
Trigger:
  championship-clinching 9th

Belief:
  ace heavily fatigued
  ace requests ball
  current reliever alternatives
  immediate win probability

Horizon:
  no tomorrow if title clinched
  health cost still real

Decision:
  may accept unusually high health / fatigue cost
```

Player desire is advisory only.

---

# 41. Example — Squeeze

```text
Offense:
  squeeze hypothesis
  runner / batter feasibility
  one-run value
  hard sign

Defense:
  does not read hidden sign
  observes lead / posture / prior tendency
  may infer squeeze

Pitcher/Catcher:
  choose pitchout / waste pitch if their own decision process supports it

World:
  pitch
  runner starts
  batter bunts / misses
  tag / rundown
```

---

# 42. Routine Manager Personality

性格は珍采配だけでなく普通の野球にも出る。

例:

- 同点7回、投手をあと一人見るか
- slumping veteranを何試合待つか
- young playerのerror後も使うか
- staff recommendationを即採用するか
- one bad gameでlineupを変えるか

ただしPersonalityがTeam Moodを常時揺らすようにはしない。

---

# 43. Public Explainability

CPU監督の采配後、必要なら簡単な理由を表示できる。

例:

```text
継投理由
・先発が3巡目
・球数が多い
・相手上位打線
・救援Aが休養十分
```

内部Utility値は出さない。

珍采配なら:

```text
内野5人
狙い: この1点を防ぐ
Risk: 外野が大きく空く
```

これによりUserはCPUから学べる。

---

# 44. Counterfactual Review

Optional advanced feature:

試合後にManager / Analyst AIが:

```text
What did we expect?
What actually happened?
Was the decision bad, or only the result?
```

を内部評価。

User向けには簡略化してもよい。

Strategy learningのEvidenceになる。

---

# 45. Performance Boundary

Deliberative Searchは少数Candidateだけ。

候補数例:

- routine: 1–3
- meaningful: 3–8
- extreme high leverage: 5–12

Truth Match Coreを何百回もFull Simulationしない。

Manager Forecast Modelはcheap approximation。

必要ならoffline soakでForecast品質を校正する。

---

# 46. Determinism

同じ:

- world seed
- Manager state
- belief state
- observed context

ならDecision結果を再現可能にする。

RNGを使う場合もseeded。

Debugで:

- generated candidates
- forecast estimates
- objective weights
- chosen action

を記録できる。

---

# 47. Acceptance Tests

1. Same Skill + different Philosophy -> different baseball.
2. Same Skill/Philosophy + different Temperament -> different timing / commitment.
3. low-skill manager fails through plausible reasoning errors, not random stupidity.
4. high-skill manager can still lose because execution / variance remains.
5. five-infielder shift can be chosen, countered, and fail naturally.
6. perfect-game continuation and closer substitution are both rationally possible.
7. previous-day 160-pitch ace relief can occur only under extreme horizon/objective conditions.
8. squeeze can be inferred without omniscient sign reading.
9. result does not automatically determine whether the decision was good.
10. CPU explanations reveal baseball reasons, not hidden numeric buffs.
11. routine decisions remain computationally cheap.
12. strategic learning can consume Decision Memory.
13. User and CPU use the same Legal Actions.
14. Manager personality is visible in repeated decisions without becoming a direct win modifier.

---

# 48. Recommended Next Step

After this document is reviewed:

1. approve Manager Decision Engine stages
2. approve Skill / Philosophy / Temperament separation
3. approve Decision Horizon Stack
4. approve Objective Vector
5. approve two-path Fast Policy / Deliberative Search
6. then connect this Engine to Strategy Hypothesis learning in document 43


Rare tactics / psychological play / Manager Decision Log (USER REVIEW REQUIRED):
- `docs/game-design/46-manager-rare-tactics-psychological-play-and-decision-log-DRAFT.md`


---

# 49. Rare Tactical Candidate Extension

Deliberative Search may include at most one Rare Candidate generated from:

- relevant Strategy Hypothesis
- extreme Context
- high-salience opponent target
- staff / player suggestion

Rare Candidate is never random weirdness.

Psychological intent is modeled as an uncertain secondary forecast. It can help, do nothing, or backfire.

Decision Trace / user-facing log design:
- `docs/game-design/46-manager-rare-tactics-psychological-play-and-decision-log-DRAFT.md`


Manager candidate evaluation / gimmick-control design (USER REVIEW REQUIRED):
- `docs/game-design/47-manager-candidate-evaluation-and-gimmick-control-DRAFT.md`


---

# 50. Candidate Valuation Dependency

Candidate selection must use the same subjective valuation framework for ordinary and rare actions.

Important split:

```text
Candidate Admission
 !=
Candidate Selection
```

A novelty-loving manager may think of many unusual options without choosing all of them.

Detailed valuation / anti-gimmick design:
- `docs/game-design/47-manager-candidate-evaluation-and-gimmick-control-DRAFT.md`
