# Manager Architecture Adversarial Audit

更新日: 2026-09-20  
状態: **完了。Manager Architecture v1確定前の敵対監査。**

監査対象:
- `39-manager-philosophy-and-command-architecture-DRAFT.md`
- `40-manager-ratings-era-and-strategy-evolution-DRAFT.md`
- `43-manager-strategy-evolution-architecture-DRAFT.md`
- `44-manager-real-world-tactical-stress-tests-DRAFT.md`
- `45-manager-decision-engine-and-temperament-DRAFT.md`
- `46-manager-rare-tactics-psychological-play-and-decision-log-DRAFT.md`
- `47-manager-candidate-evaluation-and-gimmick-control-DRAFT.md`
- `05-psychology-emotion.md`
- `37-team-mood-architecture.md`

---

# 1. Audit Standard

設計を意図的に壊す観点で確認する。

合格条件:

1. historical caseへ専用コードを追加せず説明できる
2. opposite decisionも同じEngineから合理的に出る
3. CPUはWorld Truthを読まない
4. User / CPUは同じLegal Action Space
5. Manager能力は直接Buffにならない
6. personality / philosophy / skillが重複しない
7. long-run simulationで戦術が暴走しない
8. computation / storageがbounded
9. Decision Logが実際のDecision Traceに一致する
10. future strategyをhard-codeしない
11. failure / fad / bad managerも自然に存在できる
12. user-facing surface remains simple

---

# 2. Audit Result Summary

総合:

```text
Core causal direction          PASS
Human / CPU symmetry           PASS
No direct manager buff         PASS
Historical expressiveness      PASS
Psychology boundary            PASS with cleanup
Long-run strategy concept      PASS with guardrails

Concept duplication             FAIL -> normalization required
Candidate utility complexity    FAIL -> simplify
Rare Candidate special-case     FAIL -> remove special class
Experiment Budget abstraction   FAIL -> remove in-world budget
Public rating epistemics        FAIL -> resolve contradiction
Decision-log persistence        WARN -> bounded storage required
Meta feedback lock-in           WARN -> anti-lock-in required
Automatic invention grammar     WARN -> constrain generation
```

結論:

> **設計は捨てる必要はない。  
> ただし、追加を続ける前に概念統合と境界固定が必要。**

---

# 3. CRITICAL — Manager Top-level Concept Duplication

39では:

```text
Philosophy
Skill
Knowledge
Authority / Trust
Adaptation
```

をtop-levelとしていた。

しかし後続設計では:

- Adaptation = 公開6能力の一つ
- Knowledge = Manager Belief Stateそのもの
- Authority / Trust = manager-player relationship + communicationの結果

になっている。

このままでは二重source of truthになる。

## Resolution

Manager本体の恒久/準恒久状態を:

```text
Skill
Philosophy
Temperament
```

へ絞る。

Dynamic cognitive state:

```text
Belief State
Strategy Memory
```

External relational/context state:

```text
Manager-Player Trust
Role Legitimacy
Staff Advice
Club / Match Context
```

と分離する。

AdaptationはSkill。
KnowledgeはBelief。
Authorityはrelationship-derived state。

---

# 4. CRITICAL — Meta-style Axis Explosion

現在:

- Risk Tolerance
- Evidence Patience
- Pregame vs Adaptation
- Openness
- Experimentation Tendency
- Novelty Seeking
- Conviction
- Decisiveness
- Consultative Style
- Composure

などが近接している。

同じ「新しい作戦を試さない」を5変数で説明できてしまう。

これはcalibration不能になる。

## Resolution

Temperamentを5軸へ正規化する。

```text
Risk Appetite
Decision Pace
Policy Persistence
Novelty Appetite
Consultation Style
```

統合:

```text
Openness
+ Experimentation Tendency
+ Novelty Seeking
 -> Novelty Appetite

Evidence Patience
+ Conviction
+ plan persistence
 -> Policy Persistence

Decisiveness
 -> Decision Pace

Risk Tolerance
 -> Risk Appetite
```

Composureはv1独立軸から外す。

Pressure専用人格Systemは将来拡張。
現時点ではpressure contextがDecision Horizon / uncertainty / riskへ入る。

