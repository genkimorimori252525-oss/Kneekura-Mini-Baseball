# Manager Ratings, Era Context & Strategy Evolution — DRAFT

> **Manager Architecture v1 canonical note:** This file is now **ARCHIVED DESIGN WORK**.
> Canonical Manager semantics are defined by `docs/game-design/49-manager-architecture-v1.md`.
> If this file conflicts with v1, the canonical v1 document wins.


更新日: 2026-09-20  
状態: **設計候補。USER REVIEW REQUIRED。実装前。**

関連:
- `docs/game-design/01-manager-experience.md`
- `docs/game-design/31-scouting-recruitment-system.md`
- `docs/game-design/37-team-mood-architecture.md`
- `docs/game-design/39-manager-philosophy-and-command-architecture-DRAFT.md`

---

# 1. Design Goal

CPU監督をユーザーが一目で理解できるようにする。

同時に内部では:

- 時代ごとの野球観
- Manager固有の思想
- 情報量の差
- 戦術学習
- 新戦術の発見
- League全体への戦術拡散
- Counter-strategy

まで扱える構造を目標とする。

最重要原則:

> **公開表示はシンプル。監督の思考Simulationは深く。**

---

# 2. Public Manager Ratings — 6 Axes

CPU監督の公開能力は6項目に絞る。

```text
采配   Tactical Judgment
分析   Analysis
適応   Adaptation
選手眼 Player Evaluation
運用   Roster / Workload Management
統率   Leadership / Communication
```

内部値は0–100。

公開表示はPlayer Ratingと同じS–G。

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

UI例:

```text
監督: A

采配 A
分析 S
適応 B
選手眼 A
運用 B
統率 C

主な野球観
・データ重視
・早め継投
・左右運用
・流動打順
・若手を試す
```

RatingとPhilosophyを同じ欄に混ぜない。

---

# 3. Public Rating Meaning

## 3.1 采配

「どの野球が好きか」ではなく、
**現在持っている情報から局面Actionを評価し、適切なTimingで選ぶ能力**。

内部候補:

- gameReading
- action consequence estimation
- substitution timing
- tactical timing

盗塁重視 / 完投重視などのPhilosophyとは別。

---

## 3.2 分析

データ / Scouting / Opponent evidenceから有用なSignalを抽出する能力。

内部候補:

- statistical reasoning
- uncertainty handling
- opponent modeling
- pattern extraction
- data-to-plan translation

Data重視だから分析Sとは限らない。

```text
Data-heavy + Analysis D
 -> 数字を大量に見るが読み違える

Intuition-heavy + Analysis A
 -> 少ない情報から有用なPatternを拾える
```

---

## 3.3 適応

新しいEvidenceへPlanを修正する能力。

内部候補:

- in-game adjustment
- series adjustment
- season learning
- counter-strategy response
- failed-hypothesis abandonment

「臨機応変」というPhilosophy傾向と能力は分離。

---

## 3.4 選手眼

Playerの現在状態 / Role Fit / Readinessを観測情報から推定する能力。

内部候補:

- readiness evaluation
- role fit
- position fit
- fatigue recognition
- skill-change recognition

Hidden True Abilityを直接読む能力ではない。

---

## 3.5 運用

Roster / Pitching Staff / Fatigue / Playing Timeを持続可能に運用する能力。

内部候補:

- starter workload
- bullpen availability
- rest planning
- call-up timing
- roster continuity
- role stability management

「完投重視」「一軍二軍入替活発」等はPhilosophy。

運用Sでも完投型は成立する。

---

## 3.6 統率

指示を理解・納得可能な形で伝え、人をまとめる能力。

内部候補:

- communication
- role explanation
- leadership credibility
- conflict mediation
- trust repair

Team Moodを直接上げない。

PlayerがManager decisionをどうAppraiseするかへ作用する。

---

# 4. No Overall Rating

監督総合S / 92点のようなOverall Ratingは原則作らない。

理由:

異なるRoster / Era / Opponent環境で強みが変わるため。

```text
Analysis S
Adaptation S
Leadership D
```

