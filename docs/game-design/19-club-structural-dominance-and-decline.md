# Club Structural Dominance & Decline — CANONICAL v1

更新日: 2026-09-22  
状態: **CANONICAL / DESIGN FROZEN v1。2026-09-22ユーザー承認。実装前。**

> 巨大Clubの長期持続・Recovery・Declineを、L1 Structural Stateと因果的World Historyから説明するv1設計。
> Recovery Capacity / Economic Band / Crisis Level / Giant / DynastyはDerived評価であり、原因Statや直接Buffではない。

関連:
- `docs/game-design/16-club-economy-rivalry-design.md`
- `docs/game-design/17-europe-real-club-catalog.md`
- `docs/game-design/18-club-state-lifecycle.md`
- `docs/game-design/20-simple-surface-deep-simulation.md`

---

# 1. 目的

Real Madrid、Barcelona、Bayern、PSG等の巨大Clubが、数年の好調だけではなく何十年も強豪であり続けてきた理由を、ゲーム内でも説明可能にする。

禁止:

```text
BIG_CLUB = true
 -> wins more
```

採用:

```text
structural capital
+ recurring revenue
+ supporter base
+ commercial network
+ stadium / assets
+ institutional know-how
+ player attraction
+ owner / governance capacity
        ↓
persistent resource advantage
        ↓
better probability of building strong baseball rosters
        ↓
long-term sporting dominance
```

強豪の持続は魔法ではなく、複数のSlow Stateが長期間残ることから生じる。

---

# 1.1 Responsibility Boundary — CANONICAL

本書は **長期的なClub構造差がなぜ持続・上昇・崩壊するか** を所有する。

状態の時間層・保存境界は18を正とし、Structural Capitalは主にL1 Institutional Stateへ置く。

以下はDerivedでありSource of Truthではない:
- Recovery Capacity
- Economic Band
- Crisis Level
- Giant / Dynasty labels
- Collapse / Recovery descriptors

Club名・初期Catalog label・Derived descriptorをMatch CoreやBudgetへ直接フィードバックしない。

---
# 2. 現実から採るObservation

ゲーム初期設計の根拠として、欧州Footballには上位Clubの強い持続性が存在する。

- Bayern Münchenは2012/13〜2022/23にBundesligaを11季連続優勝した。
- PSGはQSIが2011年にClubを取得して以降、国内タイトルを大量に獲得している。
- UEFAの2024 club-finance landscapeでは、現在のrevenue top 20 Clubは全て2014年時点でもtop 25に入っていた。
- 2024/25のReal Madridはfootball operating revenue約€1.185bn、cash約€166m、stadium projectを除くnet debt約€12mを報告した。
- 2024/25のBayern groupはrevenue約€978m、EBITDA約€188m、net profit約€27mを報告した。
- 2024/25 Ligue 1ではPSGがLeague aggregate revenueの39%を占めた。

これらは「Club名にBuffがある」のではなく、上位Clubが長期にわたり巨大な商業・資産・人材獲得基盤を維持しているEvidenceとして扱う。

---

# 3. Structural Capital

巨大Clubの持続性を一枚の「名門度」で保存しない。

```ts
type ClubStructuralCapital = {
  supporterCapital: number;
  brandCapital: number;
  commercialNetworkCapital: number;
  stadiumAssetCapital: number;
  institutionalKnowHow: number;
  recruitmentNetworkCapital: number;
  academyKnowHow: number;
  financingAccess: number;
  ownershipBackingCapacity: number;
};
```

これらはL1 Institutional State。

毎年大きく上下しない。

`ClubStructuralCapital` を一枚の総合値へ畳み込んで原因Statにしない。各componentはそれぞれの実State / Evidenceから更新する。

---

# 4. Structural CapitalはSlow State

Supporter Capital:
- local supporter base
- national supporter base
- global supporter base
- generational loyalty

一季低迷した程度ではほぼ消えない。

Brand Capital:
- historic success
- recognisability
- star history
- global visibility
- cultural relevance

数年無冠でも急落しない。

Commercial Network Capital:
- sponsor relationships
- retail / merchandise distribution
- premium partnerships
- international commercial organisation

単年度の順位とは別に存在する。

