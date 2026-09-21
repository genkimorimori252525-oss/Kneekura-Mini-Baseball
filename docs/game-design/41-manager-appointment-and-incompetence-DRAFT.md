# Manager Competence & Special Ability Architecture — CANONICAL v1

更新日: 2026-09-22  
状態: **CANONICAL / DESIGN FROZEN v1。2026-09-22ユーザー承認。実装前。**

> **FILENAME LEGACY NOTE**  
> ファイルパスの `41-manager-appointment-and-incompetence-DRAFT.md` は履歴上残っているだけ。
> v1では本書の責務を **Manager Competence / Incompetence + readable Manager Special Abilities** に限定する。
> 採用・続投・解任・市場評価は `42-manager-market-and-front-office-selection-DRAFT.md` へ委譲する。

関連:
- `docs/game-design/32-roster-development-architecture-DRAFT.md`
- `docs/game-design/38-team-mood-manager-interventions-DRAFT.md`
- `docs/game-design/49-manager-architecture-v1.md`
- `docs/game-design/42-manager-market-and-front-office-selection-DRAFT.md`

---

# 1. Core Principle — Manager Employment Does Not Guarantee Competence

監督職に最低能力保証を置かない。

公開6能力:
- 采配
- 分析
- 適応
- 選手眼
- 運用
- 統率

にはD / E / F / Gが実際に存在してよい。複数軸が低い監督も存在可能。
ただしOverall Manager Ratingは持たない。

---

# 2. No `isBad` Flag

禁止:
```text
manager.isBad = true
 -> team loses
```

無能さは `49-manager-architecture-v1.md` の通常Decision Engine上で具体的な失敗として現れる。

- 采配が弱い → candidate comparison / leverage recognition / risk assessmentが弱い
- 分析が弱い → sample / uncertainty / noiseの読み違い
- 適応が弱い → failed prior / outdated policyの更新が遅い
- 選手眼が弱い → readiness / role fit / decline / improvementを誤認
- 運用が弱い → bullpen / rest / promotion / role usageが不安定
- 統率が弱い → instruction acceptance / role credibility / Manager Trust形成が弱い

能力値から勝率補正を直接掛けない。

---

# 3. Poor Manager Still Thinks

低能力監督をRandom Idiot Generatorにしない。

全Managerは通常どおり:
```text
Belief
 -> Candidate Admission
 -> Forecast
 -> Comparison
 -> Decision
```
を通る。

失敗はwrong belief / missing candidate / bad uncertainty calibration / stale prior / poor risk comparison / weak player estimate等から生じる。
Decision Logを見れば、迷采配にも本人なりの理由を追跡できる。

---

# 4. True Skill / Public Rating / Reputation Are Separate

```text
Manager True Skill
 != Public Manager Grade
 != Reputation
```

公開S〜GはEvidenceからの観測推定。
初監督・役割変更直後は不確実性が高く、`?` を許可する。

例:
```text
采配 ?
分析 B?
適応 ?
選手眼 B
運用 C?
統率 A?
```

Season / Career Evidenceが増えるにつれて評価confidenceが上がる。
CPU Clubも公開GradeをTrue Skillとして読まない。

---

# 5. Competence and Fit Are Separate

高能力監督でもRoster / Club / Eraと合わず失敗し得る。

```text
True Skill
+ Philosophy Fit
+ Roster Fit
+ Staff
+ Environment
+ Variance
        ↓
Observed Results
```

優勝 = 名将、最下位 = 無能、とはしない。
弱い監督でもElite Roster / strong staff / stable rolesなら勝てる。
優秀な監督でも弱いRosterからTalentを魔法生成できない。

---

# 6. Staff Compensation Boundary

StaffはManager Abilityを直接Buffしない。

```text
Manager Analysis E
+ Analytics Staff A
        ↓
high-quality report exists
```

その後に理解・信頼・Candidate採用・実行するかはManager側。
優秀な参謀で弱点を補う監督と、優秀Staffを無駄にする監督の両方を表現する。

