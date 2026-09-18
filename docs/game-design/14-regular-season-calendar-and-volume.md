# Regular Season Calendar & Game Volume

更新日: 2026-09-19  
状態: **設計承認候補版。実装前。**

関連:
- `docs/game-design/10-world-league-catalog.md`
- `docs/game-design/11-world-competition-architecture.md`
- `docs/game-design/12-competition-identity-hosting.md`
- `docs/game-design/13-domestic-league-championships.md`

---

# 1. 目的

21 Full Leaguesについて、Regular Seasonの:

- 試合数
- 開催期間
- 週あたり試合密度
- series構成
- Postseason用window
- Continental / National Competitionとの接続

を定義する。

設計目標は「全リーグを同じ長さにする」ことではない。

Leagueごとに:

```text
season length
+ competition culture
+ climate / geography
+ postseason structure
+ continental calendar
```

を組み合わせ、異なる年間リズムを持たせる。

---

# 2. 恒久原則

## 2.1 Season WindowとRegular Season Windowは分ける

例えば:

```text
League season: March–October

Regular Season: March–September
Postseason: October
```

のように扱う。

`LeagueSeasonWindow` はRegular Seasonだけでなく、Postseason / tiebreak / make-up dateを含む。

## 2.2 World Competition Windowが優先

11で定義した優先順位を維持する。

WBC / Club World / Premier 12 / Regional National Championship等と衝突する場合:

- Opening Day shift
- scheduled league break
- makeup date
- continental flex window

で解消する。

試合を二重登録しない。

## 2.3 International participationで国内試合数を自動削減しない

CLへ出場したClubだけRegular Seasonを少なくする方式は採らない。

必要な休養・移動はcalendar breakとoff-dayで吸収する。

## 2.4 Fatigueは日程から因果的に発生する

```text
dense schedule
 -> less recovery time
 -> fatigue state
 -> actual player decisions / movement / performance
```

とする。

`gamesPerWeek`を直接能力Debuffへ変換しない。

## 2.5 Full LeagueはRegular Season最低100試合

Full Simulation Leagueでは、年間成績を能力評価・スカウティング・記録比較に十分使いやすくするため、Regular Seasonを原則 **100試合以上** とする。

理由:

- batting average / OBP / SLG等の短期ブレを抑える
- pitcher ERA / K / BB等を長期サンプルで観測できる
- counting statsにSeasonとしての厚みを持たせる
- Player Knowledge / Scout EstimateのEvidence量を確保する
- 1〜2か月の好不調だけで年間評価が決まりにくくする

これは「100試合で真の能力が完全に分かる」という意味ではない。

Match Coreは一試合ごとの因果を維持し、Season Statisticsはその結果を蓄積した観測値である。

球団数に応じたbalanced scheduleの基準候補:

```text
6 clubs  -> 100 games = 5 opponents x 20
8 clubs  -> 112 games = 7 opponents x 16
10 clubs -> 108 games = 9 opponents x 12
12 clubs -> 110 games = 11 opponents x 10
16 clubs -> 120 games = 15 opponents x 8
```

North America等、既にこれより長いLeagueはその文化を維持する。

## 2.6 試合数はLeague Identity

162-game leagueと42-game leagueは同じ「年間成績」の意味を持たない。

記録比較では:

- raw totals
- rate stats
- era / league context
- games played

を区別する。

---

# 3. Schedule Density Classes

全Full Leagueが100試合以上となるため、従来のWEEKEND_SERIES中心設計は廃止する。

## LONG_DENSE

目安:
- 5.5〜6.5 games / week

対象:
- North America
- Caribbean winter leaguesの一部

## STANDARD_DENSE

目安:
- 4.5〜5.5 games / week

対象:
- Japan
- Korea
- Mexico
- Cuba
- Europe
- Oceania
- West / South Asia
- Pan-Africa

## STANDARD

目安:
- 4.0〜5.0 games / week

対象:
- Taiwan
- China

Leagueごとにoff-day / travel blockを調整し、100試合以上でもCalendarが破綻しないようSeason Windowを十分に取る。


---

# 4. Asia

## 4.1 Japan League

- clubs: 12
- Regular Season games / club: **120**
- Regular Season: **late March–late September**
- Postseason: **October**
- ABCL: **November**
- density: **STANDARD_DENSE**
- target: 約4.4 games / week

Two-league schedule:

```text
same-league opponents:
5 x 18 = 90

other-league opponents:
6 x 5 = 30

total = 120
```

同一League opponentはhome 9 / away 9。

Interleagueのhome / away不均衡は複数seasonでrotationする。

### Series rhythm

主に3-game series。

原則:
- Tuesday–Thursday
- Friday–Sunday
- Monday rest / travel

ただし全週6試合にはせず、calendar上に追加off-dayを配置する。

