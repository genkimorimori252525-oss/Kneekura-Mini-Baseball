# Manager Appointment & Incompetence — DRAFT

更新日: 2026-09-20  
状態: **設計候補。USER REVIEW REQUIRED。実装前。**

関連:
- `docs/game-design/31-scouting-recruitment-system.md`
- `docs/game-design/39-manager-philosophy-and-command-architecture-DRAFT.md`
- `docs/game-design/40-manager-ratings-era-and-strategy-evolution-DRAFT.md`
- `docs/game-design/19-club-structural-dominance-and-decline.md`

---

# 1. Core Principle

全監督を有能にしない。

```text
Manager
 != minimum competence guaranteed
```

公開6能力:

- 采配
- 分析
- 適応
- 選手眼
- 運用
- 統率

には、実際にE / F / Gが存在してよい。

複数軸が低い監督も存在可能。

---

# 2. No Single "Incompetent" Flag

禁止:

```text
manager.isBad = true
 -> team loses
```

無能さは複数の失敗様式として表現する。

例:

## Tactical incompetence

- poor action evaluation
- late substitution
- bad risk assessment
- weak leverage recognition

## Analytical incompetence

- bad sample interpretation
- overfitting
- ignores uncertainty
- reads noisy trends as signal

## Adaptive incompetence

- repeats failed plan
- reacts too slowly
- refuses to abandon outdated assumption

## Player-evaluation incompetence

- misreads readiness
- misidentifies role fit
- overvalues reputation
- misses decline / improvement

## Operational incompetence

- bullpen overuse
- poor rest cycles
- unstable promotion / demotion
- role churn

## Leadership incompetence

- unclear communication
- poor role explanation
- escalates conflict
- loses trust

これらが実際のDecision / Player Appraisalへつながる。

---

# 3. Why an Incompetent Manager Can Be Hired

ClubもManager True Skillを完全には読めない。

```text
manager true skill
        ↓
career evidence
reputation
interviews
staff references
past results
playing career
public image
organizational fit
cost
availability
        ↓
Club Manager Estimate
        ↓
hiring decision
```

したがって採用ミスが起こり得る。

---

# 4. Appointment Motives

CPU Clubは必ず「最高能力の監督」を採らない。

候補要因:

- strong past reputation
- famous former player
- internal promotion
- assistant / coach continuity
- owner / front-office preference
- tactical ideology fit
- player trust
- low salary
- limited candidate pool
- emergency interim appointment
- rebuilding fit
- media / supporter acceptability
- loyalty / organizational history
- success in a previous role that does not transfer to managing

これにより低能力監督でも就任可能。

---

# 5. Reputation != Current Skill

重要:

```text
Reputation
 != True Manager Skill
```

過去の成功が現在の能力を保証しない。

例:

```text
historically successful manager
+ low Adaptation
+ changed league meta
        ↓
current decisions become outdated
```

逆に無名の新人が高能力でも、実績不足で採用されにくいことがある。

---

# 6. Famous Player Bias

現役時代のStar StatusはManager Skillではない。

```text
great player
 -> higher hiring visibility / credibility
 != automatically good manager
```

元スターは:

- supporter excitement
- player respect
- public legitimacy

を得やすい可能性はある。

しかし:

- tactical judgment
- analysis
- adaptation
- workload management

は別能力。

---

# 7. Internal Promotion Risk

Coach / assistantからの昇格は自然な経路。

利点:

- organization knowledge
- player familiarity
- existing trust
- system continuity

Risk:

- manager role requires broader skill set
- excellent specialist coach may be poor head manager

```text
great pitching coach
 != great manager
```

を許可する。

---

# 8. Interim Managers

緊急時は候補市場を待てない。

```text
manager fired / resigns
 -> interim appointment
```

Interimは:

- current staff availability
- trust
- continuity

を優先し、能力が低くても就任し得る。

成功すれば正式昇格もある。

短期成功がSmall Sampleなら、正式採用後に失敗する可能性もある。

---

# 9. Club Hiring Skill

Manager採用の質はFront Office側にも依存する。

候補:

- candidate evaluation quality
- interview quality
- reference network
- tactical literacy
- long-term planning
- willingness to challenge reputation
- budget

したがって:

```text
bad club manager hire
 != manager system failure
```

上流のFront Office decisionとして説明できる。

---

# 10. Bad Manager Does Not Auto-Lose

Anti-Monocausal Principleを適用。

```text
weak manager
+ elite roster
+ strong staff
+ simple stable roles
        ↓
can still win
```

逆に:

```text
great manager
+ very weak roster
        ↓
cannot create talent
```

Managerは重要だがUniversal Win Modifierではない。

---

# 11. Staff Can Mask Weakness

監督が全て一人でやらない。

例:

```text
Manager Analysis E
+ elite analytics staff
        ↓
game-plan input can still be strong
```

ただし最終的に監督が:

- trust the staff?
- understand the recommendation?
- implement it?
- communicate it?

で差が出る。

これにより「弱点を優秀な参謀が補う」が可能。

---

# 12. Strong Staff Can Also Be Wasted

```text
elite analysts
+ Manager distrusts analytics
        ↓
information exists
but decision does not use it
```

Staff能力とManager Philosophy / Adaptationを分離する。

---

# 13. Era Obsolescence

年齢そのものを能力Debuffにしない。

代わりに:

```text
low Adaptation
+ strong old priors
+ league meta changes
        ↓
effective decision quality declines
```

とする。

これは若い監督にも起こり得る。

---

# 14. Failure Persistence

低能力監督がすぐ解任されるとは限らない。

継続理由候補:

- long contract
- past reputation
- ownership loyalty
- rebuild excuse
- injuries blamed
- fan popularity
- lack of alternatives
- front office shares same philosophy
- small sample uncertainty
- recent partial improvement

ただしClubにもToleranceがあり、長期失敗で解任圧力は上がる。

---

# 15. Manager Evaluation by Club

Clubは結果だけで判断しない。

候補:

```text
wins vs expectation
player development
clubhouse stability
tactical quality estimate
roster constraints
injuries
long-term objective
public pressure
contract cost
        ↓
retain / extend / fire
```

「最下位 = 必ず解任」ではない。

---

# 16. Public User View

ユーザーはCPU監督の公開S–G能力を見られる。

例:

```text
監督プロフィール

采配 D
分析 E
適応 F
選手眼 C
運用 D
統率 B

野球観
・完投重視
・固定打線
・ベテラン重視
・直感重視
```

これにより:

> 「この監督、統率だけはあるが采配・分析が弱い」

程度は一目で理解できる。

内部の細かいFailure MechanismはOptional。

---

# 17. Rating Distribution

全員をB以上にしない。

初期候補:

- S: rare
- A: uncommon
- B/C: common professional range
- D: noticeably weak
- E/F: poor
- G: extreme weakness

ただし各Axisの分布であり、
監督全体を一つのTierへ分類しない。

複数D/Eでも就任可能。

---

# 18. Hiring Uncertainty

CPU Clubは公開GradeをTrue値として直接読まない。

公開GradeはUser-facing projection。

Club内部では:

```text
candidate estimate
+ uncertainty
```

を持つ。

これにより:

- userから見ると「なんでEの監督を採った？」
- world側では「ClubはB相当だと誤認していた」

という説明が可能。

---

# 19. User Manager Boundary

User自身の戦術Decisionは低いManager Ratingで改変しない。

ただしUser側のManager avatar / career能力を導入する場合:

- information quality
- communication
- player acceptance
- workload support
- conflict mediation

等にはRatingを作用させられる。

Userのボタン選択をランダムで別Actionへ変えることは禁止。

---

# 20. Stress Tests

1. genuinely poor managers can exist.
2. poor managers can be hired for explainable reasons.
3. famous former players are not automatically good managers.
4. great specialist coaches can fail as head managers.
5. strong staff can partially compensate for a weak manager.
6. a weak manager with elite roster can still win.
7. a great manager cannot make a weak roster elite by magic.
8. low Adaptation can make previously successful philosophy obsolete.
9. clubs can retain a weak manager for non-random reasons.
10. user can understand the weakness from simple public S–G ratings.

---

# 21. Review Point

このDraftの中心判断:

> **監督職は能力保証ではない。就任は選抜結果であり、選抜も不完全。**

これをManager Market / Front Office設計へ接続する。