のような歪な名将も成立させる。

---

# 5. Philosophy Remains Independent

Ratingは「性能」。

Philosophyは「考え方」。

例:

```text
Manager A
采配 A
分析 C

盗塁重視
固定打順
完投重視

Manager B
采配 A
分析 S

盗塁軽視
流動打順
早め継投
```

両者とも強い可能性がある。

---

# 6. Era is Context, not Ability

昭和 / 平成 / 令和をManager Ability modifierにしない。

禁止:

```text
昭和監督
 -> Analysis -20

令和監督
 -> Analysis +20
```

Eraが変えるのは**環境とKnowledge Frontier**。

候補:

- available statistics
- video / tracking technology
- scouting infrastructure
- medical / fatigue knowledge
- roster rules
- pitching rules
- substitution rules
- ball / stadium environment
- league talent distribution
- common tactical priors
- staff specialization
- communication technology

同じ能力のManagerでも、利用可能な情報が違えばDecisionは変わる。

---

# 7. Manager Era Prior

ManagerはCareer開始時に、その時代のBaseball Common SenseをPriorとして持つ。

```text
Era / League Meta
        ↓
initial tactical priors
        ↓
personal philosophy
        ↓
career experience
        ↓
individual manager
```

ただしEra Priorを強制しない。

時代を先取りするManagerも、
現代に古い考えを強く持つManagerも成立可能。

---

# 8. Example Era Tendencies — Seed, not Rule

固定ClassではなくInitial Distributionの例。

## Earlier / traditional environments

出やすいPrior候補:

- starter lengthを長く見る
- stable batting order
- sacrifice / productive outを高く評価
- veteran trust
- observation / experience-heavy decisions
- small specialized staff

## Data expansion era

出やすいPrior候補:

- matchup reports
- opponent tendencies
- platoon usage
- specialized bullpen roles
- formal pregame meetings
- evidence-based positioning

## Tracking / modern era

出やすいPrior候補:

- granular batted-ball / pitch data
- workload monitoring
- flexible bullpen
- defensive positioning models
- player-specific plan
- probability / uncertainty aware decisions

## Future eras

Hard-codeしない。

Simulation内のManager / Staffが新しいStrategyを発見し、
League Metaそのものを変えられる。

---

# 9. Strategy Must Be Built from Primitives

未来戦術を事前に全部名前付きで実装するのは不可能。

したがって戦術はAtomic Decisionから構成する。

候補Primitive:

- lineup ordering
- batter approach prior
- runner aggression
- steal threshold
- bunt / hit-and-run
- pitcher role assignment
- starter pull threshold
- reliever entry timing
- matchup weighting
- pitch-family preference
- field positioning
- substitution timing
- call-up / demotion threshold
- rest allocation

新戦術とは、これらの**新しい組み合わせ / 条件Policy**。

---

# 10. Strategy Hypothesis

CPU Managerは戦術を「決め打ちClass」ではなくHypothesisとして保持できる。

```ts
type StrategyHypothesis = {
  contextPattern: TacticalContextPattern;
  preferredActions: readonly WeightedAction[];
  expectedEffects: ExpectedEffectModel;
  evidenceStrength: number;
  uncertainty: number;
  lastTestedAt: SeasonTime;
};
```

例:

```text
Context:
  相手上位打線が初回に集中
  自軍に短いイニングで強いReliever
  Bulk Pitcherがいる

Hypothesis:
  初回だけReliever
  -> その後Bulk Pitcher
```

これを特別な「オープナーTrait」にしない。

Atomic Policyの組み合わせとして成立させる。

---

# 11. Strategic Exploration

CPU Managerは既知のStrategyだけを永久反復しない。

探索量は:

```text
experimentation tendency
+ risk tolerance
+ Analysis
+ Adaptation
+ current roster fit
+ organizational freedom
```

から決まる。

重要:

`experimentation tendency` はPhilosophyであり能力ではない。

奇抜なことをするほど優秀、にはしない。

---

# 12. Innovation Lifecycle

