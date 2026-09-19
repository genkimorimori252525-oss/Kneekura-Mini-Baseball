# Manager Market & Front Office Selection — DRAFT

更新日: 2026-09-20  
状態: **設計候補。USER REVIEW REQUIRED。実装前。**

関連:
- `docs/game-design/31-scouting-recruitment-system.md`
- `docs/game-design/39-manager-philosophy-and-command-architecture-DRAFT.md`
- `docs/game-design/40-manager-ratings-era-and-strategy-evolution-DRAFT.md`
- `docs/game-design/41-manager-appointment-and-incompetence-DRAFT.md`
- `docs/game-design/19-club-structural-dominance-and-decline.md`

---

# 1. Core Separation

監督の「能力」と「採用される理由」を分ける。

```text
Manager True Skill
 !=
Manager Hiring Value
```

ClubはManager True Skillを直接読めない。

採用は:

```text
candidate reputation
+ known career history
+ club relationship
+ interview impression
+ tactical fit
+ staff fit
+ cost
+ availability
+ ownership preference
+ front-office estimate
        ↓
Hiring Decision
```

で決まる。

---

# 2. Why Becoming Manager Does Not Prove Competence

監督能力はHead Manager就任後に初めて露呈する部分が多い。

例:

- bullpen timing
- crisis adaptation
- role-management under pressure
- losing-streak response
- star conflict handling
- season-long workload management
- information filtering
- tactical hypothesis quality

Coach / Player時代の実績から完全には推定できない。

したがって:

> **監督は、なってみるまで分からない部分が大きい。**

をSystemとして許可する。

---

# 3. Candidate Backgrounds

Manager Candidateは複数Career Pathから出る。

## Club OB

- franchise icon
- ordinary former player
- long-tenure role player
- former captain
- former catcher / field leader
- former coach

利点:
- club familiarity
- supporter acceptance
- internal trust
- cultural continuity

Risk:
- hiring may overvalue affiliation
- managerial skill uncertain

## External Proven Manager

他Club / LeagueでHead Manager実績あり。

利点:
- large managerial evidence sample
- known tactical identity

Risk:
- expensive
- philosophy mismatch
- previous success may not transfer
- current skill may be outdated

## External Coach / Assistant

Head Manager未経験だが:

- bench coach
- pitching coach
- hitting coach
- farm manager
- analyst / strategy staff

等で実績。

Potential:
- undervalued future elite manager
- specialist skill may not transfer to full management

## Minor / Farm Manager

Development team等でHead Manager経験。

Evidence:
- player handling
- lineup / pitching management
- development environment

ただしFirst Team levelへのtransfer uncertaintyあり。

## Unknown / Low-profile Candidate

現役時代無名でも監督候補になれる。

理由:
- coaching career
- tactical reputation
- organization trust
- minor-league success
- staff recommendations
- interview quality

「現役Starでなかったから候補になれない」は禁止。

---

# 4. Club Hiring Archetypes

ClubごとにManager Hiring Philosophyを持てる。

## OB Tradition

```text
Club Affiliation weight ↑
Supporter familiarity ↑
External candidate weight ↓
```

## Proven Winner

```text
Past Head Manager results ↑
Experience ↑
Cost tolerance ↑
```

## Development First

```text
Youth handling
Player evaluation
Patience
Farm experience
```

## Tactical Innovator

```text
Analysis
Adaptation
Strategy fit
Experimentation openness
```

## Stability First

```text
Leadership
Role management
Club familiarity
Low conflict risk
```

## Owner's Choice

Owner preference / reputation / symbolismのweightが高い。

これ自体を「愚かなClub」とはしない。
結果はCandidate fit次第。

---

# 5. Front Office Evaluation Skill

Manager採用にもFront Office能力を必要とする。

候補内部能力:

- candidate scouting
- tactical literacy
- interview interpretation
- reputation de-biasing
- role-fit evaluation
- reference network
- succession planning
- risk calibration

優秀なFront OfficeはManagerのTrue Skillを直接知るのではなく、
**Estimateの誤差を小さくする**。

---

# 6. Manager Candidate Estimate

Clubごとに候補評価は違ってよい。

```ts
type ManagerCandidateEstimate = {
  candidateId: ManagerId;

  projectedTacticalJudgment: Estimate;
  projectedAnalysis: Estimate;
  projectedAdaptation: Estimate;
  projectedPlayerEvaluation: Estimate;
  projectedOperations: Estimate;
  projectedLeadership: Estimate;

  philosophyFit: Estimate;
  clubCultureFit: Estimate;
  playerAcceptance: Estimate;

  uncertainty: number;
};
```

同じCandidateを:

```text
Club A: A-grade candidate
Club B: C-grade candidate
```

と見ることがある。

---

# 7. OB Bias Must Be Explainable

