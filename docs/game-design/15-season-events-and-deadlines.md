# Season Events & Deadlines

更新日: 2026-09-19  
状態: **設計承認候補版。実装前。**

関連:
- `docs/game-design/10-world-league-catalog.md`
- `docs/game-design/13-domestic-league-championships.md`
- `docs/game-design/14-regular-season-calendar-and-volume.md`

---

# 1. 目的

100試合以上を戦うFull Leagueに、年間を区切る分かりやすい節目を持たせる。

シーズン中イベントは増やしすぎない。

初期標準は以下の6系統。

1. Opening Day
2. All-Star Break
3. Midseason Market Deadline
4. Late-season Roster Expansion
5. Postseason Eligibility Cutoff
6. Season Awards

これらはLeague Calendar / Career World側の仕組みであり、Match Coreへ直接能力補正を掛けない。

---

# 2. 共通Calendar比率

絶対日付より、まずRegular Season進行率で定義する。

```text
0%      Opening Day
45–55%  All-Star Break
70–75%  Market Deadline
85%     Late-season Roster Expansion begins
90%     Postseason Eligibility Cutoff
100%    Regular Season ends
```

実際の日付はLeagueCalendarProfileから決める。

WBC / Premier / Club World等との衝突時は、World Competition Windowを優先する。

---

# 3. Opening Day

Regular Seasonの公式開始日。

保存するもの:

- seasonId
- opening date
- opening matchup
- starting roster snapshot
- manager / coaching staff snapshot
- initial club objectives
- initial standings state

Opening Day時点のRosterは、そのSeasonの最初の公式Club状態として履歴保存する。

ただし、その後の移籍・怪我・昇格・降格は通常どおり発生する。

---

# 4. All-Star Break

全Full Leagueに初期標準でAll-Star Eventを持たせる。

開催時期:

```text
Regular Season 45–55%
```

を目安とする。

## 4.1 Format

最初は単純にする。

- All-Star Game: 1試合
- optional Home Run Derby-like event
- optional Pitching / Skills eventは将来候補

All-Star Game自体はLeague公式記録とは別。

選手のRegular Season Statsへ混ぜない。

## 4.2 Selection

選出候補:

```text
fan vote component
+ player / coach vote
+ statistical selection
```

正確な比率は後続校正。

選手の公開Ratingだけで自動選出しない。

実際のSeason Performanceを主要Evidenceにする。

## 4.3 All-Starは能力Buffではない

選出:

- reputation
- career achievement
- popularity
- contract / market value
- historical record

等へ影響可能。

true abilityへ直接Buffしない。

---

# 5. Market Deadline

リーグごとの市場文化に合わせ、二種類へ分ける。

## 5.1 TRADE_DEADLINE

対象例:

- North America
- Japan
- Korea
- Taiwan
- Mexico
- Caribbean Hybrid leagues
- Australia

時期:

```text
Regular Season 70–75%
```

締切後:

- Club-to-Club trade不可
- deadline-trade acquisition不可
- minor / reserve promotionは可
- injury replacementは可
- free agent signingはLeagueProfile次第

Trade Deadline前には:

```text
contender
 -> buy

rebuilding club
 -> sell
```

という市場行動が発生可能。

ただしStandingsだけで機械的にBuy/Sellを決めず、

- playoff probability estimate
- club finances
- age curve
- contract years
- owner / front-office policy
- roster needs

等を使う。

## 5.2 REGISTRATION_WINDOW_CLOSE

対象例:

- Europe
- West / South Asia
- Pan-African
- China等のTransfer型League

TradeではなくPlayer Registration Windowを閉じる。

締切後は原則:

- transfer fee acquisition不可
- loan registration不可
- cross-club permanent registration不可

ただし:

- youth promotion
- emergency goalkeeper相当の野球用emergency replacement
- severe injury replacement

等の例外をLeagueProfileへ持てる。

Football Transfer市場を参考にするが、ルールはBaseball Calendarへ合わせる。

---

# 6. Late-season Roster Expansion

Regular Season終盤、おおむね残り15%からRoster登録枠を少し広げる。

目的:

- 若手prospectの一軍経験
- playoff contenderのdepth確認
- fatigue management
- injury coverage

初期設計では具体人数をまだ固定しない。

```ts
type LateSeasonRosterExpansion = {
  enabled: boolean;
  startsAtSeasonProgress: number; // default 0.85
  extraActiveSlots: number;
};
```

正確なActive Roster人数は次のClub / Roster設計で決める。

重要:

> Roster Expansionは選手能力を上げる仕組みではなく、登録可能人数が増えるだけ。

---

# 7. Postseason Eligibility Cutoff

Regular Season約90%地点で、Postseasonへ出場可能なPlayer Poolを確定する。

```text
registered before cutoff
 -> postseason eligible

registered after cutoff
 -> normally postseason ineligible
```

ただし怪我人代替は例外。

目的:

- Postseason直前だけ大量補強する抜け道を防ぐ
- Seasonを通じたRoster構築を評価する
- Cup-tied / Competition roster rulesとの整合

国内PSを持たないTABLE_TITLE Leagueでは、このCutoffをContinental roster eligibility用へ転用できる。

---

# 8. Waiver / Free Agent after Deadline

初期設計では複雑なWaiver市場を主役にしない。

Market Deadline後も最低限:

- released player
- uncontracted free agent
- emergency injury replacement

を扱える。