---

# 7. Era Obsolescence

年齢だけでManager Skillを下げない。

```text
old priors
+ low Adaptation
+ changed rules / data / player population / meta
        ↓
belief-policy mismatch
```

から時代遅れが生じる。高齢でもAdaptationが高ければ現代野球へ対応可能。

---

# 8. Human Control Boundary

`32-roster-development-architecture-DRAFT.md` と `38-team-mood-manager-interventions-DRAFT.md` を優先する。

## HUMAN_OVERRIDE
Userが明示したBaseball decisionはManager Ratingで勝手に別Actionへ変えない。

## MANAGER_DELEGATED
おまかせDomainでは元監督のTrue Skill / Philosophy / Temperament / Belief / Strategy Memoryから通常どおり判断する。

---

# 9. Manager Special Ability Layer

6能力だけでは人物像が読みづらいため、ManagerにもBlue / Red / Goldの特殊能力表示を持てる。
ただし特殊能力はSource of Truthではない。

```text
Skill / Philosophy / Temperament / Belief / Career Evidence / actual behavior
        ↓
Manager Special Ability Descriptor
```

禁止:
```text
頑固親父 acquired
 -> Adaptation -10
```

正しくは:
```text
low Adaptation
+ very high Policy Persistence
+ repeated refusal to update failed policy
        ↓
[赤] 頑固親父
```

既存Sourceで説明可能なら、新しい特殊能力名を足しても新しいGameplay statを増やさない。

---

# 10. Red Manager Traits — v1 Initial Catalog

- **頑固親父** — 低Adaptation + 極端なPolicy Persistence + Evidence後も方針修正が遅い。
- **恐怖政治** — 実際の起用・役割・Manager Trust・background communicationの積み重ねから広範な低Trust / fear-based acceptanceが成立した状態。LabelからMood Debuffを配らない。
- **珍采配** — Novelty Appetiteが高いだけでは付かず、unusual candidate admission + weak evaluation / calibration等による低品質な非標準Decisionの反復。
- **負け運** — ANALYTIC_DESCRIPTOR。説明しきれない接戦敗北や不利な結果の偏りを要約。敗北率を変更しない。
- **聞く耳持たず** — 質の高いStaff inputを継続的に採用しにくい。
- **結果論者** — Decision qualityとOutcomeを混同し、good decision + bad resultを過剰修正しやすい。
- **実績偏重** — 現在Evidenceより過去実績・知名度を過剰評価する。
- **左右病** — 左右Matchupを他Evidenceより過剰評価する。左右起用自体は悪ではない。
- **バント病** — Bunt candidateをContext以上に過剰Admission / 選択する。バント自体へhidden penaltyは置かない。
- **完投病** — Starter continuationを疲労・Matchup・Bullpen alternativeより過剰評価する。
- **固定観念** — Lineup / role / tactical policyの変更Thresholdが不適切に高い。
- **早とちり** — Small sample / noisy evidenceからBeliefを強く更新しすぎる。

---

# 11. Blue Manager Traits — v1 Initial Catalog

- **柔軟采配** — Evidence変化に応じてPolicyを適切に更新できる。
- **臨機応変** — 想定外Contextでも有力な代替Candidateを見つけ、評価できる。
- **適材適所** — Playerの現在能力・役割・Roster contextを適切に組み合わせる。
- **慧眼** — Player readiness / role fit / improvement / declineの推定誤差が小さい。
- **抜擢上手** — 実績の少ないPlayerでも十分なEvidenceがあれば候補へ入れられる。
- **用兵上手** — Bench / Bullpen / Rest / Role等の有限Resource運用が上手い。
- **継投巧者** — Pitcher state / Matchup / future resourceを高品質に比較できる。
- **修正上手** — 失敗後に原因を取り違えず、必要なPolicyだけを更新しやすい。
- **データ活用** — Analytics / Staff Evidenceを理解しBeliefへ適切に統合できる。
- **参謀活用** — 自分の弱点をStaff inputで補える。Staff能力をManager Skillへ加算しない。
- **勝負所察知** — High-leverage situationを適切に認識し、必要なDeliberative Searchを起動しやすい。
- **役割運用○** — 無意味なRole churnが少なく、UsageとExpectationの整合が高い。
- **育成眼** — 現在能力・成長段階・適切なCompetition levelを混同しにくい。
- **切替上手** — 悪いOutcomeだけで良いPolicyを捨てず、必要Evidenceだけを更新できる。
- **クジ運○** — ANALYTIC_DESCRIPTOR。十分な履歴で実際に強いDraft lottery運が観測された時だけ表示。抽選乱数を変更しない。

