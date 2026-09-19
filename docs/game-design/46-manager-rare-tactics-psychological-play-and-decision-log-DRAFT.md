# Manager Rare Tactics, Psychological Play & Decision Log — DRAFT

更新日: 2026-09-20  
状態: **設計候補。USER REVIEW REQUIRED。実装前。**

関連:
- `docs/game-design/05-psychology-emotion.md`
- `docs/game-design/39-manager-philosophy-and-command-architecture-DRAFT.md`
- `docs/game-design/43-manager-strategy-evolution-architecture-DRAFT.md`
- `docs/game-design/44-manager-real-world-tactical-stress-tests-DRAFT.md`
- `docs/game-design/45-manager-decision-engine-and-temperament-DRAFT.md`

---

# 1. Design Goal

現実の野球には、通常のRun Expectancyだけでは説明しきれない采配が存在する。

例:

- unusual intentional walk
- extreme defensive alignment
- unexpected squeeze / double steal
- star-targeted matchup
- decoy bullpen action
- symbolic closer usage
- deliberate disruption of opponent routine

Mini Baseballでは、これらをNamed EventやRandom Weirdnessではなく、
同じManager Decision EngineからRare Candidateとして生成可能にする。

---

# 2. Historical Motif — 王貞治 vs イチロー

公開対談でイチロー本人は、BlueWave時代に王監督率いるHawksから
「1回表から敬遠された」記憶を王本人へ尋ねている。

王は、その狙いを概ね:

> イチローの心が折れなくても、平常心でなくなればこちらは得

という趣旨で説明している。

このMotifが要求するもの:

```text
Intentional Walk
= only run-expectancy action
```

では足りない。

必要:

```text
Baseball consequence
+ psychological / information consequence
+ uncertainty
+ player-specific appraisal
```

---

# 3. Psychological Action Boundary

監督はOpponentのEmotionを直接変更できない。

禁止:

```text
敬遠
 -> opponent Focus -20
```

正しい方向:

```text
unusual visible decision
        ↓
Opponent observes event
        ↓
Opponent Appraisal
        ↓
EmotionPressure
        ↓
if threshold crossed:
ActiveEmotion
        ↓
behavior / execution
```

既存Psychology architectureをそのまま使う。

---

# 4. Psychological Targeting is a Gamble

同じ奇策でもPlayerごとに反応が違う。

例:

```text
unusual intentional walk
        ↓
Player A:
  irritation -> impatience

Player B:
  confidence -> "they fear me"

Player C:
  no meaningful reaction

Player D:
  caution -> overthinking
```

ManagerはOpponent True Appraisalを知らない。

Belief / scouting / reputationから推定するだけ。

---

# 5. Psychological Forecast

Manager Forecastにoptional channelを追加。

```ts
type PsychologicalForecast = {
  targetPersonId: PersonId;
  possibleStimuli: readonly PsychologicalStimulus[];
  expectedDirection: "POSITIVE" | "NEGATIVE" | "MIXED" | "UNKNOWN";
  confidence: number;
  downsideRisk: number;
};
```

confidenceは通常低め。

心理狙いだけで大きな確信を持つのは禁止。

---

# 6. Secondary Tactical Effects

Action評価には、Primary Baseball Effect以外も持てる。

候補:

- PSYCHOLOGICAL_DISRUPTION
- INFORMATION_GAIN
- SIGNALING
- SURPRISE
- TEMPO_CONTROL
- ROLE_REINFORCEMENT
- SYMBOLIC_VALUE

これらは追加Buffではなく、World内の情報 / Appraisal / role stateへ接続する。

---

# 7. Example — Unusual Intentional Walk

```text
Context:
  elite hitter
  early inning
  low immediate leverage
  manager believes normal approach gives batter rhythm
  manager is willing to pay baserunner cost

Candidates:
  normal attack
  careful pitching
  intentional walk

Immediate baseball forecast:
  IBB costs a free baserunner

Secondary hypothesis:
  unusual treatment may disturb batter routine / expectation

Psychological confidence:
  low

Temperament:
  high decisiveness
  high conviction
  willingness to use unconventional option

Decision:
  intentional walk may be selected
```

結果:

- batter may be disrupted
- batter may become more focused
- no effect may occur
- free baserunner may score

すべて合法。

---

# 8. Rare Candidate Gate

奇策を毎試合出さない。

Rare Candidateを候補に入れる条件候補:

```text
relevant Strategy Hypothesis exists
OR
extreme context creates obvious unusual option
OR
high-salience opponent target
OR
staff / player suggestion introduces option
```