### Cycle Year 2 WBC

March WBC終了後にOpening Day。

WBC参加選手へhidden fatigue resetは与えない。

---

## 4.2 Korea League

- games: **126**
- Regular Season: **late March–September**
- Postseason: **October**
- ABCL: **November**
- density: **STANDARD_DENSE**
- target: 約4.7 games / week

Balanced schedule:

```text
9 opponents x 14
= 126
```

7 home / 7 away per opponent。

主に3-game series。

---

## 4.3 Taiwan League

- games: **112**
- Regular Season: **March–September**
- Postseason: **late October–early November**
- ABCL: **November Flex Window**
- density: **STANDARD**
- target: 約3.2 games / week

Balanced:

```text
7 opponents x 16
= 112
```

8 home / 8 away。

ABCL出場Clubの日程が重なる場合、ABCLをlate November / early Decemberへshift可能。

---

## 4.4 China League

- games: **108**
- Regular Season: **March–August**
- Postseason: **September**
- ABCL preparation: **October**
- ABCL: **November**
- density: **STANDARD**
- target: 約4.0 games / week

Balanced:

```text
9 opponents x 12
= 108
```

6 home / 6 away。

---

## 4.5 West / South Asia League

- games: **110**
- Regular Season: **October–March**
- postseason: none
- density: **STANDARD**
- target: 約3.5〜4.0 games / week

Balanced:

```text
11 opponents x 10
= 110
```

10 home / 10 away。

### ABCL conflict

ABCLは原則November。

このLeagueのABCL参加Clubについては:

```text
ABCL
 -> delayed domestic opening
 -> protected makeup windows
```

を使う。

全Leagueを止める必要はなく、参加Clubの日程だけ後ろへ再配置可能。

---

# 5. Americas

## 5.1 North America Major League

- games: **162**
- Regular Season: **late March–September**
- Postseason: **October**
- AmBCL: **February**
- density: **LONG_DENSE**
- target: 約6.0 games / week

Scheduleは意図的にunbalanced。

Division / Conference / inter-conference対戦を持つ。

正確なopponent matrixはschedule generator実装で固定するが、全Clubの総試合数は162で一致させる。

### Rhythm

典型:

- 3-game series
- 4-game series
- 1 off-day / week前後
- long road trips

travel distanceもCalendarStateへ残せる。

### WBC year

Cycle Year 2はWBC終了後にRegular Season開幕。

---

## 5.2 Mexico League

- games: **120**
- Regular Season: **March–August**
- Postseason: **September**
- AmBCL: **February next qualification window**
- density: **STANDARD_DENSE**
- target: 約5.3 games / week

Base matrix:

```text
19 opponents x 6 = 114
+ 6 zone / rivalry games
= 120
```

追加6試合のhome / awayはseason rotation。

---

## 5.3 Dominican League

- games: **100**
- Regular Season: **September–December**
- Championship Round + Final: **December–January**
- AmBCL: **February**
- density: **STANDARD**
- target: 約4.0〜4.5 games / week

Balanced:

```text
5 opponents x 20
= 100
```

6 home / 6 away。

---

## 5.4 Venezuela League

- games: **112**
- Regular Season: **September–December**
- Postseason: **January**
- AmBCL: **February**
- density: **STANDARD**
- target: 約4.5 games / week

Balanced:

```text
7 opponents x 16
= 112
```

8 home / 8 away。

---

## 5.5 Puerto Rico League

- games: **100**
- Regular Season: **September–December**
- Postseason: **January**
- AmBCL: **February**
- density: **STANDARD**
- target: 約4.5〜5.0 games / week

Balanced:

```text
5 opponents x 20
= 100
```

8 home / 8 away。

---

## 5.6 Cuba League

- games: **120**
- Regular Season: **September–December**
- Postseason: **January**
- AmBCL: **February**
- density: **STANDARD_DENSE**
- target: 約5.0〜5.5 games / week

Balanced:

```text
15 opponents x 8
= 120
```

10 home / 10 away。

ZoneはPostseason path / rivalry identityのために保持する。

---

# 6. Europe

欧州7LeagueはRegular Season + EURO_TOP4 Postseason。

基本リズムは**週4〜5試合の長期野球シーズン**。

3-game seriesを中心に、平日・週末の両方を使用する。サッカー型の週末中心Calendarは採用しない。

## 6.1 Netherlands

- clubs: 10
- games: **108**
- Regular Season: **March–August**
- Postseason: **September**
- EBCL: **October**
- density: **STANDARD_DENSE**
- target: 約4.8 games / week

```text
9 opponents x 12
= 108
```

## 6.2 Germany

- clubs: 12
- games: **110**
- Regular Season: **March–August**
- Postseason: **September**
- EBCL: **October**
- density: **STANDARD_DENSE**
- target: 約3.3 games / week

