# Manager Market & Front Office Selection — CANONICAL v1

更新日: 2026-09-22  
状態: **CANONICAL / DESIGN FROZEN v1。2026-09-22ユーザー承認。実装前。**

> **FILENAME LEGACY NOTE**  
> ファイルパスの `-DRAFT` は履歴上残っているだけ。この文書はManager Market / Front Office Selection v1のSource of Truth。

関連:
- `docs/game-design/19-club-structural-dominance-and-decline.md`
- `docs/game-design/31-scouting-recruitment-system.md`
- `docs/game-design/32-roster-development-architecture-DRAFT.md`
- `docs/game-design/41-manager-appointment-and-incompetence-DRAFT.md`
- `docs/game-design/49-manager-architecture-v1.md`

---

# 1. Core Separation

監督の能力と採用価値を分ける。

```text
Manager True Skill
 != Manager Hiring Value
 != Manager Reputation
 != Public Manager Grade
```

ClubはManager True Skillを直接読まない。

採用はCandidateについて当時利用可能な情報と、Club自身の目的・Bias・制約から決まる。

---

# 2. Manager Market Is a Bilateral Labor Market

Manager MarketはClubが一方的に人を選ぶ一覧表ではない。

```text
Club evaluates Manager
        ↕
Manager evaluates Club
```

Club側の主な入力:
- candidate estimate
- career evidence
- reputation
- philosophy / objective fit
- Club / OB relationship
- staff compatibility
- salary / contract cost
- availability
- ownership preference
- supporter / public acceptability

Manager側の主な入力:
- salary / contract length
- Club reputation
- roster quality
- championship opportunity
- expected autonomy
- philosophy fit
- staff environment
- prior Club / person relationships
- career ambition
- job security
- geographic / cultural preference where appropriate

Big ClubのOfferでも必ずAcceptするとは限らない。

---

# 3. Candidate Career Paths

Manager Candidateは複数Career Pathから生まれる。

- Club OB / former player
- former captain / catcher / field leader
- assistant / bench coach
- pitching / hitting / fielding specialist coach
- Reserve / Farm Manager
- Development staff
- Analyst / strategy staff
- External proven Manager
- Unknown / low-profile coach

Playing fameはCandidate visibilityや初期credibilityへ影響し得るが、Manager Skillを作らない。

```text
Playing Skill
 != Coaching Skill
 != Manager Skill
```

元無名Playerでも長いCoaching Careerを通じてElite Manager candidateになれる。

---

# 4. Candidate Pool Is Dynamic

Manager Marketは世代交代する。

```text
player retirement
 -> coach / staff career
 -> assistant / specialist
 -> reserve / farm manager
 -> first-team candidate
 -> manager career
 -> retirement / staff return / other role
```

Candidate Poolを固定初期リストにしない。

長期Saveで新しい候補が生まれ、既存候補が成長・停滞・退職する。

---

# 5. Club Hiring Preference Is Derived, Not a Magic Archetype

OB Tradition / Proven Winner / Development First / Tactical Innovator / Stability First / Owner-driven等の傾向は持てる。

ただし固定Labelが採用率へ直接Bonusを配るのではない。

例:

```text
club history
+ ownership philosophy
+ supporter expectation
+ previous hiring outcomes
+ internal network
        ↓
club-affiliated candidate preference
```

長期Save中にClubの採用文化が変化してよい。

---

# 6. OB / Former-star Boundary

OBや元Starが採用されやすい場合、その理由を説明可能にする。

候補:
- known information
- internal references
- cultural familiarity
- supporter legitimacy
- initial player respect
- ownership interest
- media visibility

禁止:

```text
former superstar
 -> Manager Skill +20
```

OB / FameはHiring information / preferenceへ作用し、True Skillには作用しない。

---

# 7. Front Office Evaluation Architecture

Front OfficeもManager True Skillを読まない。

Manager hiringだけのために巨大な8能力Systemを新設しない。

概念的なSourceは少数へ整理する。

- Evaluation Quality
- Baseball / Tactical Literacy
- Network Quality
- Planning Horizon
- Bias / Risk Calibration

これらから:
- candidate scouting
- interview interpretation
- reputation de-biasing
- role-fit evaluation
- reference quality
- succession planning