さらに:

- action must be legal
- action must be physically feasible
- manager must know / imagine the option
- complexity cost applies
- uncertainty is explicit

---

# 9. Rare Candidate Slot

Deliberative Search時のみ、

```text
Core Candidates: 3–8
Rare Candidate: 0–1
```

程度を上限候補とする。

これにより奇策が埋もれず、
同時に「奇策祭り」も防ぐ。

---

# 10. No Random Weirdness

禁止:

```text
5% chance:
Manager does something crazy
```

必要:

```text
belief
+ objective
+ temperament
+ tactical hypothesis
+ context
        ↓
unusual but explainable action
```

奇抜でも後から理由を説明できなければならない。

---

# 11. Surprise Value

Unusual Strategyには一時的なSurprise Valueがあり得る。

ただし:

```text
surprise
 != ability debuff
```

相手の:

- candidate generation
- preparation
- reaction timing
- belief uncertainty

へ作用する。

繰り返すほどOpponent learnsし、Surpriseは減る。

---

# 12. Surprise Decay

```text
first exposure
 -> high uncertainty

repeated exposure
 -> scouting evidence increases
 -> candidate response improves
 -> surprise edge decays
```

これにより奇策の乱用を自然に防ぐ。

---

# 13. Psychological Backfire

心理狙いは逆効果もあり得る。

```text
Manager intent:
  intimidate / disrupt

Opponent appraisal:
  "they fear me"
        ↓
positive ActiveEmotion candidate
```

Managerが相手の心理を完全制御できないことを守る。

---

# 14. Personality Connection

Rare tactic frequencyはSkillだけでは決まらない。

候補:

```text
Openness
+ Decisiveness
+ Risk Tolerance
+ Experimentation Tendency
+ Conviction
+ Strategy Hypothesis
```

同じ分析Sでも:

- conservative genius
- daring genius

が成立する。

---

# 15. Information Warfare

采配Actionは相手へ情報を見せる。

例:

- bullpen warmup
- defensive alignment
- repeated intentional walk
- pinch hitter preparation
- runner lead
- bunt stance

Managerは:

```text
What will opponent infer?
```

もForecastできる。

---

# 16. Deceptive Signaling

一部Actionは意図的に誤ったSignalを送れる。

候補:

- fake bunt
- decoy bullpen warmup
- temporary defensive disguise
- steal threat without actual green light

ただしRule / feasibilityに従う。

Opponentは観察から推定するだけ。

---

# 17. Manager Decision Trace

全CPU Decisionについて、内部的にTraceを保存可能にする。

```ts
type ManagerDecisionTrace = {
  decisionId: DecisionId;
  gameTime: MatchTime;

  trigger: DecisionTrigger;
  observedContext: ObservedContextSummary;

  beliefSnapshot: BeliefSnapshotRef;
  uncertaintySummary: UncertaintySummary;

  generatedCandidates: readonly CandidateTrace[];
  chosenAction: TacticalAction;

  objectiveSnapshot: ObjectiveSnapshot;
  horizonSnapshot: HorizonSnapshot;

  philosophyInfluence: readonly InfluenceTag[];
  temperamentInfluence: readonly InfluenceTag[];

  instructionTrace?: InstructionTrace;

  predictedOutcome: EffectEstimate;
  observedOutcome?: OutcomeSummary;

  opponentResponse?: TacticalAction;
  learningUpdate?: LearningUpdateSummary;
};
```

---

# 18. Candidate Trace

各候補について最低限:

```ts
type CandidateTrace = {
  action: TacticalAction;
  generatedBy:
    | "DEFAULT_POLICY"
    | "GAME_PLAN"
    | "STAFF_SUGGESTION"
    | "STRATEGY_HYPOTHESIS"
    | "EMERGENCY"
    | "RARE_CANDIDATE";

  expectedBenefits: readonly ReasonTag[];
  expectedCosts: readonly ReasonTag[];
  uncertainty: number;

  rejectedReason?: ReasonTag;
};
```

---

# 19. User-facing Decision Log — Simple View

通常のUser向けには内部数値を見せない。

例:

```text
8回表 1死一塁
投手交代: A → B

監督の判断
・Aは3巡目に入った
・球数が増えている
・次打者との相性をBの方が高く評価
・Bは前日休養

見送った案
・A続投
  理由: 終盤の失点Riskを高く見た
```

---

# 20. Rare Decision Log Example

