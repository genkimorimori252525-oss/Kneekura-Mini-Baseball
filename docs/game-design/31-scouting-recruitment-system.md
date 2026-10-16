# Scouting & Recruitment System — CANONICAL v1

更新日: 2026-09-22  
状態: **CANONICAL / DESIGN FROZEN v1。2026-09-22ユーザー承認。Simple Surface / Deep Simulation準拠。実装前。**

> Scout / Department / Club Knowledge / Recruitment decision provenanceの責務をv1としてFreezeする。
> Player Headline `☆000〜999` とNon-player Overall S〜Gは02 Section 4.0の共通Headline Rating Contractに従う。

関連:
- `docs/game-design/16-club-economy-rivalry-design.md`
- `docs/game-design/18-club-state-lifecycle.md`
- `docs/game-design/20-simple-surface-deep-simulation.md`
- `docs/game-design/26-club-initial-seed-rating-model.md`

---

# 1. 目的

補強成功 / 失敗を、

```text
rich club -> always good signing
poor club -> always bad signing
```

にしない。

実際の:

- scouting quality
- coverage
- information uncertainty
- projection
- analytics
- club strategy
- manager fit
- price
- negotiation
- development after acquisition

を通して結果を作る。

ScoutはPlayer true abilityを変更しない。

Scoutが変えるのは**ClubがPlayerについて何を知るか**である。

---

# 1.1 Canonical Boundaries

1. Playerは32のGlobal Player Personとして先にWorldへ存在する。
2. DiscoveryはPlayer生成ではなく、ClubがそのPlayerを認知・追跡し始めること。
3. Scout / CPU / User ClubはHidden True Player Stateを直接読まない。
4. ScoutingのSource of TruthはEvidence -> Club Knowledge Estimate。
5. Recruitment decisionは**decision-time information**から説明可能でなければならない。
6. OutcomeとScout/Decision qualityを分離する。
7. User SurfaceはDirector / simple policy / focused request / shortlistまで。Detailed staff schedulingはBackground。

---
# 2. ScoutはPerson

ScoutをClub固定能力にしない。

```ts
type ScoutPerson = {
  personId: PersonId;
  contract: StaffContract;
  careerState: StaffCareerState;
  specialties: ScoutSpecialties;
  evaluationSkill: ScoutEvaluationSkill;
  network: ScoutPersonalNetwork;
  adaptability: number;
  experience: ScoutExperience;
};
```

Scoutは:

- hired
- renewed
- poached
- fired
- retired

できる。

Clubを移れば本人のSkill / Experience / Personal Networkの一部を持って移る。

---

# 3. Scouting Departmentは別のInstitution

一人の天才Scoutだけで全世界を把握しない。

```ts
type ScoutingDepartmentState = {
  directorId: PersonId;
  scoutIds: readonly PersonId[];
  analystCapacity: number;
  videoDataInfrastructure: number;
  regionalCoverage: RegionalCoverageMap;
  institutionalKnowledge: number;
  operatingBudget: Money;
};
```

Club側に残るもの:

- database
- systems
- reports
- processes
- historical observations
- some regional relationships
- analytics infrastructure

Scout本人に付くもの:

- personal judgement
- personal contacts
- region familiarity
- specialty
- experience

この分離により、Scout一人の退団でClubのScoutingが0にならない。

---

# 4. Internal Scout Skills

ユーザーへ全て表示する必要はない。

内部候補:

```ts
type ScoutEvaluationSkill = {
  presentAbilityEvaluation: number;
  futureProjection: number;
  pitchingEvaluation: number;
  hittingEvaluation: number;
  fieldingEvaluation: number;
  physicalProjection: number;
  riskRecognition: number;
  dataIntegration: number;
};
```

Specialtyにより同じScoutでも得意領域が違う。

例:

```text
Scout A
  amateur hitting    excellent
  pro pitching       average

Scout B
  international pitching excellent
  amateur projection    weak
```

万能Scoutを標準にしない。

---

# 5. Scout Output is Knowledge, not Truth

Playerの真値:

```text
True Player State
```

と、

```text
Club Knowledge Estimate
```

を分離する。

例:

```text
True contact precision = 78

Club A estimate:
  74–82, confidence high

Club B estimate:
  61–86, confidence low
```

良いScoutは主に:

- uncertainty widthを狭める
- biasを減らす
- projection errorを減らす
- unknown playerを発見しやすくする

のであって、Playerを強くしない。

---

# 5.1 Player Knowledge Report Provenance — CANONICAL

Reportは「現在のPlayer真値」ではなく、**その観測時点までにClubが知っていたEvidence**を保存する。