---

# 5. HIGH — Philosophy Contains Non-philosophy

39のPhilosophyには:

- Fastball vs Breaking
- Inside vs Outside
- Public Accountability
- Direct Intervention vs Hands-off

など、Manager tactical coreから離れる項目が混在。

Pitch-level preferencesはbattery / pitching coach / Game Planへ属する場合が多い。

Public AccountabilityはMedia system未完成。

## Resolution

v1 Manager Philosophyは主に:

- offense policy priors
- pitching usage priors
- defensive positioning priors
- roster / role priors
- evidence style

へ限定する。

Pitch selection細部、Media behavior、Social intervention styleは関連Systemへ委譲。

---

# 6. CRITICAL — Giant Scalar Utility Soup

47ではCandidate評価に約12項目:

- immediate baseball
- future resource
- health
- opportunity
- social
- opponent response
- uncertainty
- complexity
- information gain
- surprise
- psychological
- symbolic

を持つ。

全部を一つのweighted sumへ入れると:

- weight tuningが困難
- dimension同士の二重計上
- 理由不明な挙動
- emergent exploit

が起こる。

## Resolution

評価を6 channelへ統合する。

```text
A. Competitive Outcome
B. Resource / Health
C. Execution Feasibility
D. Opponent / Information Response
E. Human / Role Consequence
F. Exceptional Objective Relevance
```

さらに単一Scalarへ即変換しない。

```text
forecast distributions
 -> hard constraints
 -> dominance pruning
 -> viable frontier
 -> context-weighted comparison
 -> temperament tie-break / threshold
```

を採用。

明らかに劣る案は先に落とす。

Personalityは大差をひっくり返しにくく、
僅差で強く出る。

---

# 7. CRITICAL — Rare Candidate as Special Class

46の:

```text
Core Candidates 3–8
Rare Candidate 0–1
```

は実装上便利だが、
「普通の作戦」と「奇策」を別世界にしてしまう。

現実では内野5人も、条件次第では普通のLegal Actionの一候補。

## Resolution

`RARE_CANDIDATE` categoryをcanonical modelから削除。

全Candidateへ:

```text
noveltyDistance
familiarity
practiceFamiliarity
opponentExposure
```

等のmetadataを付ける。

Novelty AppetiteはAdmission thresholdへ作用。

したがって一試合で何度も奇策を使う監督も、
専用Rare slotなしで自然発生可能。

---

# 8. HIGH — Experiment Budget Is Too Game-like

43のExperiment Budgetは奇策乱発防止には有効だが、
「監督は今季あと3回実験できます」のようなhidden resourceになる危険がある。

## Resolution

in-world Experiment Budgetを削除。

代わりにExploration Gate:

```text
plausible competitive value
+ learning value
+ novelty appetite
- uncertainty
- execution cost
- stakes / downside
        ↓
admit experiment?
```

を使う。

Postseason等ではstakesが高いため自然にthresholdが上がる。

CPU計算量制限としてのCandidate Budgetは残すが、
これはsimulation optimizationでありManager心理ではない。

---

# 9. HIGH — Public S–G Rating vs "You Don't Know Until They Manage"

40では内部Skill -> public grade。
42ではClubもManager True Skillを知らない。

UserだけがTrue Skillを正確に見られると、
「監督はなってみるまで分からない」と矛盾する。

## Resolution

True Skill:

```text
hidden 0–100
```

User-facing S–G:

```text
Observed / Reputation Estimate
```

とする。

Established manager:
- evidence多い
- grade confidence高い

First-time manager:
- `?`
- `B?`
- range表示
- confidence低

等を許可。

Userは「だいたい分かる」がomniscientではない。

---

# 10. HIGH — Automatic Invention Can Generate Nonsense

43のlocal mutationは良いが、
Action parameterを自由変異させるだけでは:

- nonsensical policy
- impossible player role
- rule-breaking sequence
- meaningless combinatorial explosion

が出る。

## Resolution

`Tactical Grammar`を導入する。

```text
Context Predicate
+ Legal Action Primitive
+ Parameters
+ Preconditions
+ Expected causal channel
```

からCandidate Policyを生成。