Institutional Know-how:
- recruitment process
- sporting department quality
- contract management
- academy methods
- medical / analytics processes
- administrative competence

Staff一人が抜けても全て消えない。

---

# 5. Persistent Revenue Base

Revenueを全て前年順位から作らない。

```text
Annual Revenue
 =
 Structural Revenue Base
 + Current Sporting Revenue
 + Competition Revenue
 + Transfer Revenue
 + Short-term Commercial Variation
```

Structural Revenue Baseには:

- long-term supporter demand
- brand
- existing commercial contracts
- stadium capacity / premium inventory
- media market
- recurring sponsorship network

が入る。

したがって巨大Clubが1〜3年国内優勝を逃しても、Revenueは即座にsmall-club水準へ落ちない。

---

# 6. Sporting Success Feedback Loop

```text
strong roster
 -> wins
 -> continental qualification
 -> prize / broadcast / exposure
 -> commercial growth
 -> higher player-attraction
 -> greater retention
 -> stronger future roster
```

この循環は上位固定化を再現するため意図的に許可する。

ただし直接勝率補正にはしない。

---

# 7. Recovery Capacity — DERIVED VIEW

巨大Clubが失敗後に戻りやすい現象は認めるが、`RecoveryCapacity` を独立した因果Statとして保存しない。

Current Recovery Capacityは、実際のStateから導出する評価。

```text
recurring revenue
+ accessible cash / liquidity
+ financing access
+ player / staff attraction
+ supporter / commercial resilience
+ owner backing
- debt burden
- committed costs
- institutional damage
        ↓
Derived Recovery Capacity
```

復活の原因は上記の実Stateであり、Derived値そのものではない。

例:

```text
bad season
 -> title lost

but:
 recurring revenue remains
 financing remains available
 attraction remains high
        ↓
next recruitment cycle can rebuild roster
```

Small Clubは同じ補強失敗でも、基礎Stateが弱ければ回復に時間がかかり得る。

---
# 8. Economic Band is Derived from Sustainable Capacity

`MEGA / ELITE / HIGH...` を単年度Revenueで決めない。

候補入力:

- rolling multi-year recurring revenue
- current cash
- debt service burden
- committed wage bill
- financing access
- owner backing
- supporter / commercial structural capital
- stadium revenue capacity

```text
one bad year
 -> usually no giant-status collapse
```

Economic Bandは毎年再計算するが、入力自体がSlow Stateを多く含むため自然にinertiaを持つ。

`MEGA / ELITE / HIGH...` はL4 Derived Viewであり、翌年Budget・Recruitment・Match結果をLabel自体から強制しない。

---

# 9. Giant Club Failure Levels — DIAGNOSTIC DESCRIPTORS

これらのLevelは**観測・説明用Descriptor**。`CrisisLevel = N` 自体からRevenue / Reputation / Match Ability等へPenaltyを発生させない。

## Level 0 — Normal Bad Season

- 3位
- PS敗退
- CL逃し1回
- high-profile signing failure

巨大Clubとして普通に起こり得る。

Structural Capitalへの影響は小さい。

## Level 1 — Sporting Crisis

数年:

- titleなし
- CL逃し
- manager churn
- roster aging
- expensive recruitment failures

Revenue growth slows / some reputation declines。

しかしSupporter / Brand / Infrastructureは強く残る。

## Level 2 — Financial / Institutional Crisis

複数要素:

- high debt stress
- negative operating cash flow
- owner funding withdrawal
- severe governance failure
- repeated continental absence
- forced player sales
- failed stadium financing
- commercial contract losses

この段階で初めてStructural Capitalの一部が明確に劣化し得る。

## Level 3 — Historic Collapse

巨大ClubがLeague bottom-tier economics / sustained bottom standingsへ落ちるための候補状態。

複数年にわたり:

- major financial crisis
- institutional breakdown
- supporter / commercial erosion
- elite talent exodus
- inability to retain staff
- facility underinvestment
- repeated competitive failure

が重なる。

「30年後にBayernが恒常的最下位級」は、このLevel 3級の因果履歴を必要とする。

---


原則:

```text
actual financial / institutional / sporting state
 -> diagnostic crisis descriptor
```