```ts
type PlayerKnowledgeRecord = {
  playerId: PlayerId;
  clubId: ClubId;
  observedAt: SeasonTime;
  evidenceSourceIds: readonly EvidenceId[];
  evaluatorPersonIds: readonly PersonId[];
  estimate: PlayerEstimate;
  confidence: KnowledgeConfidence;
  freshness: KnowledgeFreshness;
  lastUpdatedAt: SeasonTime;
};
```

2030年Reportは新しい観測がなければ2034年に自動で最新Truthへ更新されない。

Public `☆000〜999` / 0〜100能力Projectionを外部Playerへ表示する場合も、このClub Knowledgeから生成する。

---
# 6. Discovery

全Playerを全Clubが最初から知っているわけではない。

Player自体は32のWorld / regional pathway上に既に存在する。Scouting DiscoveryはGlobal Playerを新規生成する処理ではない。

```text
regional coverage
+ scout network
+ competition exposure
+ data availability
+ scouting budget
        ↓
Discovery Evidence
        ↓
player becomes known
```

有名な一軍Playerはほぼ全Clubが知っていてよい。

Scouting差が大きく出るのは:

- amateur
- academy
- lower leagues
- foreign leagues
- lightly used reserve players
- late bloomers
- unusual profiles

等。

---

# 7. Recruitment Pipeline

補強はScout一人で決めない。

```text
Scouts / Analysts
        ↓
Knowledge Estimates
        ↓
Scouting Director synthesis
        ↓
GM / Sporting Director decision
        ↑
Manager needs / tactical fit
        ↑
Budget / roster / contract context
        ↓
Negotiation
        ↓
Acquisition
        ↓
Actual usage / development
        ↓
Outcome
```

これにより、

> 良いScoutが見つけたのにGMが買わなかった

> 良い選手を取ったのに監督が使いこなせなかった

> 評価は正しかったが価格を払い過ぎた

も起こせる。

---

# 7.1 Recruitment Decision Snapshot — CANONICAL

Shortlist / bid / pass / acquisitionの重要Decisionでは、**その時点で利用可能だった情報**を保存する。

```ts
type RecruitmentDecisionRecord = {
  decisionId: DecisionId;
  playerId: PlayerId;
  decidedAt: SeasonTime;
  knowledgeSnapshotRefs: readonly KnowledgeSnapshotId[];
  rosterNeedSnapshot: RosterNeedSnapshot;
  budgetContext: RecruitmentBudgetContext;
  fitEstimate: RecruitmentFitEstimate;
  marketContext: RecruitmentMarketContext;
  offeredTerms?: ContractOfferSnapshot;
  decision: "SHORTLIST" | "BID" | "PASS" | "ACQUIRE";
};
```

後からPlayerが大成 / 失敗してもDecision時点のKnowledgeをHidden Truthで書き換えない。

これにより「なぜ獲った / 見送ったか」を当時のEvidenceで説明できる。

---
# 8. CPU Club Decision

CPU ClubはPlayerのTrue Abilityを直接読まない。

必ずそのClubのKnowledgeを使う。

```text
CPU Recruitment AI
input:
  ClubKnowledgeEstimate
  rosterNeeds
  managerPreference
  budget
  contractDemand
  marketCompetition
  developmentPlan
  riskTolerance

output:
  shortlist
  bid
  pass
```

これが重要。

CPUだけ神の視点を持たせない。

---

# 9. Manager Role

Field Manager / Head CoachとRecruitment責任者を分離する。

野球型Club:

```text
GM / Baseball Operations
 -> final acquisition authority

Manager
 -> roster need / usage / fit feedback
```

Football-derived Club:

```text
Sporting Director / Board
 -> primary recruitment authority

Manager
 -> stronger tactical-fit input possible
```

Club philosophyによってManager influenceの強弱を変えてよい。

---

# 9.1 Recruitment Authority Profile

最終AuthorityはManager能力そのものではなくClub Governance / Recruitment Authority Profileで決める。

ManagerはRoster Need / fit / expected usageのinputを提供できるが、Manager True Skillが高いだけで自動的に全補強権限を持たない。

---
# 10. Scouting Success and Failure

強豪でも失敗する理由:

- scouting miss
- projection miss
- medical / durability uncertainty
- tactical mismatch
- manager disagreement
- market overpayment
- player adaptation failure
- development failure
- role blocked by incumbent
- rival Club outbids
- good information ignored by decision-maker

弱小でも成功する理由:

- regional specialist
- overlooked player discovery
- excellent projection
- strong club-player fit
- early acquisition before market rises
- academy / development compatibility
- better willingness to give playing time

---