OB優先を固定Buff / Debuffにしない。

```text
former club player
        ↓
more known information
more internal references
more cultural familiarity
possibly supporter legitimacy
        ↓
hiring probability changes
```

ただしManager Skillは変わらない。

---

# 8. Unknown Candidate Advantage

無名Candidateには:

- low reputation
- low hiring probability
- high uncertainty

がある。

一方で:

- hidden high Manager Skill
- innovative philosophy
- strong adaptability

を持つ可能性がある。

これにより:

> 「なぜ誰もこの人を監督にしなかったんだ？」

という後世評価がGame World内で起こり得る。

---

# 9. Reputation Formation

Manager Reputationは結果だけではない。

入力候補:

- previous wins vs roster expectation
- postseason / tournament performance
- player development reputation
- clubhouse reputation
- tactical innovation
- media image
- former playing career
- assistant / coach achievements

Reputationは真能力のNoise-heavy projection。

---

# 10. First-time Manager Uncertainty

初監督はuncertaintyを高くする。

例:

```text
public reputation: B
true tactical skill: A
true leadership: D
```

Clubは就任前にこの歪みを完全には知れない。

Seasonを重ねるほどEvidenceが増える。

---

# 11. Hiring Success Is Not Immediate

初年度結果だけでHiringが正しかった / 間違いだったと確定しない。

```text
Manager performance
+ roster
+ injuries
+ schedule
+ staff
+ variance
        ↓
observed season result
```

ClubもUserもManager Skillを継続的に再評価する。

---

# 12. Club Succession Pipeline

Clubは将来のManager候補を内部育成できる。

```text
former player
 -> coach
 -> farm manager / bench coach
 -> first-team manager candidate
```

Club OB傾向の強い組織ではこのPipelineが太くなる。

External hiring型Clubでは候補市場を広く見る。

---

# 13. Coaching Career Matters More Than Playing Fame

Playing CareerとManager Careerを分ける。

```text
Playing Skill
 != Coaching Skill
 != Manager Skill
```

元Starでも低Manager Skillはあり得る。

無名Playerでも:

```text
strong coaching career
+ strong tactical learning
+ leadership growth
        ↓
elite Manager candidate
```

になれる。

---

# 14. Front Office / Manager Philosophy Conflict

採用時にFitを考える。

例:

```text
Front Office:
  data-heavy
  youth development

Manager:
  intuition-heavy
  veteran-first
```

採用されること自体は可能。

その後:

- roster recommendation conflict
- playing-time conflict
- staff conflict
- role authority dispute

へ発展する可能性がある。

直接Mood penaltyにはしない。

---

# 15. Appointment Authority

将来のClub Governance設計では:

- Owner
- President / CEO
- GM / Sporting Director
- Baseball Operations
- Manager

の誰がManager appointmentへどの程度権限を持つかを分離可能。

現時点では最低限:

```text
Front Office Hiring Decision
+ Ownership Influence
```

を要求する。

---

# 16. CPU Hiring Loop

```text
Vacancy
↓
Candidate Pool
↓
Club shortlisting
↓
Estimate / interviews / references
↓
Philosophy + objective fit
↓
salary / availability negotiation
↓
hire
↓
season evidence
↓
update Manager estimate
↓
retain / extend / fire
```

CPU ClubもTrue Manager Skillを読まない。

---

# 17. User-facing Simplicity

Userが他Clubの採用を見る時:

```text
新監督就任

名前: XXXX
経歴: 元球団OB / 二軍監督
監督経験: なし

公開能力
采配 ?
分析 ?
適応 ?
選手眼 B
運用 C
統率 A

野球観
若手重視 / 固定打線 / 早め継投
```

初監督は一部能力を「?」表示してもよい。

実績が増えると公開評価のconfidenceが上がる。

---

# 18. Why This Matters

このSystemにより:

- OBだから選ぶClub
- 外部実績を重視するClub
- 無名コーチを抜擢するClub
- 有名選手を過大評価するClub
- 次世代の名将を発掘するClub
- 何度も監督選びを外すClub

が同じWorld Simulationから生まれる。

---

# 19. Anti-Monocausal Rule

Manager HiringだけでClub Successを説明しない。

優秀なHiringでもRosterが弱ければ負ける。

悪いHiringでもElite Rosterで勝つことはある。

Front Office自体も:

- scouting
- development
- finance
- roster construction
- manager hiring

という複数責任を持つ。

---

# 20. Design Direction

Manager selectionはFront Office Systemへ接続する。

Manager Marketは独立したLabor Marketとして扱い、
Clubは不完全情報下でCandidateを比較する。

Manager能力とManager採用を分離することで:

> **無能な監督が存在する理由**  
> **なぜその監督が選ばれたか**  
> **なぜ別のClubはその人を選ばなかったか**

まで説明可能にする。
