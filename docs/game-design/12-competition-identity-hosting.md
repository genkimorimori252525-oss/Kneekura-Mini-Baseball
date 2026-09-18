# Competition Identity, Hosting & Draw Design

更新日: 2026-09-19  
状態: **設計候補版。実装前。**

関連:
- `docs/game-design/10-world-league-catalog.md`
- `docs/game-design/11-world-competition-architecture.md`
- `docs/game-design/13-domestic-league-championships.md`
- `docs/superpowers/specs/2026-09-17-league-ecology-design.md`

---

# 1. 目的

世界大会を単なる「参加チーム数とトーナメント表」にせず、それぞれ異なる大会体験として成立させる。

本書では以下を扱う。

- hosting model
- home / away / neutral venue
- draw / seeding
- final-stage presentation
- awards
- prestige history
- host rotation
- revenue / solidarityの基本方向

Match Coreの能力値は変更しない。

---

# 2. 大会ごとの基本的な性格

## Continental Club Champions

役割:

> 毎年、同じ地域の異なるLeague Ecologyが直接ぶつかるクラブ最高峰。

特徴:

- 毎年開催
- club identityを強く出す
- Group Stageは各クラブの本拠地を使用
- Knockoutはsingle game
- Semifinal / FinalはFinal Four方式
- League / Club coefficientが抽選へ影響

## Club World Championship

役割:

> 4年間のクラブ世界を一か所へ集めて世界王者を決める祭典。

特徴:

- 4年に1回
- host region / host country制
- 原則集中開催
- 16 clubs
- Knockoutはsingle game
- host city群で世界大会らしいfestivalを作る

## Regional National Championship

役割:

> 地域王者決定 + WBC主要予選。

特徴:

- 代表戦
- rotation host
- single-game knockout
- 地域内の新興国にも舞台を与える

## Premier 12-class

役割:

> 現時点のWorld Ranking上位12代表だけが出るElite Invitational。

特徴:

- 予選なし
- qualification itself = prestige
- hostは1〜2か国
- short elite tournament

## WBC-class

役割:

> 代表野球の世界最高峰。

特徴:

- 24 nations
- 4年に1回
- qualificationもsingle-game elimination
- 複数host / pool host可能
- Final Stageは象徴的な一都市へ集約

---

# 3. Continental CL — Group Stage Hosting

Asia / Americas / Europeの16-club大会を基準とする。

各クラブはGroup Stageで3 opponentsと3-game seriesを1回ずつ戦う。

## 3.1 Home series allocation

各clubは原則:

```text
3 series
 -> 1 home
 -> 1 away
 -> 1 draw-assigned home/away
```

となる。

したがって1editionでは:

- 2 home + 1 away
または
- 1 home + 2 away

のどちらか。

## 3.2 Multi-year balancing

一大会だけの完全対称性より、複数seasonでbalanceする。

`ContinentalHomeCredit` を保持。

```text
club receives 2 home series
  -> home credit decreases

club receives 1 home series
  -> home credit increases
```

翌edition以降のdrawで優先補正する。

Club coefficientが高いからhome seriesを多く与える、という恒久優遇は禁止。

## 3.3 Venue

原則として所属clubの通常home stadium。

ただし:

- stadium licensing failure
- safety / travel issue
- weather
- exceptional capacity rule

の場合はapproved alternate venueを使用可能。

StadiumProfileは実際のMatch Physicsへ入力される。

---

# 4. Continental CL — Draw

## 4.1 Seeding pots

16 clubs:

```text
Pot 1: 4
Pot 2: 4
Pot 3: 4
Pot 4: 4
```

ClubCoefficientによりpotsを作る。

defending championは原則Pot 1。

## 4.2 Draw constraints

可能な限り:

- 同じLeagueから同じGroupへ2クラブを入れない
- 同一Groupの地域移動負荷が極端になりすぎない
- Potごとに1club

ただし資格クラブ構成上不可能な場合はconstraintを段階的に緩和する。

League strengthそのものを抽選に使わず、actual competition results由来のCoefficientを使う。

---

# 5. Continental CL — Knockout Hosting

## 5.1 Quarterfinal

Group winner vs Group runner-up。

- same Group rematchは可能な限り回避
- Group winnerが**home club**
- single game

これによりGroup Stage 1位になる明確な価値を作る。

ただしhome advantageはStadium / crowd / travel等の実際の環境から生じ、hidden Buffを与えない。

## 5.2 Final Four

Semifinal + Finalは一つの**Final Four Host City**へ集約する。

```text
4 clubs arrive
 -> SF A
 -> SF B
 -> Final
```

全試合single game。

3位決定戦は原則行わない。

### Host selection

Final Four hostはedition開始前に決定。

候補評価:

- stadium quality
- capacity
- transport
- accommodation
- broadcast readiness
- regional rotation
- prior hosting frequency

host clubがFinal Fourへ進んでもhome ability Buffはない。

StadiumProfile / crowd composition等の現実的環境のみ作用する。

---

# 6. Africa / Oceania Continental CL

8-club大会。

Group Stage:

```text
2 groups x 4
3-game series vs each opponent
```

Group hostingは、移動費を抑えるため **Group Hub** 方式を初期標準とする。

各Groupを一都市で集中開催。

Semifinal / FinalはそのeditionのFinal Host Cityへ移動、または同一hubで継続。

長期的に経済規模が成長した場合、club-home modelへ移行可能。

---

# 7. Club World Championship Hosting

## 7.1 Centralized host model

Club WorldはCLとは違い、原則**集中開催**。

一つのhost country / host region内の複数都市を使用。

```text
16 clubs
 -> 4 Group Hubs
 -> Quarterfinal venues
 -> Final Four City
```

## 7.2 Host rotation

5 Regions:

- Asia
- Americas
- Europe
- Africa
- Oceania

をrotation candidateとする。

完全な固定輪番ではなく:

```text
regional rotation priority
+ hosting capability
+ previous hosting recency
+ infrastructure
```

で選ぶ。

同地域連続開催には強いpenaltyを与える。

## 7.3 Host berth

Host Regionへ1枠。

host nation / host leagueの未出場最上位clubを基本とする。

詳細は11のQualification Ruleを正とする。

---

# 8. Club World Draw

16 clubsを4potsへ。

Pot判定:

- continental champion status
- defending Club World champion
- 4-year WorldClubCoefficient

を使用。

Draw constraints:

- 同一League同Groupを可能な限り回避
- 同一Regionは1Group最大2club
- 4大陸以上が各Groupへ入ることを目標にするが、資格構成上のhard requirementにはしない

世界大会なので地域間対戦を最大化する。

---

# 9. Club World Knockout

Group Stage:

- 3-game series
- each club 9 games

Knockout:

- QF single game
- SF single game
- Final single game

## Quarterfinal

原則としてGroup winnerをseeded sideとして扱う。

大会が集中開催なので「home stadium」は存在しない。

代わりに:

- Group winner gets preferred rest day
- higher seed gets dugout / batting-order administrative choice where RuleProfile permits

等の**競技規則上の小さなseed benefit**だけを設定可能。

能力Buffは不可。

## Final Four

SF + Finalを象徴的なFinal Venueへ集約。

Club World Finalはシリーズではなく一夜で世界王者を決める。

---

# 10. Regional National Championships

## 10.1 Host

原則1か国、または共同開催。

各regionでhosting rotationを持つ。

Full Leagueを持たない国でも、stadium / logistics要件を満たせば開催可能。

## 10.2 Draw

World Rankingではなく **Regional Ranking + previous regional results** を中心にseeding。

hostはPot 1相当候補だが、能力値は変更しない。

## 10.3 Knockout

全てsingle game。

代表戦は「強豪が毎回確実に勝つ」より、短期決戦の圧力と歴史的upsetを許容する。

---

# 11. WBC Global Qualifier Hosting

16 nationsを4つの4-team Podへ。

各Pod:

```text
Semifinal A
Semifinal B
Final
```

全試合single game。

## Host model

4 Podを別都市 / 別国で開催可能。

Host selectionでは:

- geography
- travel cost
- stadium
- neutral accessibility
- developing-baseball opportunity

を考慮。

Host nationがQualifier参加国であってもよい。

host advantageは実際のstadium / crowd / travelのみ。

---

# 12. WBC Finals Hosting

## 12.1 Pool Stage

24 nations = 6 groups x 4。

6つのPool Host Cityを使える。

1か国集中、複数国共同開催の両方をCompetitionProfileで許可。

## 12.2 Round of 16 / Quarterfinal

地域別の2〜4 knockout hubsへ集約。

## 12.3 Final Four

Semifinal + Finalは**World Final City**へ集約。

4年に一度、一都市が世界野球の中心になる。

Finalはsingle game。

---

# 13. Premier 12 Hosting

12 nations。

2 groups x 6。

初期標準:

- Group A Host City
- Group B Host City
- Final Four City

1国または2国共同開催可能。

WBCよりcompactで、elite-onlyの大会感を出す。

---

# 14. Host Selection — Simple Automatic Score

開催地選定はユーザー操作対象にしない。

大会主催側が、開催候補都市の既存データから `HostScore` を自動計算し、上位候補から開催地を決定する。

初期候補:

```ts
type HostScoreInput = {
  stadiumQuality: number;
  stadiumCapacity: number;
  transportQuality: number;
  accommodationCapacity: number;
  broadcastReadiness: number;
  hostingRecencyPenalty: number;
};
```

