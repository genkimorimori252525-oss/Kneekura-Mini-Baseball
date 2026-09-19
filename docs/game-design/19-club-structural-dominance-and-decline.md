# Club Structural Dominance & Decline

更新日: 2026-09-20  
状態: **設計承認候補版。強豪の長期持続性と崩壊条件。実装前。**

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

# 7. Recovery Capacity

巨大Clubは失敗しても戻りやすい。

```ts
type ClubRecoveryCapacity = {
  sustainableRevenueCapacity: number;
  accessibleLiquidity: number;
  financingAccess: number;
  playerAttraction: number;
  staffAttraction: number;
  supporterTolerance: number;
  commercialResilience: number;
};
```

例:

```text
bad season
 -> no title

but:
 large recurring revenue remains
 global reputation remains
 high wages still affordable
 elite player attraction remains
        ↓
next recruitment cycle can repair roster
```

Small Clubは同じ補強失敗でも資金回復に時間がかかる。

---

# 8. Economic BandはSustainable Capacityから算出

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

---

# 9. Giant Club Failure Levels

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

# 12. Club-specific Persistence Profiles

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

# 18.1 Player-facing boundary

本書のStructural Capital / Recovery Capacity / Crisis Levelは、原則としてBackground Simulation用。

ユーザーに:

- supporterCapital
- financingAccess
- commercialNetworkCapital
- debt-service model
- crisis equation

等を直接操作させない。

ユーザー画面では必要に応じて:

```text
資金力
人気
育成
スカウト
財政状態
補強予算
```

等へ要約する。

詳細値は検証用 / 詳細閲覧用であり、通常Gameplayの必須理解項目にしない。

# 19. 今回確定する事項

1. Giant persistenceをStructural Capitalで説明する
2. Structural Capitalは複数Slow Stateであり単一名門Buffではない
3. RevenueにStructural Revenue Baseを持たせる
4. Economic Bandはsingle-year revenueだけで決めない
5. 巨大ClubはRecovery Capacityが高い
6. 1〜3年の低迷だけでは巨大基盤は大きく崩れない
7. Sustained bottom-tier化にはLevel 3級の複合崩壊を要求する
8. MEGA -> LOWをrandom driftだけで発生させない
9. Bayern / Real / Barcelona / PSGでPersistence Sourceを分ける
10. 強豪を倒す方法は incumbent collapse だけでなく challenger growth も認める
11. Long-term structural changeは10〜30年以上の時間軸を持ち得る
12. 全ての大転落はHistoryから説明可能にする
