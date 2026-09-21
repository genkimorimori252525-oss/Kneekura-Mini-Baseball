# Manager Candidate Evaluation & Gimmick Control — ARCHIVED / SUPERSEDED

> **OLD PLAN / 旧計画 — DO NOT USE AS CURRENT DESIGN**  
> この文書は履歴・設計理由の参照用にのみ保存する。現在のSource of Truthは `docs/game-design/49-manager-architecture-v1.md`。未確定計画・実装候補として数えない。

> **Manager Architecture v1 canonical note:** This file is now **ARCHIVED DESIGN WORK**.
> Canonical Manager semantics are defined by `docs/game-design/49-manager-architecture-v1.md`.
> If this file conflicts with v1, the canonical v1 document wins.


更新日: 2026-09-20  
状態: **ARCHIVED / SUPERSEDED（旧計画）。正史ではない。実装判断・未確定計画一覧に使用しない。**

関連:
- `docs/game-design/39-manager-philosophy-and-command-architecture-DRAFT.md`
- `docs/game-design/43-manager-strategy-evolution-architecture-DRAFT.md`
- `docs/game-design/45-manager-decision-engine-and-temperament-DRAFT.md`
- `docs/game-design/46-manager-rare-tactics-psychological-play-and-decision-log-DRAFT.md`

---

# 1. Goal

Manager Decision Engineで生成された複数Candidateを、
CPU監督がどのように比較・選択するかを定義する。

同時に:

- 名采配
- 平凡な采配
- 迷采配
- 奇策
- 奇策中毒
- 慎重すぎる見送り
- 結果論による誤学習

を同じ仕組みから出す。

---

# 2. Core Rule

Candidate評価はWorld TruthではなくManager Beliefに基づく。

```text
Candidate
 + Manager Belief
 + Objectives
 + Horizon
 + Philosophy
 + Temperament
 + Skill limitations
        ↓
Subjective Candidate Value
        ↓
Decision
```

「最適Action」をGame側が先に知って選ばせない。

---

# 3. Candidate Evaluation Components

各Candidateは最低限以下で評価する。

```ts
type CandidateEvaluation = {
  immediateBaseballValue: Estimate;
  futureResourceValue: Estimate;
  healthCost: Estimate;
  rosterOpportunityCost: Estimate;
  roleSocialCost: Estimate;

  opponentResponseRisk: Estimate;
  uncertaintyCost: Estimate;
  complexityCost: Estimate;

  informationGainValue: Estimate;
  surpriseValue: Estimate;
  psychologicalValue: Estimate;
  symbolicValue: Estimate;
};
```

これらはすべてManagerの主観Estimate。

---

# 4. Immediate Baseball Value

現在の得点 / 失点期待への影響。

例:

- pinch hit
- steal
- bunt
- intentional walk
- pitcher change
- defensive alignment

ただし完全なExpected Run Tableを読むだけではない。

Player-specific BeliefとContextを使う。

---

# 5. Future Resource Value

現在のActionが後で残す資源価値。

例:

- bullpen availability
- starter availability
- bench depth
- defensive replacement
- pinch-runner availability
- next-game pitching options

Series Horizon / Season Horizonで重みが変わる。

---

# 6. Health Cost

特にPitcher workload。

```text
前日160球Aceを救援
```

のようなActionは:

- immediate baseball value may be high
- health / fatigue cost is also high

として同じ比較に入る。

---

# 7. Roster Opportunity Cost

今そのPlayer / Roleを使うことで失う後続選択肢。

例:

- backup catcherを早く使う
- only pinch runnerを消費
- long relieverを早く投入
- defensive specialistを使い切る

---

# 8. Role / Social Cost

通常は小さい。

例:

- closer roleを突然外す
- repeated unexplained lineup changes
- veteran benching

Team Mood direct debuffではなく、
Player Appraisal / Role Harmonyへの将来Cost estimate。

普通の采配では低Weight。

---

# 9. Opponent Response Risk

OpponentがActionを観測した後のCounter。

例:

```text
five infielders
 -> pinch hitter
 -> altered swing plan
```

```text
left reliever
 -> right-handed pinch hitter
```

高分析ManagerほどOpponent Responseを候補評価に入れやすい。

---

# 10. Uncertainty Cost