初期の重み候補:

```text
stadiumQuality       30
stadiumCapacity      20
transportQuality     15
accommodation        15
broadcastReadiness   15
hostingRecency        5
-----------------------
total               100
```

`hostingRecency` は最近同じ都市・地域で開催された場合の減点として扱う。

最終的な開催地はCompetition Organizer AI / deterministic ruleが決める。

ユーザーは:

- 入札しない
- 開催都市を直接選ばない
- Host Scoreへ資金を投入しない
- 開催権獲得のための別ミニゲームを行わない

開催地決定はWorld Simulationの背景処理とする。

また、開催成功を直接:

```text
crowd
 -> sponsor
 -> academy growth
```

へ自動接続する仕組みは初期設計から外す。

将来Career Economyで必要になった場合のみ、開催収益や観客実績を通常の経済入力として再検討する。

開催そのものがLeague Ecologyや選手能力を直接成長させることはない。

---

# 15. Competition Awards

大会ごとにAwardsを保存する。

共通候補:

- Tournament MVP
- Best Pitcher
- Best Batter
- Best Defender
- Best Catcher
- Best Young Player
- All-Tournament Team

## 15.1 Award selection

単純な公開Ratingで選ばない。

候補Evidence:

- tournament statistics
- leverage-weighted performance
- fielding contribution
- baserunning contribution
- pitching workload / quality
- iconic PlayCapsules
- championship-stage performance

Popularity / media voteを一部加えるCompetitionも許可する。

ただしAward受賞自体が翌試合の能力Buffにはならない。

---

# 16. Historical Identity

Competitionは年を重ねるほどHistoryを持つ。

保存候補:

- founding year
- editions
- champions
- runner-up
- host cities
- attendance / audience summaries
- famous upsets
- iconic finals
- records
- dynasties
- club / nation rivalries

## 16.1 CompetitionPrestigeState

```ts
type CompetitionPrestigeState = {
  institutionalAge: number;
  continuity: number;
  starParticipation: number;
  audienceReach: number;
  financialScale: number;
  historicalMomentScore: number;
  regionalImportance: number;
};
```

Prestigeは時間と歴史から変化できる。

ただしCompetitionのcanonical roleは別。

例:

```text
WBC-class
canonicalRole = NATIONAL_WORLD_CHAMPIONSHIP
```

であり、一時的にPrize PoolやAudienceが下がっても「代表世界最高峰」というRoleを失わない。

---

# 17. Rivalries

同じclubs / nationsが大舞台で繰り返し対戦するとRivalry Historyを形成できる。

入力例:

- repeated knockout meetings
- finals
- close games
- controversial calls
- player transfer history
- geographic / historical sporting rivalry

Rivalryは:

- fan interest
- media importance
- MatchImportance
- Relationship / appraisal

へ作用可能。

true abilityへのBuffは禁止。

---

# 18. Broadcast & Revenue Identity

大会ごとにbroadcast modelを持てる。

Continental CL:

- club home match revenue
- central broadcast pool
- participation money
- performance money
- solidarity pool

Club World:

- centralized global broadcast
- host revenue
- participation fee
- advancement fee
- champion fee
- regional solidarity

National competitions:

- federation revenue
- player bonus
- national development fund
- insurance / release compensation

具体率はCareer Economy設計へ委譲。

---

# 19. Visual / Presentation Identity

Mini / NaturalどちらでもCompetition identityを共通metadataから表示する。

候補:

- trophy id
- logo / badge
- anthem / intro cue
- scoreboard frame
- field-side branding
- championship banner
- medal / celebration assets

Presentationは正史を観測するだけで、Match Coreへ影響しない。

---

# 20. 初期採用方針

以下を初期標準とする。

1. Continental CL Group Stageはclub stadium
2. Continental CL QFはGroup winner home
3. Continental CL SF / Finalはneutral Final Four
4. Africa / Oceaniaは初期Group Hub方式
5. Club Worldは集中開催
6. Club World SF / FinalはFinal Four City
7. WBC Qualifierは4つのsingle-elimination Pod
8. WBCはPool Hosts + Final City
9. Premier 12は2 Group Hosts + Final Four
10. Hostingは既存インフラから算出する自動Host Score + recent-hosting penalty
11. 大会Awardsを歴史保存
12. PrestigeはHistoryから変化するがcanonical roleとは分離

---

# 21. 後続で決める事項

- 大会の最終正式名称
- trophy名称・意匠
- Host Score exact weights
- home-credit balancing weight
- Quarterfinal rematch constraints
- exact rest-day rules
- broadcast distribution percentage
- award voting weights
- audience / fan simulation
- rivalry threshold