```text
11 x 10
= 110
```

## 6.3 France

- clubs: 10
- games: **108**
- Regular Season: **March–August**
- Postseason: **September**
- EBCL: **October**
- density: **STANDARD_DENSE**

## 6.4 Spain

- clubs: 10
- games: **108**
- Regular Season: **late March–August**
- Postseason: **September**
- EBCL: **October**
- density: **STANDARD_DENSE**

Cycle Year 2ではWBC後にOpening Dayをshift可能。

## 6.5 United Kingdom

- clubs: 10
- games: **108**
- Regular Season: **March–August**
- Postseason: **September**
- EBCL: **October**
- density: **STANDARD_DENSE**

## 6.6 Italy

- clubs: 12
- games: **110**
- Regular Season: **March–August**
- Postseason: **September**
- EBCL: **October**
- density: **STANDARD_DENSE**

Cycle Year 2はWBC windowを優先。

## 6.7 Russia

- clubs: 10
- games: **108**
- Regular Season: **March–August**
- Postseason: **September**
- EBCL: **October**
- density: **STANDARD_DENSE**
- target: 約3.2 games / week

短いclimate windowのため、他の欧州Leagueより平日seriesを使用しやすい。

---

# 7. Africa

## 7.1 Pan-African League

- clubs: 12
- games: **110**
- Regular Season: **October–March**
- Postseason: none
- AfBCL: **April**
- density: **STANDARD**
- target: 約5.0 games / week

Balanced:

```text
11 x 10
= 110
```

長距離移動を抑えるため:

- 3-game series
- regional road-trip blocks
- consecutive nearby away series

をSchedule Generatorが優先する。

---

# 8. Oceania

## 8.1 Australia League

- clubs: 8
- games: **112**
- Regular Season: **October–January**
- Postseason: **February**
- OBCL: **March**
- density: **STANDARD_DENSE**
- target: 約3.5 games / week

Balanced:

```text
7 x 16
= 112
```

10 home / 10 away。

## 8.2 New Zealand / Pacific League

- clubs: 8
- games: **112**
- Regular Season: **October–February**
- Postseason: none
- OBCL: **March**
- density: **STANDARD_DENSE**
- target: 約2.7 games / week

Balanced:

```text
7 x 16
= 112
```

Pacific travelを考慮し、away seriesをblock化する。

---

# 9. 21-League Volume Summary

| Region | League | Games | Regular Season | Postseason |
| --- | --- | ---: | --- | --- |
| Asia | Japan | 120 | Mar–Sep | Oct |
| Asia | Korea | 126 | Mar–Sep | Oct |
| Asia | Taiwan | 112 | Mar–Sep | Oct–Nov |
| Asia | China | 108 | Mar–Aug | Sep |
| Asia | West / South Asia | 110 | Oct–Mar | none |
| Americas | North America | 162 | Mar–Sep | Oct |
| Americas | Mexico | 120 | Apr–Aug | Sep |
| Americas | Dominican | 100 | Sep–Dec | Jan |
| Americas | Venezuela | 112 | Sep–Dec | Jan |
| Americas | Puerto Rico | 100 | Sep–Dec | Jan |
| Americas | Cuba | 120 | Sep–Dec | Jan |
| Europe | Netherlands | 108 | Mar–Aug | Sep |
| Europe | Germany | 110 | Mar–Aug | Sep |
| Europe | France | 108 | Mar–Aug | Sep |
| Europe | Spain | 108 | Mar–Aug | Sep |
| Europe | United Kingdom | 108 | Mar–Aug | Sep |
| Europe | Italy | 110 | Mar–Aug | Sep |
| Europe | Russia | 108 | Mar–Aug | Sep |
| Africa | Pan-African | 110 | Oct–Mar | none |
| Oceania | Australia | 112 | Oct–Jan | Feb |
| Oceania | New Zealand / Pacific | 112 | Oct–Feb | none |

---

# 10. Series Scheduling

Domestic Leagueは原則series単位でscheduleする。

```ts
type DomesticSeries = {
  homeClubId: ClubId;
  awayClubId: ClubId;
  gameCount: 2 | 3 | 4;
  startDate: CalendarDate;
};
```

標準は3-game series。

例外:

- North America: 3 / 4-game
- domestic postseason: CompetitionProfile定義
- makeup: single-game
- compressed winter schedule: 2-game / 3-game
- special rivalry: 4-game

Schedule Generatorはgame単位でランダム配置せず、series blockを基本単位にする。

---

# 11. Rest & Recovery Calendar

各Leagueは`MinimumOffDayPolicy`を持つ。

初期原則:

## LONG_DENSE

- 原則7日間で最低1日off候補
- 連戦上限は例外を除き14日未満を目標