Mutationは:

- threshold shift
- context narrowing / expansion
- legal action substitution
- sequencing change
- compatible rule composition

だけ。

RuleEngine / roster feasibilityを通らないPolicyは生成しない。

---

# 11. HIGH — Psychological Value Duplicates Psychology System

46でPsychological Forecastを独立System化すると、
05の:

```text
Event
 -> Appraisal
 -> EmotionPressure
 -> ActiveEmotion
```

と二重化する。

## Resolution

Manager側はOpponent Psychology Truthを持たない。

Manager Forecastは:

```text
visible stimulus
 -> estimated Appraisal distribution
```

まで。

実結果は必ず05のPlayer Psychologyが決定。

Candidate評価で`psychologicalValue`を独立Buff化しない。
Opponent / Information Response channelに不確実な予測として入れる。

---

# 12. MEDIUM — Surprise as a Separate Reward Can Be Exploited

Surpriseを独立加点すると:

```text
weird = good
```

になりやすい。

## Resolution

Surpriseはvalueそのものではなく:

- opponent forecast uncertainty
- preparation mismatch
- response latency

を一時的に変える。

Opponent exposureで自然に消える。

---

# 13. HIGH — Decision Logs Can Become Post-hoc Fiction

「監督の頭の中」UIは魅力的だが、
試合後にOutcomeから文章を作ると:

- hindsight bias
- fabricated reasons
- actual Decision Engineとの不一致

が起こる。

## Resolution

Decision時点でimmutable structured traceを保存。

```text
observed facts
belief estimates
generated candidates
rejected reasons
chosen action
accepted risks
objective/horizon tags
```

UI文章はReasonTagから生成。

自由文AI生成はsource of truthにしない。

---

# 14. MEDIUM — Full Decision Trace Storage Explosion

全Pitch / 全routine actionを永続保存すると長期Saveが膨張する。

## Resolution

3層保存:

```text
Routine
 -> aggregate / discard detailed trace

Meaningful
 -> compact trace

Key Decision
 -> full persistent trace
```

Key判定:

- leverage
- unusualness
- candidate disagreement
- major opponent response
- large learning update
- championship / milestone

---

# 15. HIGH — Meta Can Self-lock

Metaが:

```text
current policy distribution
 -> new manager prior
 -> same policies
 -> stronger meta
```

だけだと自己固定する。

## Resolution

Metaはinitial priorのみ。

脱出経路を必須化:

- counter evidence
- independent rediscovery
- new player population
- rule change
- technology change
- staff movement
- novel hypothesis generation

Meta自体はAction Valueへ直接Buffしない。

---

# 16. MEDIUM — Coaching Tree Can Become Skill Inheritance

Idea Lineageは良いが、
mentorからexact strong policy + confidenceまでコピーすると
弟子が自動的に強くなる。

## Resolution

Transfer対象:

- priors
- known candidate forms
- terminology
- practice routines
- hypothesis seeds

Transferしない:

- Skill
- calibrated confidence
- exact player-specific beliefs

弟子は自分のEvidenceで再評価する。

---

# 17. MEDIUM — "Manager Personality" Can Become Hidden Overall Skill

Composure / openness / decisiveness等が全部
「高い方が良い」設計になる危険。

## Resolution

Temperament axesを価値中立にする。

例:

```text
Quick decision
 -> acts before opportunity disappears
 -> premature commitment risk

Deliberative
 -> better evidence usage
 -> may act too late
```

どちらにもtradeoffを要求。

---

# 18. MEDIUM — Manager-specific Historical Overfit

Stress testsは有用だが、
歴史上のEpisodeごとに:

- symbolic objective
- psychological objective
- weird action tag

を増やし続けると過学習する。

## Resolution

新しい史実例を追加する時:

> **既存Primitive / Context / Objective / Information channelで説明できるか**

を先に確認。

説明不能なら:
1. 既存概念の一般化で解決できるか
2. 複数事例へ適用可能か
3. それでも必要なら新概念

の順。

一事例だけのための新stateは禁止。

---

# 19. PASS — Human / CPU Symmetry

現設計は:

- same legal actions
- no CPU hidden Truth
- no user decision override
- same Match Core