Estimateの不確実性そのもの。

同じ平均予測でも:

```text
Candidate A
  expected +0.2
  uncertainty low

Candidate B
  expected +0.4
  uncertainty huge
```

なら、Risk Tolerance / Temperamentによって選択が変わる。

---

# 11. Complexity Cost

複雑な作戦には実行Costがある。

例:

- complicated defensive rotation
- rare squeeze sequence
- pitcher-position switching
- novel bullpen chain

Cost inputs:

- player tactical understanding
- communication quality
- practice familiarity
- time available
- sign complexity

奇策は「珍しいから強い」ではない。

---

# 12. Information Gain Value

一部Actionは未来の判断材料を増やす。

例:

- low-stakes experiment
- new bullpen role trial
- unusual lineup test

```text
immediate value modest
+ future information value high
```

なら再建期やPreseasonで採用されやすい。

---

# 13. Surprise Value

初見のActionでOpponent Belief / preparationに不確実性を与える価値。

ただし:

```text
Surprise Value
 -> opponent uncertainty
```

のみ。

Player ability debuffではない。

繰り返し使用で急速に減る。

---

# 14. Psychological Value

OpponentのAppraisalへStimulusを与える可能性。

通常はconfidence low。

```text
unusual IBB
 -> possible disruption
 -> possible confidence boost
 -> no effect
```

を同時にForecast。

---

# 15. Symbolic Value

Rare。

例:

- championship-clinching closer
- retirement appearance
- record continuation
- player promise

Baseball valueを上書きするMagicではなくObjectiveの一部。

---

# 16. Subjective Candidate Value

概念式:

```text
Subjective Value
 =
 Baseball Value
+ Future Resource Value
+ Information Gain
+ Surprise / Psychological / Symbolic Value
- Health Cost
- Opportunity Cost
- Social Cost
- Opponent Counter Risk
- Uncertainty Cost
- Complexity Cost
```

各Weightは:

- Context
- Horizon
- Philosophy
- Temperament

で変わる。

---

# 17. Skill Does Not Add Flat Bonus

禁止:

```text
采配S
 -> Candidate Value +10
```

Skillが効くのはEstimate quality。

例:

```text
high Tactical Judgment
 -> better candidate comparison

high Analysis
 -> better uncertainty / opponent estimate

high Player Evaluation
 -> better player readiness estimate

high Operations
 -> better future resource estimate
```

---

# 18. Candidate Admission vs Candidate Selection

重要分離。

```text
Admission
= その案を候補として思いつくか

Selection
= 候補に入った後、本当に選ぶか
```

Rare Candidate好きのManagerはAdmissionが広い。

しかしSelectionでは普通のCost比較を受ける。

これにより:

```text
奇策を考える
but
普通の作戦を選ぶ
```

が多くなる。

---

# 19. Novelty Seeking

Temperament / Philosophy候補:

```text
Novelty Seeking
= 新しい / unusualな案を候補へ入れたがる傾向
```

これは能力ではない。

高Novelty:

- Rare Candidate admission threshold lowers
- more hypothesis mutation considered
- more experiment proposals

低Novelty:

- familiar policy dominates candidate generation

---

# 20. Novelty Bias

Novelty Seekingが極端で、
Analysis / calibrationが弱い場合:

```text
newness itself
 -> overvalued
```

というBiasが形成され得る。

これが「奇策中毒」の原因候補。

---

# 21. Gimmick Addiction Pattern

名前付きTraitではなくDerived failure pattern。

成立例:

```text
high Novelty Seeking
+ high Decisiveness
+ high Experimentation
+ low Analysis
+ low uncertainty calibration
+ Result Bias
        ↓
Rare Candidate over-selection
```

User / Media向けDerived descriptor候補:

- 奇策好き
- 策を弄する
- 実験過多
- 采配が落ち着かない

Label自体に効果はない。

---

# 22. One-game Comedy Is Allowed

通常はRare Candidate 0–1 / Deliberative Search。

ただしManagerごとに一試合のRare Candidate総数を固定制限しない。

極端なManagerなら:

```text
1回: unusual IBB
4回: five-infielder look
6回: unexpected double steal
8回: unconventional bullpen switch
```

のような試合も理論上可能。

ただし各回で:

- admission
- cost
- surprise decay
- opponent learning
- failed experiment memory

を通る。

したがって「奇策をやるために奇策をやる」のではなく、
そのManagerのBiasから生じる。

---

# 23. Novelty Fatigue

同一Game / Series内で奇策を繰り返すほど:

- opponent uncertainty falls
- own player complexity burden rises
- staff confidence may fall
- strategy surprise value decays

候補内部State:

```text
noveltyLoad
opponentExposure
executionComplexityLoad
```

これにより自然な抑制が働く。

---

# 24. Gimmick Self-Punishment

奇策多用に隠し罰を入れない。

普通の因果で痛い目を見る。

例:

- free baserunners
- worse field coverage
- depleted bench
- confused players
- bullpen exhaustion
- opponent counter

成功すれば本当に成功してよい。

---

# 25. Conservative Failure Pattern

逆側も必要。

```text
low Novelty
+ high Conviction
+ low Openness
        ↓
rarely considers unusual but useful action
```

例:

- never uses five-infielder alignment
- refuses opener-like deployment
- ignores novel matchup evidence

奇策嫌いにもCostがある。

---

# 26. Decision Margin

Top Candidateが僅差ならTemperamentが出やすい。

```text
large value gap
 -> even quirky manager usually picks obvious best

small value gap
 -> philosophy / temperament strongly shapes choice
```

これにより性格が「合理性を全部破壊」しない。

---

# 27. Commitment Threshold

Managerは候補差がどれだけあれば方針変更するかを持つ。

候補入力:

- conviction
- adaptation
- evidence strength
- current pressure
- past success of current policy

```text
high Conviction
 -> requires larger advantage to switch

low Conviction
 -> switches on smaller evidence
```

---

# 28. Decisiveness Threshold

Decisionをどのタイミングで確定するか。

```text
high Decisiveness
 -> commits earlier

low Decisiveness
 -> waits for more information
```

待つこと自体もActionになり得る。

---

# 29. Robustness Preference

名将が平均値だけでなく
「多少読みが外れても崩れにくい案」
を好むことがある。

候補:

```text
Expected Value
+ Robustness under belief error
```

高分析 / 高采配Managerはrobust candidateを識別しやすい。

---

# 30. Fragile Genius Tactic

逆に:

```text
if our read is exactly correct
 -> huge gain
if wrong
 -> disaster
```

というCandidateもある。

Risk-seeking / high-confidence Managerは選びやすい。

---

# 31. Counterfactual Comparison

試合後内部Reviewでは:

```text
chosen candidate
vs
other considered candidates
```

をManager Belief上で比較し直す。

World Truthで「正解」を教えない。

---

# 32. Decision Log Extension

User-facing logへ:

- considered candidates
- main expected gain
- main accepted risk
- unusualness
- confidence

を簡潔表示可能。

例:

```text
7回裏 1死三塁
内野5人

狙い
・この1点を最優先で防ぐ

受け入れたRisk
・外野の空白

監督の確信
・中

他候補
・前進守備
・敬遠
```

---

# 33. Weirdness History

Manager Careerに:

- rare tactic attempts
- success / failure
- copied tactics
- abandoned tactics

を保存。

これが将来のReputation / Philosophy driftに使える。

ただしPopularity systemとは未接続。

---

# 34. Anti-Monocausal Guard

Rare tacticsで強さを説明しすぎない。

```text
great manager
 != always unusual

ordinary-looking decision
 can be elite decision

weird manager
 != innovative genius
```

未来を先取りする監督が地味なPolicy改善を積み上げる場合もある。

---

# 35. Acceptance Tests

1. Rare Candidate can be generated without being selected.
2. unusual tactic selection uses the same cost structure as normal tactics.
3. novelty-loving manager can produce several unusual decisions in one game.
4. this happens from personality/bias, not a comedy random roll.
5. repeated unusual tactics lose surprise.
6. own players can accumulate complexity burden.
7. a conservative manager can miss valuable innovations.
8. personality matters most when candidate values are close.
9. obvious large-value decisions usually override personality quirks.
10. low skill causes bad estimates, not flat negative modifiers.
11. successful weird tactic is allowed to remain genuinely successful.
12. failed weird tactic can still remain a reasonable decision.
13. Decision Log shows accepted risks without revealing World Truth.