であり、逆方向の `descriptor -> penalty` は禁止。

---
# 10. No Silent Collapse

巨大Clubが:

```text
MEGA -> LOW
```

へ落ちる場合、Historyから原因を説明できなければならない。

例:

```text
2032-2036  repeated bad recruitment
2037       missed Continental competition
2039       major debt refinancing failure
2040       owner / board crisis
2041-2044  forced player sales
2045       commercial contracts shrink
2048       stadium project abandoned
2050s      global fan growth stalls
2055       Academy / scouting underfunded
        ↓
structural decline
```

単純なrandom driftだけで巨大Clubを崩壊させない。

ただし因果的なWorld Eventそのものにstochastic occurrenceが含まれることは許可する。

例: owner scandal / governance failure / stadium financing failure等が発生した場合、そのEventが具体的cash / debt / contract / governance / supporter stateへ作用し、その累積結果として衰退する。

禁止:

```text
random roll
 -> StructuralCapital -40
```

---

# 11. Bottom Finish vs Structural Collapse

単年の最下位と長期的な弱小化を区別する。

Single-season bottom finishは理論上可能。

必要候補:

- catastrophic injury cluster
- disastrous roster construction
- manager failure
- extreme bad variance
- internal crisis

ただし巨大なRoster / Budgetを持つため、通常Clubより低確率。

Sustained bottom-tier statusにはStructural Capitalまで失われている必要がある。

```text
one terrible season
 != permanent collapse
```

---

# 12. Initial Structural Composition Examples — NOT PERMANENT CLUB RULES

## Bayern

主なPersistence Source候補:
- very high recurring commercial / match revenue
- domestic brand dominance
- strong institutional continuity
- player attraction
- high retention capacity
- strong financing position

特徴:
> self-sustaining institutional giant

## Real Madrid

主なPersistence Source候補:
- global supporter / brand scale
- very high commercial revenue
- stadium / matchday asset
- global player attraction
- very strong liquidity / financing capacity
- long historical prestige

特徴:
> global commercial / institutional giant

## Barcelona

主なPersistence Source候補:
- huge global brand
- supporter scale
- academy identity / know-how
- very high commercial potential

同時に:
- debt / financing risk
- stadium-project risk
- high fixed-cost risk

を持ち得る。

特徴:
> structurally giant but financially more shock-sensitive

## PSG

主なPersistence Source候補:
- owner backing capacity
- Paris market
- global commercial brand
- star recruitment power
- domestic financial gap

特徴:
> ownership-capital + commercial giant

PSGのOwner backingが消える場合はBayernよりEconomic Shockが大きくなり得る。

ただしこれは `clubId == PSG` の永久ルールではない。Career開始時に異なるStructural compositionを持つという意味。

100年後に各Clubの収益構造・Ownership依存・Institutional Stateが変化したなら、その時点の実Stateに従う。

---

# 13. Path Dependence

```text
10 years of success
 -> larger supporter base
 -> stronger sponsor network
 -> improved facilities
 -> wider scouting network
 -> better continental exposure
 -> stronger commercial position
```

逆方向もSlow。

このPath DependenceがDynastyを作る。

Dynastyは結果でありBuffではない。

---

# 14. Competitor Catch-up

Small / Medium Clubは:

```text
excellent academy generation
+ elite scouting
+ smart transfers
+ new owner investment
+ stadium expansion
+ repeated CL qualification
+ commercial growth
        ↓
structural rise
```

で巨大Clubへ近づける。

Power Shiftは:

```text
old giant collapses
```

だけでなく:

```text
challenger compounds success faster
```

でも起こる。

---

# 15. Structural Change Speed

Fast — months / one season:
- roster quality
- manager
- current cash
- injuries
- current standings
- transfer budget

Medium — 2–8 seasons:
- reputation
- commercial contracts
- player attraction
- debt burden
- sporting department quality
- current fan demand

Slow — 10–30+ seasons:
- global supporter capital
- deep brand capital
- historical prestige
- institutional know-how
- geographic market advantage

巨大Clubの30年後を決めるのはSlow Stateの蓄積。

Fast / Medium / Slowの年数はcharacteristic timescaleであり固定Timerではない。巨大な制度Shockや長期投資により通常より速い / 遅い変化もあり得る。