# 11. Scout Growth

Scoutは成長可能。

単純なLevel XPではなく:

```text
evaluation repetitions
+ diverse assignments
+ feedback after player outcomes
+ collaboration with analysts
+ mentorship
        ↓
gradual skill / calibration improvement
```

ただし結果だけを見て毎回正解扱いしない。

Player outcomeには:

- coaching
- injury
- playing time
- league adaptation
- luck

も含まれるため、Scout自身の評価誤差と分離する。

**Outcome != Scout correctness**。後続Evidenceを使う場合も、original estimate / uncertainty / opportunity / injury / environmentを分離してcalibration updateする。

`Bargain` / `Major Failure`等の事後LabelからScout Skillを直接上下させない。

---

# 12. Scout Decline / Change

Scoutを年齢だけで一直線に弱体化させない。

変化候補:

- retirement
- reduced travel capacity
- region network becoming stale
- failure to adapt to new data methods
- changing baseball environment
- long absence from a market
- role mismatch

一方でVeteran Scoutは:

- judgement
- contacts
- pattern recognition
- negotiation intelligence

が高い場合がある。

したがって:

```text
older = worse
```

は禁止。

---

# 13. Network Freshness

Personal / Club Networkは維持が必要。

```text
active coverage
 -> fresh network

years away from region
 -> freshness slowly declines
```

例:

Japan specialistが10年South Americaだけ担当すれば、Japan Networkの一部は古くなる。

ただしExperienceそのものは失われない。

---

# 14. Adaptability

Scouting environmentは時代で変わる。

例:

- new tracking data
- biomechanics
- pitch-shape analysis
- new leagues
- player-development technology

Scout / DirectorのAdaptabilityが低い場合:

```text
old method remains
 -> new market inefficiency may be missed
```

高い場合:

```text
new evidence integrated quickly
```

これにより昔は名Scoutだった人物が時代変化へ適応できないことも表現できる。

---

# 15. Scouting Director

Simple Surfaceのため、Userが直接扱うStaffの中心は**Scouting Director / Head Scout一人**でよい。

User-facing candidate:

```text
スカウト責任者

総合評価     A
発掘         A
現能力評価   B
将来予測     S
データ活用   A
得意領域     高校生打者 / Japan / Korea
年俸         ...
契約         ...
```

`総合評価` はrole-specificな詳細SkillのPublic Observed Estimateから作るDerived Summary。Scout Accuracyの原因Statではない。

「結局この人はどうか」を一目で見たいUserはOverallだけで比較でき、詳細を見たいUserだけ個別Skill / Specialtyを見る。

配下Scout / AnalystはDepartment AIが自動管理可能。

Hardcore Viewでは詳細Staffを閲覧できる。

---

# 16. User Actions

通常Userができる候補:

- Scouting Directorを雇う / 更新する
- Scouting emphasisを簡単に選ぶ
- 特定Playerを重点調査
- 特定Regionを重点調査
- Draft / Transfer shortlistを見る

例:

```text
スカウト方針:
○ バランス
○ 国内若手
○ 海外若手
○ 即戦力
```

詳細なScout配置表を毎週管理させない。

---

# 17. Budget

Scout / AnalystはStaff costを持つ。

```text
Club scouting budget
 -> number / quality of staff
 -> travel / data / coverage
 -> information quality
```

ただし金を使えば必ず成功ではない。

禁止:

```text
scoutingBudget +20%
 -> evaluation accuracy +20%
```

BudgetはStaff hiring / travel / data access / coverage / observation frequency / report timeliness等へ因果的に作用する。

大型Departmentでも:

- poor director synthesis
- bad assumptions
- organizational groupthink

で失敗可能。

小規模Clubでも:

- outstanding specialist
- narrow but deep coverage
- strong local network

で勝てる。

---

# 18. Organizational Memory

Scoutが退団してもReport / DatabaseはClubに残る。

ただしPersonal Networkは本人側へ多く残る。

```text
Scout leaves

Club retains:
  reports
  video
  historical data
  processes

Scout takes:
  judgement
  contacts
  tacit knowledge
```

この差がStaff poachingを意味あるものにする。

Clubに残るReport / video / databaseは観測時点を保持し、Scout退団後も自動で最新Truthへ更新されない。Organizational MemoryにもFreshness / source provenanceを持てる。

---

# 19. Initial Club Scouting Seed

26の `scouting` 5軸SeedはDepartmentのCareer開始時初期状態を作る。

例:

```text
Dodgers scouting = 98
 -> large high-quality department seed

Rays scouting = 97
 -> exceptional evaluation / analytics seed
    despite lower finance

Club scouting = 70
 -> competent but narrower coverage
```

