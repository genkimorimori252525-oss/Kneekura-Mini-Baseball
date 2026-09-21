# Manager Real-world Tactical Stress Tests — VALIDATION CATALOG

> **VALIDATION ONLY — NOT A CURRENT DESIGN PLAN**  
> これは `49-manager-architecture-v1.md` を実例で検証するための履歴カタログ。USER REVIEW REQUIREDな未確定計画として数えない。

> **Manager Architecture v1 canonical note:** This file is now **VALIDATION CATALOG**.
> Canonical Manager semantics are defined by `docs/game-design/49-manager-architecture-v1.md`.
> If this file conflicts with v1, the canonical v1 document wins.


更新日: 2026-09-20  
状態: **VALIDATION CATALOG。設計候補ではない。Canonical Manager semanticsは `49-manager-architecture-v1.md` を正とする。**

目的:
実在の名采配・珍采配・役割設計を、Mini BaseballのManager Architectureで「専用イベントなし」に説明できるか検証する。

重要:
- historical label自体をBuffにしない
- famous outcomeを再現するのではなく、同じDecision Mechanismを再現する
- successful tacticとfailed tacticの両方を扱う
- Managerだけで結果を確定しない

---

# 1. Stress-test Principle

各史実について最低限:

```text
Observed Context
+ Manager Belief
+ Manager Philosophy
+ Legal Actions
+ Player / Staff State
+ Risk / Horizon
        ↓
Manager Decision
        ↓
Player Intent / Role / Position
        ↓
Canonical Match Simulation
        ↓
Outcome
```

で説明できること。

名前付きSpecial Eventで再現しない。

---

# 2. 栗山英樹 — 1番・投手 大谷翔平

史実Stress Test:
2016-07-03、日本ハムは大谷翔平を「1番・投手」で起用。大谷は初回先頭打者本塁打を放ち、投手としても勝利。

Required mechanics:

- two-way player eligibility
- DHを使用しないLineup option
- lineup optimizer must not assume pitcher bats ninth
- Player batting value + pitching value considered separately
- unusual lineup allowed without named tactic unlock
- Manager belief may value first-PA advantage / extra PA opportunity
- same player contributes to both offensive and pitching state

No buff:
```text
栗山Trait -> 大谷HR
```
は禁止。

---

# 3. 落合博満 — 山井から岩瀬への9回継投

史実Stress Test:
2007 Japan Series Game 5。山井大介は8回24人完全。1-0の9回に岩瀬仁紀へ継投し、3人で締めて継投完全試合、日本一。

Required mechanics:

- milestone / record value
- championship win value
- one-run lead risk
- closer trust / established role
- pitcher current condition
- series horizon
- manager objective weighting

Decision:
```text
record opportunity
vs
win-certainty estimate
vs
established closer policy
```

を比較できる。

---

# 4. 星野仙一 — 前日160球の田中将大を第7戦9回へ

史実Stress Test:
2013 Japan Series Game 7。田中将大は前日の第6戦で160球完投後、第7戦9回に救援登板し日本一決定。

Required mechanics:

- previous-day workload
- fatigue / injury-risk estimate
- championship elimination context
- player willingness / request
- manager trust in player
- symbolic / leadership salience as secondary objective
- current lead and available relievers

Important:
Player willingness does not erase fatigue.

```text
"行きたい"
 !=
fatigue = 0
```

Manager accepts additional risk.

---

# 5. 渡辺久信 — 岸孝之を中2日でロング救援

史実Stress Test:
2008 Japan Series Game 4で完封勝利した岸孝之を、第6戦で中2日救援。3回途中から5.2回無失点で勝利し、第7戦へつないだ。

Required mechanics:

- postseason multi-game resource horizon
- starter available as emergency reliever
- rest / fatigue estimate
- elimination-game urgency
- next-game resource cost
- role override

Pitcher roles must be soft roles, not legal class restrictions.

---

# 6. 長嶋茂雄 — 10.8三本柱継投

史実Stress Test:
1994年10月8日の優勝決定直接対決で、巨人は槙原寛己、斎藤雅樹、桑田真澄の先発三本柱を継投投入。

Required mechanics:

- championship-equivalent leverage
- roster-wide availability override
- recent workload
- ace trust
- emergency bullpen conversion
- one-game horizon

```text
ordinary rotation preservation
        ↓
title-deciding game
        ↓
future-value weight collapses
        ↓
best available arms now
```

---

# 7. 梨田昌孝 — 代打・北川博敏

史実Stress Test:
2001-09-26、優勝マジック1の近鉄が9回無死満塁、3点差で古久保健二の打順に北川博敏を代打。北川が逆転サヨナラ満塁優勝決定本塁打。