---

# 12. Gold Manager Traits — v1 Initial Catalog

Goldは希少。Blueの効果倍率ではなく、極端に強いUnderlying Evidence / Career Patternの表示。

初期候補:
- 変幻自在
- 神算
- 名伯楽
- 用兵の魔術師
- 千里眼
- 不世出の策士
- **未来予知**

## 未来予知

`クジ運○` のGold counterpart。
長い抽選履歴の中で、歴史的に異常なほど強いDraft lottery運が実際に観測された場合の愛称的Descriptor。

```text
未来予知
 -> lottery RNG manipulation
```
は禁止。

```text
actual lottery history
 -> extraordinary observed luck
 -> [金] 未来予知
```

の一方向。本当に未来を読む能力ではない。

---

# 13. Trait Lifecycle

Manager特殊能力にはslow/stable descriptors / current-career descriptors / analytic luck-result descriptorsが混在してよい。

例:
```text
柔軟采配
 -> success fixation + low adaptation over years
 -> descriptor may disappear
 -> 頑固親父 may emerge
```

Traitが先にPersonを変えるのではなく、Person / Careerが変化した結果としてTrait表示が変わる。

---

# 14. Rating Distribution

- S: rare
- A: uncommon
- B/C: common professional range
- D: noticeably weak
- E/F: poor
- G: extreme weakness

ただしActive ManagerへHard Floorを置かない。
自然なCandidate / Hiring selectionで上澄みになりやすくてよいが、E/F/Gが就任することをSystem上禁止しない。
exact分布率はmulti-season soak / calibrationで決める。

---

# 15. Hiring Boundary

本書は「なぜその監督が採用されたか」を決めない。
`42-manager-market-and-front-office-selection-DRAFT.md` がCandidate Market / OB bias / former-star visibility / internal promotion / ownership preference / salary / availability / Front Office estimation / retain / extend / fire / interim appointmentを担当する。

---

# 16. Acceptance Tests

1. D/E/F/Gを含む本当に弱いManagerが存在できる。
2. low Skillがdirect loss modifierにならない。
3. low Skill ManagerもDecision Engineを通り、理由のある迷采配をする。
4. Decision Logから失敗のBelief / Candidate / evaluation原因を追える。
5. True SkillとPublic Gradeが分離される。
6. First-time Managerの公開能力に`?`を持てる。
7. Strong Manager + bad fit と Weak Manager + elite rosterを区別できる。
8. Staffは情報を改善してもManager True SkillをBuffしない。
9. HUMAN_OVERRIDEをlow Manager Ratingが改変しない。
10. MANAGER_DELEGATEDでは元監督能力が実際にDecisionへ反映される。
11. Manager特殊能力Labelを直接Gameplay modifierとして使わない。
12. `負け運` は敗北率を変更しない。
13. `クジ運○` / `未来予知` は抽選乱数を変更しない。
14. 赤特・青特・金特は既存Source / actual historyからDerivedできる。

---

# 17. Final v1 Status

**Manager Competence & Special Ability Architecture v1は2026-09-22にユーザー承認され、DESIGN FROZEN。**

```text
True Skill / Philosophy / Temperament / Belief / Career
        ↓
actual decisions / history
        ├-> baseball outcome
        └-> readable Blue / Red / Gold Manager descriptors
```

Hiring / Market / Retentionは42へ委譲する。