Pennant開始後はStaff hiring / departures / investmentで変化する。

26のInitial `scouting` SeedはCareer Creation時点でauthorityを終了する。以後の現在Scouting Rankはactual Department Stateから18 L4へDerivedする。

---

# 20. Recruitment Outcome Evaluation

補強の成功 / 失敗は事後的に評価する。

```text
Acquisition Cost
vs
Actual Value Delivered
vs
Alternative Market Options
```

から:

- bargain
- fair
- disappointing
- major failure

等をUI表示可能。

しかしこのLabelも結果。

Player abilityを変更しない。Scout / Director / GM / Managerの責任もLabelだけで自動確定しない。

例: Scout評価は妥当だったがGMがoverpayした、Playerは妥当だったがUsageが悪かった、という分離を許可する。

---

# 21. CPU Learning Boundary

CPU Clubは過去の補強結果から方針を調整できる。

ただしPlayer True Stateをretroactively知ることはできない。

Organization learningは当時のDecision Snapshotと、その後に合法的に得られたEvidenceだけから行う。

例:

```text
Club repeatedly overvalues raw velocity
        ↓
internal review
        ↓
Director / GM may alter weighting
```

Organizationも成長 / 退化できる。

---

# 22. Test Principles

- CPU Club never reads hidden true ability directly
- better scouts reduce uncertainty, not create player ability
- rich Club can make expensive recruitment mistakes
- poor Club can discover undervalued stars
- scout departure does not erase all Club knowledge
- scout network can become stale
- age alone does not force decline
- scouting director quality affects synthesis, not player truth
- manager influence varies by Club governance
- signing success requires acquisition + usage + development, not scouting alone
- all recruitment decisions are explainable from information available at the time

---

# 23. Final Approved Decisions — v1

1. Scoutは雇用されるGlobal Person Staff。
2. Scouting DepartmentはClub Institutional StateとしてScout Personと分離する。
3. Scoutが変えるのはPlayer TruthではなくClub Knowledge。
4. CPU / User ClubともHidden True Player Stateを直接読まず、そのClubが持つEvidence / Estimateを使う。
5. Discoveryは既存Global PlayerをClubが認知・追跡することでありPlayer生成ではない。
6. Player Knowledge Reportはevidence source / observation time / evaluator / estimate / confidence / freshnessを保持する。
7. 古いReportを新観測なしに自動で最新Truthへ更新しない。
8. RecruitmentはScout -> Knowledge -> Director synthesis -> Authority decision + Manager fit input -> Negotiation -> Acquisition -> Usage / Developmentの因果Pipeline。
9. Recruitment Decision時点のKnowledge / Roster Need / Budget / Fit / Market / OfferをSnapshot保存する。
10. Signing OutcomeとDecision Quality / Scout Evaluation Qualityを分離し、後知恵でHidden Truthを逆流させない。
11. Scout Learningは後続Evidenceによるcalibrationであり、成功/失敗Labelから直接Skillを変更しない。
12. Scouting Budgetはstaff / coverage / travel / data / timelinessへ作用し、直接Accuracy Buffは禁止。
13. Personal / Organizational NetworkはFreshnessを持ち、Experienceそのものと分離する。
14. 年齢だけでScoutを自動劣化させない。Adaptability / freshness / role fit等から変化する。
15. Recruitment AuthorityはClub Governance Profileで決まり、ManagerはNeed / fit / usage inputを提供する。
16. User SurfaceはScouting Director採用 / simple emphasis / Player or Region focused request / shortlist程度。Weekly Scout micromanagementは禁止。
17. Scout / DirectorにはPublic Overall S〜Gを持たせる。OverallはDerived Summaryであり、詳細Skill / SpecialtyがSource。
18. Player targetには02共通Contractの`☆000〜999` Headline RatingをClub Knowledge + dynamic League Rating Contextから表示できる。
19. 26のScouting SeedはCareer Creation時Initial Department Seedだけ。以後はactual Department Stateからcurrent Scouting RankをDerivedする。
20. Bargain / Fair / Disappointing / Major Failure等は事後Analytic Descriptorであり、Buff / Penaltyや責任を自動確定しない。
21. 全Recruitment Decisionはその時点で利用可能だった情報から説明可能にする。
22. UserにScouting数式や大量配置作業を要求しない。

---

# 24. Final v1 Status

**Scouting & Recruitment System v1は2026-09-22にユーザー承認され、DESIGN FROZEN。**

Roster / Developmentは32 CANONICAL、Player Headline Rating / Staff Overall表示は02 Section 4.0、Manager decisionは49を優先する。