```text
1. Anomaly / Opportunity detected
2. New hypothesis formed
3. Small experiment
4. Evidence accumulation
5. Manager belief updates
6. Repeat if useful
7. Opponents observe
8. Other staffs imitate / modify
9. Counter-strategy appears
10. League Meta changes
```

これによりSave内でBaseball Historyが進化する。

---

# 13. Ahead-of-the-Time Manager

未来を先取りするManagerはSpecial Buffではない。

条件例:

```text
high Analysis
+ high Adaptation
+ willingness to experiment
+ correct causal hypothesis
+ roster capable of executing it
+ organizational permission
        ↓
unusual policy
        ↓
actual advantage
```

成功しなければただの奇策で終わる。

成功し続ければ他Clubが模倣し始める。

---

# 14. Strategy Diffusion

他CPUは勝者のPhilosophyを即コピーしない。

Observation / imitation speed候補:

- Analysis
- staff network
- scouting / analyst quality
- openness to outside ideas
- risk tolerance
- competitive pressure
- visible sample size

```text
innovator
 -> early adopters
 -> broader league adoption
 -> normal tactic
```

という歴史が自然発生可能。

---

# 15. Coaching Tree / Idea Lineage

Manager / Coach間でIdeaが伝わる。

候補:

- former assistant becomes manager
- former player becomes coach
- staff poaching
- league seminar / scouting exchange
- shared organization history

```text
Manager A
 -> Coach B learns tactical priors
 -> B becomes Manager elsewhere
 -> modifies idea
```

これにより「○○系統」の野球思想をGame World内で形成できる。

思想はコピーされてもSkillはコピーされない。

---

# 16. Meta is Emergent

Leagueに固定の「正解戦術」を置かない。

```text
rules
+ player population
+ roster economics
+ ballpark
+ current common strategies
+ counter-strategies
        ↓
current Meta
```

Metaが変われば同じStrategyの価値も変わる。

---

# 17. Copying the Best Manager

重要なDesign Goal:

> Game内の強いManagerの考え方をUserが観察して真似した時、因果的に優れたStrategyなら本当に改善し得る。

ただし:

```text
copy policy
 != copy success
```

必要:

- suitable roster
- sufficient information
- player understanding
- correct context
- opponent has not fully countered it
- enough execution quality

したがって「最強監督Preset」を選べば勝つゲームにはしない。

---

# 18. Strategy Edge Decay

革新的戦術は永久に強くない。

```text
new strategy
 -> advantage
 -> opponents collect evidence
 -> imitation / counter
 -> player market adapts
 -> advantage shrinks
```

必要なら新しいInnovationへ進む。

これにより300-year SaveでもMetaが停止しない。

---

# 19. Historical Motif Compatibility

このArchitectureは実在野球の異なる思想を同じSystemで表現可能。

例として:

- sacrificeを嫌い、pitching / defense / multi-run offenseを重視する型
- speed / defense / bullpenをBallparkへ合わせる型
- batter-pitcher matchupとreliever specializationを細かく使う型
- opponent data / scouting report / observationを徹底する型
- starter / relieverという既存Roleを崩し、opener + bulkという新しい順序を試す型

これらを固有BuffではなくPhilosophy + Knowledge + Skill + Roster Fitから表現する。

---

# 20. Historical Era Reconstruction Test

設計検証として、過去EraのLeagueを再現した時:

- 当時一般的なPriorが多く出る
- それでも時代を先取りするManagerが少数出る
- 新戦術が成功すると他Clubへ徐々に拡散する
- 当時利用できないDataをManagerが魔法的に読むことはない
- 現代Managerを過去へ置いても、利用できないTechnology情報は得られない
- ただしAnalysis SkillやPhilosophyによって当時の情報から新しい結論へ到達する余地はある

を満たす。

---

# 21. Future Baseball Test

未来Eraを事前に脚本化しない。

成功条件:

```text
same rules + changed player population
or
new rules + new information tools
or
new roster economics
        ↓
Managers search strategy space
        ↓
new stable tactics may emerge
```