Required mechanics:

- bench hitter evaluation
- catcher substitution consequence
- current offensive need
- inning / score / base state
- recent player form as uncertain evidence
- replacement defense cost becomes nearly irrelevant in walk-off context

Outcome remains physical:
```text
pinch-hit decision
 -> batter intent / matchup
 -> contact physics
 -> HR
```

not:
```text
名采配 -> HR guaranteed
```

---

# 8. 原辰徳 — 内野5人シフト

史実Stress Test:
2014-07-11 巨人対阪神。1死二、三塁で外野手を内野へ入れる5人内野を採用。相手は代打で対応し、最終的に無人に近い外野へ打球が落ち失点。

Required mechanics:

- arbitrary defensive world coordinates
- defensive alignment change between pitches
- outfielder can enter infield zone
- uncovered-zone risk
- batter / opponent substitution response
- manager can update or fail to update after opponent counter
- data uncertainty
- unsuccessful innovations are legal

This is critical:
```text
unusual tactic
 != hidden advantage
```

---

# 9. 工藤公康 — 第2先発 / 日替わりスタメン / 強打者へのバント

史実Stress Test:
2018 postseasonで工藤監督は「第2先発」、試合ごとのスタメン変更、内川へのバント等を積極採用したとホークス公式が整理。

Required mechanics:

- secondary-starter role
- postseason roster horizon
- flexible lineup policy
- batter role override
- player-specific bunt feasibility
- matchup-dependent selection
- Game Plan can override Default Philosophy

---

# 10. ボビー・バレンタイン — 極端な日替わり打線

史実Stress Test:
2005ロッテはRegular/Postseasonを通じ極めて多数のLineup variationを使用。選手証言では、打順ごとに具体的な相手配球 / 走者との組み合わせ意図も説明された。

Required mechanics:

- lineup churn philosophy
- matchup model
- rest / fatigue policy
- player condition estimate
- batting-order interaction
- explicit role explanation
- high Communication can protect Role Harmony under frequent lineup changes

Important:
```text
lineup churn
 -> automatic Mood penalty
```
は禁止。

---

# 11. 岡田彰布 — JFK

史実Stress Test:
2005阪神はJeff Williams / 藤川球児 / 久保田智之の強力なリリーフ構造を運用。藤川は岡田監督の意向で本格的に救援へ転向。

Required mechanics:

- role reassignment over season
- reliever specialization
- setup / closer role definition
- repeated success increases Manager belief
- bullpen availability / fatigue
- role clarity
- stable tactical policy can become Team identity

JFKはNamed BuffではなくDerived Descriptor。

---

# 12. バレンタイン — YFK

史実Stress Test:
2005ロッテは薮田安彦 / 藤田宗一 / 小林雅英の救援パターンを形成。球団自身が「勝利の方程式YFK」と整理。

Required mechanics:

- multiple setup roles
- opponent-handedness / inning context
- bullpen communication
- rest practices
- role learning
- repeated deployment

Again:
YFK label is derived from actual usage.

---

# 13. 近藤貞雄 — スーパーカートリオ

史実Stress Test:
1985大洋で高木豊 / 加藤博一 / 屋鋪要を上位へ並べ、積極的に走らせた。高木証言では「いくら刺されてもいいから走れ」という強い方針。

Required mechanics:

- lineup clustering by speed / OBP / role
- team-level Green Light directive
- steal-attempt threshold reduction
- no-sign autonomy
- individual runner perception of pitcher tells
- manager accepts caught-stealing cost
- strategy can be ballpark / roster driven

This is a prime example of Soft Directive:
```text
Manager:
  "積極的に走れ"

Runner:
  reads pitcher / catcher
  chooses actual start
```

---

# 14. 緒方孝市 — タナキクマル / Role Clarity

史実Stress Test:
2016広島では田中広輔1番、菊池涼介2番、丸佳浩3番がほぼ固定。緒方本人は役割を明確にしたことが打線を「線」にしたと後に説明。

Required mechanics:

- stable lineup policy
- role expectation
- player profile fit
- relationship / coordination evidence
- repeated shared reps
- Role Harmony
- no direct fixed-lineup buff

Different from Team Trait:
Manager creates repeated conditions;
actual success / shared experience can later support Team Traits.

---

# 15. 緒方孝市 — 2016日本シリーズのバスター / スクイズ / 重盗

史実Stress Test:
2016 Japan Series序盤で、バスター、送りバント、セーフティースクイズ、重盗など複数の攻撃手段を局面ごとに切り替えた。

Required mechanics:

- Hard Sign: squeeze / double steal
- Soft or prepared action: bunt-to-buster
- count-specific tactical change
- opponent response
- runner coordination
- manager risk tolerance
- immediate-command layer

---

# 16. 野村克也 — 遠山 / 葛西スペシャル

史実Stress Test:
1999阪神では左右の打者に応じ、遠山奬志と葛西稔を投手 / 一塁間で入れ替える特殊運用を実施。

Required mechanics:

- era-specific RuleEngine
- pitcher may move to legal field position
- later return to mound when rule permits
- arbitrary defensive role assignment
- matchup specialization
- substitution preservation
- player fielding ability outside primary position
- roster slot optimization

This is a major RuleEngine stress test.

---

# 17. 野村克也 — 松井キラー遠山

史実Stress Test:
野村自身の回想では、遠山を左のワンポイントとして使い、松井秀喜対策としてシュート習得やサイドスロー化まで行った。

Required mechanics:

- opponent-specific scouting
- long-term training suggestion
- repertoire / delivery development
- matchup belief
- repeated evidence
- targeted tactical role

Manager can influence development plans,
but cannot instantly grant a pitch.

---

# 18. 王貞治 — ノーヒット投手へ代打

史実Stress Test:
1999 Japan Series Game 3。ダイエーの永井智浩が6回まで無安打無得点だったが、7回攻撃で王監督は得点機に代打を送り、通常の勝ちパターン継投へ移行。

Required mechanics:

- record pursuit vs game objective
- DH-rule difference by venue
- pitcher batting opportunity cost
- bench offense
- bullpen confidence
- preplanned relief simulation
- series win priority

落合2007とは別経路で同じDecision Spaceへ到達できる。

---

# 19. 西本幸雄 — 江夏の21球 / スクイズ

史実Stress Test:
1979 Japan Series Game 7、1点差9回1死満塁で石渡茂にスクイズ。江夏豊に察知され外され、三走が挟殺。

Required mechanics:

- manager squeeze sign
- batter bunt intent
- runner launch timing
- pitcher/catcher perception of squeeze cues
- pitchout / emergency waste-pitch reaction
- deception / sign leakage
- outcome physics

Critical:
Opponent Manager need not know the sign.
Pitcher / Catcher may infer it from observable cues.

---

# 20. Success and Failure Share One Engine

名采配と迷采配を別Systemにしない。

```text
same decision architecture
+ different belief quality
+ different context
+ different opponent response
+ variance
        ↓
"名采配" or "迷采配"
```

Historical label is retrospective narrative.

---

# 21. New Requirements Revealed by Stress Tests

Current Manager architecture should add / explicitly preserve:

1. Series Horizon / Multi-game Resource Planning
2. Milestone / Symbolic Objective as secondary Manager objective
3. Player Willingness / Request as advisory input
4. Arbitrary Defensive Alignment at world-coordinate level
5. Alignment changes between pitches when legal
6. Opponent Counter-action after seeing alignment / lineup
7. Era-specific substitution / defensive-position legality
8. Pitcher-to-field-position and return-to-mound support where rules permit
9. Team-level Green Light / autonomy directives
10. Strategy evidence based on intermediate outcomes, not only wins
11. Player role reassignment over time
12. Manager-directed development suggestions without instant skill grants
13. Sign inference / tactical deception
14. Named historical strategies remain Derived Descriptors

---

# 22. Acceptance Standard

Manager architecture is sufficiently expressive when all cases above can occur through ordinary legal decisions without case-specific scripted bonuses.

Especially important:

```text
1番投手
完全試合中の継投
前日160球Aceの救援
中2日StarterのLong Relief
内野5人
投手↔一塁の往復
Green Light盗塁軍団
固定Bullpen Unit
日替わり打線
スクイズを見破られる
```

が同じ generic systemから出ること。


Manager decision engine / temperament (USER REVIEW REQUIRED):
- `docs/game-design/45-manager-decision-engine-and-temperament-DRAFT.md`


---

# 23. Decision Engine Stress-test Mapping

Real-world examples are now expected to pass through the generic Decision Engine:

```text
Trigger
 -> Belief
 -> Legal Actions
 -> Candidates
 -> Forecast
 -> Objectives / Horizon
 -> Risk / Philosophy / Temperament
 -> Decision
 -> Player response
 -> Match Core
```

Especially:
- 内野5人: extreme one-run objective + spatial risk tradeoff
- 山井→岩瀬: championship + record + closer trust
- 田中救援: title horizon + health cost + player request
- 10.8: future resource value collapse
- スクイズ: hard sign + opponent inference
- Green Light: soft directive + player autonomy

詳細:
- `docs/game-design/45-manager-decision-engine-and-temperament-DRAFT.md`