ただし、Postseason Eligibility Cutoff後に加入したPlayerがPSへ出られるかはLeagueProfileで制限する。

将来詳細なWaiver Rulesを追加可能だが、初期実装の必須要件にはしない。

---

# 9. All-Star Breakと休養

All-Star Breakは2〜4日のLeague Break候補。

非選出選手は通常のrest / recovery時間を得る。

選出選手はGame / travelがあるため、全員一律完全回復にはしない。

```text
not selected
 -> ordinary break recovery

selected
 -> travel + event workload + recovery
```

Fatigue Stateから因果的に処理する。

---

# 10. Season Awards

Regular Season終了後、またはDomestic Championship終了後にAward votingを行う。

League共通候補:

- Most Valuable Player
- Best Pitcher
- Rookie / Best Young Player
- Best Defender by position
- Best Batter by position
- Manager of the Year
- Comeback Player
- All-League Team

## 10.1 Evidence

Awardは:

- Season statistics
- workload
- fielding contribution
- baserunning
- leverage
- team context
- voting / media component

等から選ぶ。

公開Ratingだけで決めない。

## 10.2 Regular SeasonとPostseason

初期標準:

- League MVP等 = Regular Season中心
- Postseason MVP = 別Award
- Championship Series MVP = 別Award
- Continental / World tournament awards = 12の大会Awards

と分離する。

---

# 11. Trade / Transfer AI

Club AIはDeadline前にMarket Decisionを行う。

概念:

```ts
type ClubMarketPosture =
  | "BUY"
  | "HOLD"
  | "SELL"
  | "DEVELOP";

type MarketDecisionContext = {
  standingsState: StandingsState;
  postseasonChanceEstimate: number;
  rosterNeeds: RosterNeed[];
  prospectDepth: ProspectDepth;
  contractState: ContractState;
  financeState: ClubFinanceState;
  clubStrategy: ClubStrategyState;
};
```

重要:

```text
4th place
 -> BUY
```

のような固定if文だけにしない。

同じ順位でも、

- 老齢Win-now club
- young rebuilding club
- cash-rich contender
- low-budget seller

で判断が変わる。

---

# 12. User Interaction

ユーザーが球団を監督・GMとして操作する場合も、イベント数を増やしすぎない。

主な通知:

- All-Star selections
- Market Deadline approaching
- Deadline completed
- Roster expansion begins
- Postseason eligibility cutoff
- Awards announced

Host selectionのように、不要なWorld-side操作をユーザーへ押し付けない。

Market Deadlineではユーザー自身が補強判断を行える。

---

# 13. League Event Profiles

各Leagueは以下だけ上書き可能。

```ts
type LeagueSeasonEventProfile = {
  allStarEnabled: boolean;
  allStarProgress: number;
  marketDeadlineType:
    | "TRADE_DEADLINE"
    | "REGISTRATION_WINDOW_CLOSE";
  marketDeadlineProgress: number;
  rosterExpansionEnabled: boolean;
  rosterExpansionProgress: number;
  postseasonEligibilityProgress: number;
};
```

初期default:

```text
All-Star              50%
Market Deadline       72%
Roster Expansion      85%
PS Eligibility Cutoff 90%
```

---

# 14. Market Type Mapping

初期の大分類:

| League family | Deadline type |
| --- | --- |
| North America | Trade Deadline |
| Japan / Korea / Taiwan | Trade Deadline |
| Mexico / Caribbean | Trade Deadline / Hybrid |
| Europe 7 | Registration Window Close |
| China | Registration Window Close |
| West / South Asia | Registration Window Close |
| Pan-African | Registration Window Close |
| Australia | Trade Deadline / Hybrid |
| NZ / Pacific | Registration Window Close |

細かなLoan / FA例外はPlayer Market実装時に決める。

---

# 15. Historical Records

Season Historyへ保存:

- Opening Day roster
- All-Star selections
- All-Star MVP
- deadline trades / transfers
- roster expansion promotions
- awards
- postseason eligibility roster
- manager / GM market posture snapshot

300年SimulationでもSeason Summaryから重要イベントだけ復元できるようにする。

---

# 16. 今回確定する事項

1. Full League共通のSeason Eventは6系統に絞る
2. All-StarはRegular Season中間付近
3. Market Deadlineは70〜75%
4. Market文化に応じTrade Deadline / Registration Windowを分ける
5. Late-season Roster Expansionを85%付近に置く
6. Postseason Eligibility Cutoffを90%付近に置く
7. All-Star / Awardsは公開Ratingだけで決めない
8. All-Star Breakで全員を完全回復させない
9. Deadline後のWaiver詳細は初期必須要件にしない
10. AwardはRegular Season / Postseason / Internationalで分離
11. Market AIは順位だけでBUY / SELLを決めない
12. Roster人数そのものは次のClub / Roster設計で確定する

---

# 17. 次フェーズ — Club Design

基礎設計:

- `docs/game-design/16-club-economy-rivalry-design.md`

この文書完了後、次の設計対象を**球団そのもの**へ移す。

候補:

- club identity
- city / home region
- stadium
- ownership
- budget class
- fanbase
- reputation
- front office
- manager / coaching staff
- active roster
- reserve / farm / academy
- scouting
- medical / training facilities
- philosophy
- rivalries
- club history
- expansion / relocation

ただし全部を一度に作らず、まず`ClubProfile`のsource-of-truth境界から決める。