を維持。

この原則はfreezeしてよい。

---

# 20. PASS — No Direct Manager Buff

現設計は:

```text
Manager quality
 -> better belief / candidate / timing / communication
 -> player action
 -> Match Core
```

を維持。

freeze可能。

---

# 21. PASS — Historical Bidirectionality

山井続投 / 岩瀬投入、
内野5人 / 通常守備、
Ace emergency relief / 温存

の両側を同じEngineで説明可能。

この性質をAcceptance Testへ固定する。

---

# 22. PASS — Decision Quality != Outcome

現設計は:

```text
good decision + bad result
bad decision + good result
```

を許容。

Strategy Learningに不可欠。

freeze可能。

---

# 23. PASS — Emergent Future Direction

Future baseballをhard-codeせず:

```text
rules
+ information technology
+ player population
+ strategy knowledge
+ counterplay
```

から変化させる方向は妥当。

ただしTactical Grammar + bounded hypothesis countが必要。

---

# 24. Canonical Normalization Decision

監査後のManager v1は:

```text
STATIC / SLOW
  Skill
  Philosophy
  Temperament

DYNAMIC
  Belief State
  Strategy Memory

EXTERNAL
  Legal Rules
  Staff Advice
  Manager-Player Relationships
  Match / Series / Season Context
```

とする。

---

# 25. Final Temperament v1

```text
Risk Appetite
Decision Pace
Policy Persistence
Novelty Appetite
Consultation Style
```

v1ではこれ以上増やさない。

Pressure-specific personalityはfuture extension。

---

# 26. Final Decision Evaluation v1

```text
1. Legal / feasibility filter
2. Candidate admission
3. Forecast distributions
4. Hard constraint check
5. Dominance pruning
6. Context / horizon comparison
7. Temperament-sensitive near-tie decision
8. Instruction / execution
9. Trace / evidence update
```

---

# 27. Final Strategy Learning v1

```text
Observed anomaly / staff idea / opponent pattern
 -> Tactical Grammar candidate
 -> Hypothesis
 -> limited real use when Exploration Gate passes
 -> evidence
 -> promote / revise / discard
```

No Experiment Budget.
No Random Genius.
No Rare Candidate class.

---

# 28. Final Decision Log v1

Decision Log is:

> **actual structured decision trace presented to the user**

not narrative invention.

Full opponent trace:
- postgame optional Research View
- no exact hidden World Truth
- no debug-only values

Developer Debug may expose Truth comparison separately.

---

# 29. Long-run Required Soak Tests

Before implementation is considered validated:

- 10 seasons
- 50 seasons
- 100+ seasons

for multiple seeds.

Measure:

- tactical diversity
- manager identity stability
- rare tactic frequency
- policy convergence
- strategy extinction / rediscovery
- bullpen usage
- starter usage
- steal / bunt rates
- lineup churn
- defensive-shift frequency
- manager skill-result correlation
- roster-strength-result correlation
- meta turnover
- CPU compute cost
- Decision Log storage growth

Failure if:

- one strategy permanently dominates across contexts
- every manager converges to same style
- novelty managers spam tactics without causal cost
- conservative managers never innovate at all
- manager rating overwhelms roster quality
- psychology becomes common hidden buff
- storage / compute grows unbounded

---

# 30. Audit Verdict

**APPROVE AFTER NORMALIZATION.**

The architecture is strong enough to freeze as Manager Architecture v1 after applying this audit.

Main design survives.

Removed / collapsed:
- separate top-level Adaptation
- separate top-level Knowledge
- Authority as personal manager stat
- Openness / Experimentation / Novelty duplication
- Composure as v1 axis
- giant 12-term scalar utility
- Rare Candidate special class
- in-world Experiment Budget
- standalone Surprise reward
- standalone psychological buff value

Preserved:
- public six manager skill dimensions
- philosophy separate from skill
- temperament
- bounded rationality
- Manager Belief
- Strategy Hypothesis
- historical stress tests
- tactical invention / diffusion / meta evolution
- coaching lineage
- rare unusual decisions
- structured Decision Logs
- Human / CPU symmetry
- no direct manager buffs