---

# 16. Persistence does not guarantee titles

Structural giantでも:

- bad tactics
- poor roster fit
- manager mistakes
- injuries
- rival rise

で優勝を逃す。

設計目標は:

> Bayern must always win

ではない。

> Bayern級Clubが長期的に弱小化するなら、それに相応しい構造的原因が必要

である。

---

# 17. Save History Requirement

各Season SnapshotにStructural変化も残す。

```ts
type ClubStructuralSnapshot = {
  seasonId: SeasonId;
  supporterCapital: number;
  brandCapital: number;
  commercialNetworkCapital: number;
  institutionalKnowHow: number;
  financingAccess: number;
  ownershipBackingCapacity: number;
  sustainableRevenueCapacity: Money;
  economicBand: ClubEconomicBand;
};
```

これにより300年後でも、

> なぜ2050年代にBayernが弱くなったのか

を履歴から説明できる。

---

# 18. Test Principles

- one bad season does not erase structural capital
- one missed Continental qualification does not automatically downgrade MEGA to MID
- giantClub label itself never modifies Match Core
- long dominance creates real economic / supporter feedback through accumulated outcomes
- sustained collapse requires multiple degrading states or severe structural shocks
- owner withdrawal hurts owner-dependent clubs more than self-sustaining clubs
- debt crisis hurts highly leveraged clubs more than low-debt clubs
- academy decline does not instantly remove existing first-team talent
- commercial decline does not instantly remove signed contracts
- challenger can become giant without incumbent receiving hidden debuff
- every MEGA -> LOW transition has an explainable event / state history

---

# 18.1 Player-facing Boundary

Structural Capital / Derived Recovery Capacity / Crisis DescriptorはBackground Simulation用。

通常Club UIは16 / 18 / 20 / 26の決定に従い:

```text
資金力
人気
育成
スカウト
球場・設備
```

のみを基本表示する。

必要な時だけDetail / Offseason Briefで:

```text
補強予算
人件費余裕
財政状態
```

を表示する。

`supporterCapital` / `financingAccess` / `commercialNetworkCapital` / debt-service equation / crisis diagnosis等はOptional Audit View。

ユーザーにClub survivalの会計ミニゲームを要求しない。

---
# 19. Final Approved Decisions — v1

1. Giant persistenceを複数のL1 Structural Capital componentで説明する。
2. Structural Capitalを単一名門Power / hidden Buffへ統合しない。
3. RevenueにmutableなStructural Revenue Baseを持たせ、単年度順位だけで巨大収益基盤を消さない。
4. Sporting Success feedback loopは許可するが直接勝率Buffは禁止。
5. Recovery Capacityは実Stateから算出するL4 Derived評価であり、独立因果Statではない。
6. Economic BandもDerived。
7. Crisis Level 0–3はDiagnostic DescriptorでありPenalty state machineではない。
8. Sustained bottom-tier化にはfinancial / institutional / supporter / staffing / facility等の実際の劣化履歴を要求する。
9. Random driftだけによるMEGA -> LOWは禁止。ただし因果的World Eventが具体Stateへ作用するShockは許可する。
10. Bayern / Real / Barcelona / PSG等の違いは初期Structural composition例であり、Club名による永久Persistence Ruleではない。
11. Competitorはincumbent collapseなしでもacademy / scouting / ownership / repeated success等の複利的成長で巨大Club化できる。
12. Fast / Medium / Slowはcharacteristic timescaleであり固定Timerではない。
13. Giant / Dynasty / Crisis / Recovery Capacity等のDerived Labelを原因へ逆流させない。
14. Structural changeは18のStructural Event provenance + Season Snapshotへ記録し、Rise / DeclineをHistoryから説明可能にする。
15. 通常UIは5軸 `資金力 / 人気 / 育成 / スカウト / 球場・設備`。`補強予算 / 人件費余裕 / 財政状態` はDetail / Offseason View。

---

# 20. Final v1 Status

**Club Structural Dominance & Decline v1は2026-09-22にユーザー承認され、DESIGN FROZEN。**

Remaining exact decay rates / transition thresholds / economic weights are calibration parameters and must not become hidden club-name rules.