## STANDARD_DENSE

- 週1〜2 off-day
- 9〜12連戦を上限目標

## STANDARD

- 週2前後off-day
- 長距離移動後はadditional recovery候補

`off-day`は完全回復イベントではない。

RecoveryCapacity / travel / injury / sleep-like recovery model等の実状態から回復量を決める。

---

# 12. Rainout / Postponement Budget

Regular Season Window内に`MakeupReserveDates`を確保する。

試合中止時:

```text
postponed
 -> nearest valid reserve date
 -> doubleheader candidate if rules permit
 -> end-of-season reserve
```

の順に再配置。

Continental / World Competitionへ食い込む場合、その大会windowを優先し、国内試合を前倒しまたは別reserve dateへ送る。

未消化試合を「勝率補正」で消すことは原則しない。

---

# 13. WBC / Premier / Club World Interaction

## WBC — Cycle Year 2

March開催。

影響:
- Japan / Korea / North America / Spain / Italy等はOpening Dayを後ろへshift
- Spring preparationを短縮可能
- WBC参加選手はfatigue / injury stateをそのまま所属Clubへ戻す

## Premier 12 — Cycle Year 4

November開催。

影響:
- West / South Asia
- Dominican
- Venezuela
- Puerto Rico
- Pan-Africa
- Australia
- NZ / Pacific

等の冬季LeagueはOpening Weekを調整、またはofficial breakを設ける。

## Club World — Cycle Year 3

December開催。

qualified clubが所属する冬季Leagueはofficial Club World Breakを設定する。

---

# 14. Schedule Generation Contract

概念:

```ts
type LeagueCalendarProfile = {
  regularSeasonGamesPerClub: number;
  regularSeasonWindow: DateWindow;
  postseasonWindow?: DateWindow;
  densityClass: ScheduleDensityClass;
  preferredSeriesLength: number;
  opponentMatrix: OpponentMatrixPolicy;
  continentalWindows: readonly DateWindow[];
  nationalTeamWindows: readonly DateWindow[];
  minimumOffDayPolicy: MinimumOffDayPolicy;
  makeupReserveDates: readonly CalendarDate[];
};
```

生成順:

```text
World major competition windows
 -> Continental windows
 -> Domestic postseason
 -> Domestic regular-season series
 -> reserve / makeup dates
 -> travel / off-day optimization
```

この順序により、後から国際大会を国内scheduleへ無理やり挿入しない。

---

# 15. Calendar Determinism

同じ:

- World start year
- LeagueCalendarProfile
- Competition calendar
- club alignment
- schedule seed
- calendar generator version

なら同じScheduleを生成する。

Schedule RNGはMatch Physics RNGから完全分離する。

---

# 16. Design Audit

確認:

- Full Simulation Leagueは全21リーグ100試合以上
- Japan 120
- Korea 126
- Taiwan 112 = 7 x 16
- China 108 = 9 x 12
- West / South Asia 110 = 11 x 10
- North America 162
- Mexico 120
- Dominican 100 = 5 x 20
- Venezuela 112 = 7 x 16
- Puerto Rico 100 = 5 x 20
- Cuba 120 = 15 x 8
- Europe 10-club leagues 108 = 9 x 12
- Europe 12-club leagues 110 = 11 x 10
- Pan-Africa 110 = 11 x 10
- Oceania 112 = 7 x 16
- Domestic Champions are decided before target Continental window
- WBC / Premier / Club World have domestic-calendar escape rules
- no schedule density directly modifies true ability

North America 162とMexico 120はunbalanced / rivalry opponent matrixを含むため詳細matrixをSchedule Generator設計へ委譲する。

重大な算術矛盾は現時点でない。


---

# 17. 今回の初期採用値

| League | Games |
| --- | ---: |
| Japan | 120 |
| Korea | 126 |
| Taiwan | 112 |
| China | 108 |
| West / South Asia | 110 |
| North America | 162 |
| Mexico | 120 |
| Dominican | 100 |
| Venezuela | 112 |
| Puerto Rico | 100 |
| Cuba | 120 |
| Netherlands | 108 |
| Germany | 110 |
| France | 108 |
| Spain | 108 |
| United Kingdom | 108 |
| Italy | 110 |
| Russia | 108 |
| Pan-African | 110 |
| Australia | 112 |
| New Zealand / Pacific | 112 |

---

# 18. 後続校正

- North America exact 162-game opponent matrix
- Mexico extra 6 rivalry-game allocation
- Taiwan / ABCL exact November collision handling
- rainout / doubleheader rules
- exact travel-cost optimization
- weekday / weekend preferences per league
- public holiday scheduling
- day / night game preferences
- All-Star break
- trade deadline
- roster expansion date
- minor / reserve league calendars
- national-team regional championship exact window