等をDerivedする。

優秀Front OfficeはTruthを見るのではなく、Estimate uncertaintyやbiasを減らしやすい。

---

# 8. Club-specific Candidate Estimate

同じCandidateでもClubごとに評価が違ってよい。

```ts
type ManagerCandidateEstimate = {
  candidateId: ManagerId;
  projectedSkills: ManagerSkillEstimate;
  philosophyFit: Estimate;
  rosterFit: Estimate;
  staffFit: Estimate;
  clubCultureFit: Estimate;
  publicAcceptance: Estimate;
  uncertainty: number;
};
```

例:

```text
Club A: Analysis A? / Adaptation ? / Leadership C?
Club B: Analysis B? / Adaptation B? / Leadership B?
```

両方ともWorld Truthではない。

---

# 9. Interview Is Evidence, Not an Oracle

面接・会話・ReferenceはEstimate更新材料。

禁止:

```text
interview completed
 -> True Skill revealed
```

Interviewが上手いCandidateを低Quality Front Officeが過大評価することも可能。

Candidate自身の自己評価もTruthとは限らない。

---

# 10. First-time Manager Uncertainty

初監督はHead ManagerとしてのEvidenceが少ない。

したがって:
- Public Gradeに `?` が多い
- Club estimate uncertaintyが大きい
- Specialist successがHead Managerへtransferするか不明

を許可する。

監督は「なってみるまで分からない部分が大きい」。

---

# 11. Reputation

Manager ReputationはTrue Skillではない。

入力候補:
- wins vs expectation
- postseason / tournament history
- development reputation
- tactical innovation
- staff / player reputation
- media image
- former playing fame
- coach / assistant achievements
- famous failures / successes

ReputationはNoise-heavy public / organizational memory。

昔の名将Reputationが残っていても、現在Public GradeやClub Estimateが低下してよい。

逆に高評価の若手でもReputationはまだ小さいことがある。

---

# 12. Hiring Decision

CPU Hiring Loop:

```text
Vacancy
 -> Candidate Pool
 -> discovery / shortlist
 -> Club-specific Estimate
 -> fit / objective comparison
 -> ownership / public / cost constraints
 -> Manager-side interest
 -> negotiation
 -> hire / rejection
```

CPU ClubはHidden True Skillを使わない。

採用結果は必ず当時の情報から説明可能にする。

---

# 13. Contract Boundary

Manager契約は意味を持つ。

例:
- salary
- contract length
- remaining term
- firing cost
- job security

ただし詳細契約シミュレーターにはしない。

通常User surfaceは:

```text
3年契約
年俸: ...
```

程度でよい。

---

# 14. Retain / Extend / Fire Is Expectation-adjusted

順位だけで解任を決めない。

Clubが観測可能な範囲で:

```text
actual results
vs expected results
+ roster constraints
+ injuries / availability
+ club objective
+ development progress
+ observable decision quality
+ philosophy / staff fit
+ ownership / supporter pressure
+ contract context
        ↓
retain / extend / fire
```

を見る。

例:
- rebuilding rosterで予想以上に勝つ5位 → 高評価になり得る
- championship rosterで大幅期待未達の2位 → 低評価になり得る

`最下位 = 必ず解任` は禁止。

---

# 15. Failed Manager Can Return

一Clubでの失敗をTrue incompetence確定にはしない。

失敗原因は:
- bad fit
- roster quality
- injuries
- staff conflict
- timing / variance
- actual competence

が混ざる。

別Clubが異なるEstimate / Fit判断で再雇用してよい。
復活も再失敗もあり得る。

---

# 16. Internal Succession Pipeline

Clubは将来のManager candidateをBackgroundで育てられる。

```text
former player / staff
 -> coach
 -> reserve / farm manager
 -> bench / specialist role
 -> first-team candidate
```

OB-heavy ClubはこのPipelineを重視しやすい。
External hiring型ClubはMarket discoveryを広く使いやすい。

Pipeline自体がSkill Buffを配らない。

---

# 17. Front Office / Manager Conflict

採用時にFitを評価しても、Conflictは起こり得る。

例:
```text
Front Office = data-heavy / youth-first
Manager = intuition-heavy / veteran-first
```