Game Designerが「2100年野球」を全部決めなくてもよい構造を目標とする。

---

# 22. Public UI — Simple Surface

監督詳細の通常画面:

```text
監督プロフィール

能力
采配 A   分析 S   適応 B
選手眼 A 運用 B   統率 C

野球観
出塁重視 / 早め継投 / 流動打順
データ重視 / 若手やや積極

最近の特徴
・対左投手で打線変更が多い
・先発3巡目で継投する傾向
・守備位置を相手ごとに変更
```

ユーザーは内部Policy weightを読む必要がない。

---

# 23. Deep Optional View

興味があるUserだけ:

- batting-order stability
- steal attempt tendency
- starter pull threshold
- platoon intensity
- shift aggressiveness
- data weight
- recency weight
- youth preference
- risk tolerance
- experimentation tendency

などを見る。

「一見シンプルだが、奥深い」を守る。

---

# 24. Rank Projection Contract

S–G表示は内部Skillのprojection。

```text
Internal Manager Skill
 -> public grade
```

Grade自体からBuffを再加算しない。

禁止:

```text
采配S
 -> win probability +10%
```

---

# 25. Manager Growth

Manager Skill / PhilosophyはCareer中に変わり得る。

Skill growth候補:

- experience
- high-quality staff
- review / learning
- repeated relevant situations

Skill decline候補:

- no automatic age penalty
- outdated belief persistence
- failure to adapt to new environment

Philosophy drift:

- slow
- evidence-driven
- staff / mentor influence
- success / failure history

---

# 26. Anti-Monocausal Rule

革新的ManagerだけでDynastyを説明しない。

```text
Manager strategy
+ roster fit
+ organization
+ scouting
+ development
+ health
+ player execution
+ opponents
+ variance
        ↓
results
```

「未来を先取りした監督」は強みになれるが、魔法ではない。

---

# 27. Acceptance Tests

1. Two managers with identical public Skill grades but different Philosophy produce visibly different baseball.
2. Two managers with same Philosophy but different Skills execute it with different quality.
3. A Data-heavy manager can be bad at Analysis.
4. An Intuition-heavy manager can be excellent.
5. Old-era managers are not inherently weaker.
6. Ahead-of-time managers can emerge before a tactic is league-standard.
7. Successful innovation diffuses gradually rather than instantly.
8. Once opponents adapt, an old innovation loses some edge.
9. User can imitate a successful CPU policy and gain a real causal advantage when context fits.
10. Copying the policy without roster fit can fail.
11. CPU and User share the same legal tactical actions.
12. Public S–G ratings remain understandable without exposing all internal weights.
13. No Manager grade directly modifies player raw ability or win probability.
14. Future-century tactics can emerge from existing primitives without hard-coded historical labels.

---

# 28. Review Questions

1. 公開Manager Abilityを6軸で正式採用するか
2. S–G境界をPlayer Ratingsと統一するか
3. EraをAbilityではなくKnowledge / Rules / Meta Contextとして扱うか
4. Strategy Hypothesis + exploration modelを採用するか
5. Coaching Tree / Idea Lineageまで入れるか
6. League Meta diffusion / counter-adaptationを採用するか
7. 「強いCPU監督の真似が本当に効く」ことをAcceptance Testにするか


---

# 29. User-approved Rating Direction — 2026-09-20

公開Manager Abilityは、現時点で以下6軸を採用方向とする。

- 采配
- 分析
- 適応
- 選手眼
- 運用
- 統率

表示はS–G。

Overall Ratingは原則作らない。

重要追加:

- D / E / F / G級の弱いManagerも存在可能。
- Manager職は能力保証ではない。
- Philosophyが優れていてもSkillが低ければ実行に失敗し得る。
- 逆にSkillが高くてもRoster / Era / Contextへ合わなければ成果は限定される。

Manager hiringの不完全性は `41-manager-appointment-and-incompetence-DRAFT.md` で設計する。


Detailed emergent strategy architecture (USER REVIEW REQUIRED):
- `docs/game-design/43-manager-strategy-evolution-architecture-DRAFT.md`