```text
1回表
打者: League屈指の主力

采配: 敬遠

監督の判断
・通常勝負では相手にリズムを与えると懸念
・あえて異例の対応を見せる案を検討
・心理的効果への確信は低い
・走者を与えるRiskは承知

狙い
「相手の平常心を揺らせれば利益」

結果
・打者の反応: 監督には完全には分からない
・走者一塁
```

Psychology Truthは表示しない。

---

# 21. Head-inside Mode

Optional advanced view:

> **監督思考ログ**

を用意する。

表示候補:

- 何を見たか
- 何を知らなかったか
- 候補に何を考えたか
- 何を恐れたか
- どの時間軸を重視したか
- なぜ決めたか
- 結果をどう評価したか

これはUserがCPU Managerから学習できる主要機能。

---

# 22. Live Information Boundary

相手監督の完全Thought Logを試合中に見せると、
Fog of Warを破壊する。

推奨:

## Own Team
Userが指揮しているため、AI補助 / Staff recommendationのみLive表示可能。

## Opponent CPU
試合中:
- visible action
- simple external explanation only

試合後:
- full Decision Log unlock

Optional:
- Spectator / Research ModeならLive full trace

---

# 23. Postgame Review

試合後に重要Decisionだけを抽出。

```text
KEY MANAGER DECISIONS

3回:
盗塁見送り

6回:
代打A

8回:
5人内野

9回:
CloserではなくSetup B
```

各Decisionを開くとThought Logを閲覧。

---

# 24. Decision Importance Score

全采配Logを並べると多すぎる。

ImportanceをDerived。

候補入力:

- leverage
- unusualness
- candidate disagreement
- large forecast spread
- major opponent response
- milestone / championship
- strong learning update

上位だけPostgameへ出す。

---

# 25. Decision Quality vs Result

Postgame Logは:

```text
Result: success / failure
Decision evaluation: separate
```

とする。

例:

```text
Decision:
  good according to manager belief

Outcome:
  HR allowed

Learning:
  hypothesis confidence almost unchanged
```

Result Biasを持つManagerならconfidenceを過剰に下げる場合もある。

---

# 26. No Omniscient Retrospective

Decision Logは
「本当は正解だったAction」
を表示しない。

表示するのは:

- Managerが何を信じていたか
- 何を予測したか
- どう学習したか

だけ。

Truthとの差はDebug / Developer modeのみ。

---

# 27. Manager Personality Through Logs

Log文章の内容はPersonalityを反映してよい。

ただし文学的な自由文生成をSource of Truthにしない。

内部ReasonTag例:

- PROTECT_ONE_RUN
- TRUST_VETERAN
- AVOID_OVERREACTION
- TRY_SURPRISE
- PRESERVE_BULLPEN
- CHALLENGE_STAR
- FOLLOW_STAFF_ADVICE
- STICK_TO_PLAN

UI文章はReasonTagから生成。

---

# 28. Example Personality Contrast

同じSituation:

```text
7回 1点リード
先発 95球
次打者は3巡目
```

Manager A:

```text
・3巡目Riskを重視
・Reliever休養十分
・迷わず交代
```

Manager B:

```text
・先発の今日の球威を高評価
・勝負所を本人に任せる
・もう1人を見る
```

どちらも合法。

その後の結果で初めてHistoryができる。

---

# 29. Decision Log as Learning Surface

UserはCPU監督のLogから:

- leverage thinking
- matchup weighting
- unusual tactics
- series resource planning
- opponent-response awareness

を学べる。

Design Goal:

> **強いCPU監督を観察し、その考え方を理解して真似すると、実際の采配も改善し得る。**

をUI上でも実現する。

---

# 30. Historical Narrative Generation

Save HistoryではDecision Traceから後世のNarrativeを生成可能。

例:

```text
2048 Championship Series Game 7
Manager X used five infielders in the 9th.

At the time:
- one run ended the season
- outfield hit was already close to fatal
- X accepted the uncovered-field risk
```

後世Label:
- 名采配
- 奇策
- 迷采配

はOutcome / later evaluationからDerived。

---

# 31. Acceptance Tests

1. unusual intentional walk can occur without a scripted historical event.
2. psychological targeting never directly debuffs a batter.
3. same psychological tactic can help, fail, or backfire.
4. rare tactics remain rare.
5. repeated trick loses surprise as opponents learn.
6. CPU can explain why it chose an unusual action.
7. opponent full thought process is not leaked live by default.
8. postgame user can inspect important CPU decisions.
9. logs separate Manager Belief from World Truth.
10. decision quality is not equal to outcome.
11. personality is legible from repeated decisions and logs.
12. user can learn real tactical reasoning from CPU logs.