採用後:
- roster recommendation conflict
- playing-time conflict
- staff conflict
- authority dispute

が起こり得る。

Conflict LabelからMood penaltyを直接配らず、実際のDecision / Appraisalへ接続する。

---

# 18. Human Control Overlay — Evaluation Attribution

User操作中もDecision Originを保持する。

```text
MANAGER_AUTONOMOUS
MANAGER_DELEGATED
HUMAN_OVERRIDE
```

元監督自身のDecision-quality / Skill evidenceには原則:

```text
MANAGER_AUTONOMOUS
+ MANAGER_DELEGATED
```

だけを使う。

HUMAN_OVERRIDEでUserが行った采配を、元監督の名采配・迷采配として評価しない。

例:

```text
User controls lineup + bullpen for 162 games
 -> club wins 100
 -> world championship history is real
 -> original manager does NOT receive '100-win tactical evidence' for user decisions
```

逆にUser操作で大敗しても元監督のDecision competenceへそのまま帰属させない。

ただしWorldで生じたPlayer stats / titles / relationships / historyは正史。

---

# 19. Delegate Manager Lifecycle During User Control

Human Control Overlay中も、裏Managerを最初の人物のまま永久冷凍しない。

```text
User controls Club
        ↓
Delegate Manager A remains real Person
        ↓
contract / aging / retirement / market transition
        ↓
Delegate Manager B may become current underlying Manager
```

Userが長期間同じClubを操作してもManager Marketは世界時間と共に進む。

Userが別Clubへ移動 / Human Overlayを外した時:

> **その時点のCurrent Delegate Managerが表の監督として戻る。**

20年前にUserが操作開始した時のManagerを突然復活させない。

Delegate Managerの採用・続投・解任評価にもHUMAN_OVERRIDEの采配成果を本人のDecision Evidenceとして使わない。

---

# 20. User-facing Simplicity

CPU ClubのManager MarketをUserに管理させない。

通常表示例:

```text
新監督就任

山田 太郎
前職: 二軍監督
一軍監督経験: なし

公開評価
采配 ?
分析 B?
適応 ?
選手眼 A?
運用 C
統率 B?

青特
育成眼
抜擢上手
```

興味があるUserだけ詳細Profile / Career Historyを見られる。

CPU Clubが候補をどう比較したかを通常UIへSpreadsheet表示しない。

---

# 21. Anti-Monocausal Rule

Manager HiringだけでClub Successを説明しない。

良いHiringでも弱いRosterなら負ける。
悪いHiringでもElite Rosterで勝つことがある。

Front Officeの責任はManager hiring以外にも:
- scouting
- development
- finance
- roster construction
- staffing

等がある。

---

# 22. Acceptance Tests

1. CPU ClubはManager True Skillを直接読まない。
2. 同じCandidateをClubごとに違う評価で見られる。
3. InterviewでTrue Skillが完全開示されない。
4. Former Star / OBは採用されやすくなり得るがManager Skillは上がらない。
5. 無名Coach / Analyst / Farm ManagerがElite Managerへ成長できる。
6. Manager本人がOfferを断れる。
7. Big ClubのOfferが自動承諾にならない。
8. Initial Manager poolが数十年後も固定されない。
9. 結果だけでretain / fireを決定しない。
10. 一Clubで失敗したManagerが別Clubで再起できる。
11. HUMAN_OVERRIDEを元監督のDecision Skill evidenceへ帰属させない。
12. User操作中でもDelegate Manager Marketが時間経過する。
13. UserがClubを離れた時、current Delegate Managerが自然に表へ戻る。
14. Manager MarketのSimulationを表示しなくても世界結果が同一。
15. Hiring / firing LabelそのものがMatch CoreへBuff/Debuffを配らない。

---

# 23. Final v1 Status

**Manager Market & Front Office Selection v1は2026-09-22にユーザー承認され、DESIGN FROZEN。**

```text
Candidate World
        ↓
Club-specific imperfect estimate
        ↕
Manager-side career preference
        ↓
bilateral hiring decision
        ↓
real career evidence
        ↓
estimate / reputation update
```

これにより「なぜこの監督が選ばれたか」「なぜ外したか」「なぜ別Clubで再起したか」をWorld Historyから説明可能にする。