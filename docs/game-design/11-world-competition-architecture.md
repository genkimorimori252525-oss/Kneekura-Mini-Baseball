# World Competition Architecture — Club & National Teams

更新日: 2026-09-19  
状態: **設計候補版。ユーザー確認後に承認版へ昇格する。実装前。**

関連:
- `docs/game-design/10-world-league-catalog.md`
- `docs/superpowers/specs/2026-09-17-league-ecology-design.md`
- `docs/game-design/06-future-systems.md`
- `docs/game-design/09-player-trait-catalog.md`

---

# 1. 目的

21 Full Leagues と Lightweight / National Pools を前提に、世界規模の大会体系を定義する。

二つの競技系統を分離する。

```text
CLUB PATH
Domestic League
  -> Continental Champions Competition
  -> Club World Championship

NATIONAL TEAM PATH
Regional Championship / Qualifying
  -> WBC-class World Championship

World Ranking
  -> Premier 12-class Tournament
```

クラブと代表の成績・ランキング・賞金・歴史は別系統で保持する。

---

# 2. 恒久原則

## 2.1 Competitionは能力補正を行わない

大会格、世界ランキング、大陸係数、シード、賞金はMatch Coreへの直接Buff / Debuffにしない。

```text
prestige
ranking
coefficient
competition tier
  -> qualification / draw / finance / reputation / motivation context
  -> NOT true ability modifier
```

## 2.2 国際大会参加でLeague-relative Ratingを上書きしない

`ratingContextLeagueId = affiliationLeagueId` を維持する。

一時的なクラブ国際大会・代表招集・WBC級大会参加では所属リーグ基準の公開Ratingを再基準化しない。

## 2.3 Lightweight League / National Poolにも世界への道を残す

Full Leagueだけで出場枠を独占させない。

各大陸大会は最低限、Lightweight League / National Poolに接続するQualification Routeを持つ。

## 2.4 地域の固定強弱を能力補正へ変換しない

出場枠数は実際の大会成績を用いたCoefficientで変動可能とする。

```text
competition results
  -> coefficient
  -> future berths / seeding
```

```text
continent name
  -> ability modifier
```

は禁止する。

---

# 3. Competition Tier

内部の大会格を以下のように整理する。

| Tier | Competition | 意味 |
| --- | --- | --- |
| C1 | WBC-class World Championship | 代表世界最高峰 |
| C1 | Club World Championship | クラブ世界最高峰 |
| C2 | Premier 12-class | 世界上位代表の選抜大会 |
| C2 | Continental Club Champions | 各大陸クラブ最高峰 |
| C3 | Regional National Championship | 地域代表最高峰 / 世界大会予選 |
| C4 | Qualification | 本大会予選 |

Tierはprestige / economics / qualification用であり、試合中能力へ直接作用しない。

WBCとClub Worldは別系統のC1であり、どちらが「上」という単一順位にしない。

---

# 4. Annual Continental Club Competitions

Working names:

- Asian Baseball Champions League — ABCL
- Americas Baseball Champions League — AmBCL
- European Baseball Champions League — EBCL
- African Baseball Champions League — AfBCL
- Oceania Baseball Champions League — OBCL

最終名称は独自ブランドへ変更可能。

---

# 5. 共通クラブ大会フォーマット

## 5.1 16-club standard

Asia / Americas / Europeは原則 **16 clubs**。

### Group Stage

```text
16 clubs
  -> 4 groups x 4 clubs
```

各組で他3クラブと **3-game seriesを1回ずつ** 行う。

- 9 group-stage games / club
- Venueはdrawで決定、または大会集中開催
- 同一カードをhome-and-away 6試合にはしない
- 各組上位2クラブがKnockoutへ

### Knockout

- Quarterfinal: best-of-3
- Semifinal: best-of-3
- Final: best-of-5

Champion最大試合数:

```text
9 + 3 + 3 + 5 = 20 games
```

これは最大値であり、2勝決着等では少なくなる。

国内リーグと両立可能な「野球らしい短期シリーズ」を優先する。

## 5.2 Tie-break

Group standings候補:

1. wins
2. head-to-head
3. run differential with cap
4. runs allowed
5. deterministic drawing / seeded tiebreak game

大量得点狙いを防ぐため、run differentialには1試合あたり上限を設ける候補とする。

---

# 6. Asia — ABCL

Full Leagues:

- Japan
- Korea
- Taiwan
- China
- West / South Asia

本大会: **16 clubs**

### Base qualification

- 各Full League champion: 5
- defending ABCL champion: 1
- coefficient berths: 7
- continental qualifiers: 3

Total: 16

defending championが国内順位でも出場権を得た場合、その重複枠はCoefficient / Qualificationへcascadeする。

### Coefficient berth rule

5-season rolling coefficientを利用。

- 各Full League minimum additional berth: 0
- maximum total berth per Full League: 5
- 過去のABCL成績で7枠を配分
- League name / true abilityから固定配分しない

### Qualifier route

Lightweight Asian leagues / National club structuresから3枠。

### Target window

**November**

East Asia主要リーグの終了後を基本とする。

West / South Asia Leagueはこの期間をContinental Breakとして予約する。

---

# 7. Americas — AmBCL

Full Leagues:

- North America
- Mexico
- Dominican
- Venezuela
- Puerto Rico
- Cuba

本大会: **16 clubs**

### Base qualification

- Full League champions: 6
- defending champion: 1
- coefficient berths: 6
- continental qualifiers: 3

Total: 16

### 特記事項

夏季リーグと冬季リーグが混在するため、calendar yearではなく `QualificationSeasonId` を使用する。

```text
North America 2028 season
Dominican 2028-29 season
```

のような異なるseason labelを、同一AmBCL editionへ紐づけられる。

### Target window

**February**

- Caribbean / Cuba winter season終了後
- Mexico regular season前
- North America regular season前

を基本とする。

必要な場合、参加クラブ向けpreseason開始日を大会日程に合わせる。

---

# 8. Europe — EBCL

Full Leagues:

- Netherlands
- Germany
- France
- Spain
- United Kingdom
- Italy
- Russia

本大会: **16 clubs**

### Base qualification

- Full League champions: 7
- defending champion: 1
- coefficient berths: 6
- continental qualifiers: 2

Total: 16

### Coefficient

Europeではサッカー型Coefficientを最も強く採用する。

5-season rolling:

- match wins / series wins
- stage advancement
- title
- strength of achieved stage

からLeagueCoefficientを生成。

ただし相手league nameによる能力補正はしない。

### Target window

**October**

各国内リーグ終了後のcontinental postseason。

---

# 9. Africa — AfBCL

Full League:

- Pan-African League

さらに多数のLightweight domestic / regional leaguesを持てる。

本大会: **8 clubs**

### Qualification

- Pan-African League top 4: 4
- African regional qualifiers: 4

Regional qualifier例:

- North
- West
- East
- Southern / Central

ただし地理区分は後続World Mapで調整可能。

### Format

```text
8 clubs
 -> 2 groups x 4
 -> top 2 each
 -> semifinals best-of-3
 -> final best-of-5
```

Group stageは3-game series x 3 = 9 games。

### Target window

**April**

Pan-African League終了後を基本とする。

---

# 10. Oceania — OBCL

Full Leagues:

- Australia
- New Zealand / Pacific

本大会: **8 clubs**

### Qualification

- Australia top 3
- NZ / Pacific top 3
- Pacific Lightweight qualifier: 1
- defending champion: 1

重複時はqualifier / coefficientへcascade。

### Format

Africaと同じ8-club format。

### Target window

**March**

Oceania冬季league終了後。

---

# 11. Continental Club Coefficient

## 11.1 League Coefficient

目的:

- extra berth allocation
- qualifying round entry
- seeding

入力:

- 5-season continental results
- stage reached
- series / match results

LeagueCoefficientは「そのリーグの真の強さ」ではなく、近年の大会成果を表す。

## 11.2 Club Coefficient

目的:

- draw seeding
- qualification priority

クラブ自身の過去5season resultsを用いる。

## 11.3 Relegation of reputation

過去の強豪が永久に優遇されないよう、古いseasonへdecayを掛ける。

---

# 12. Club World Championship

クラブ世界最高峰。

開催: **4年に1回**

本大会: **16 clubs**

## 12.1 Qualification

### Automatic

- 5 continental champions from the qualification cycle: 5
- previous Club World champion: 1
- host association / host league champion slot: 1

### Performance berths

残り **9** を `WorldClubCoefficient` から地域へ配分。

各Region:

- minimum additional berth: 1
- maximum additional berth: 3

これにより、

```text
Asia is permanently 3
Europe is permanently 4
```

のような固定世界序列を作らない。

初回大会だけはseed allocationを設定し、その後actual Club World performanceで更新する。

重複資格は次順位クラブ / regional performance berthへcascade。

## 12.2 Format

```text
16 clubs
 -> 4 groups x 4
 -> top 2
 -> QF best-of-3
 -> SF best-of-5
 -> Final best-of-7
```

Group stageは各対戦3-game series、一クラブ9試合。

Club WorldだけFinalをbest-of-7とし、世界王者決定の重みを持たせる。

## 12.3 Window

**December, Year 3 of the four-year cycle**

- summer leagues are原則offseason
- active winter leaguesにはofficial Club World Breakを設定
- host rotates by Region

---

# 13. National Team Regional Championships

代表チームの大陸選手権。

Working names:

- Asian National Championship
- Americas National Championship
- European National Championship
- African National Championship
- Oceania National Championship

開催: **4年に1回 / Year 1**

WBC-class championshipの主要qualificationを兼ねる。

National TeamはFull Leagueを持たない国でも参加可能。

## 13.1 Recommended finals sizes

| Region | Finals |
| --- | ---: |
| Asia | 12 nations |
| Americas | 16 nations |
| Europe | 16 nations |
| Africa | 12 nations |
| Oceania | 8 nations |

予選はNational Baseball Poolを含む。

## 13.2 Tournament format

代表大会ではクラブより試合数を抑える。

例 16-team:

```text
4 groups x 4
single round robin = 3 games
top 2
QF single game
SF single game
Final single game
```

ただしFinalのみbest-of-3を採用するProfileも許可。

初期推奨は **single-game knockout**。

国際短期決戦の偶然性と番狂わせを残す。

---

# 14. WBC-class World Championship

代表世界最高峰。

開催: **4年に1回 / Year 2**

本大会: **24 nations**

## 14.1 Qualification

20 direct + 4 Global Qualifier。

### Regional floor berths

最低保証:

- Asia: 4
- Americas: 5
- Europe: 4
- Africa: 2
- Oceania: 1

Total floor: 16

### Performance berths

残りdirect 4枠を過去2大会のWBC resultsを用いる `WorldNationalRegionalCoefficient` で配分。

各regionへ最大2追加まで。

これでdirect berths = 20。

### Global Qualifier

残り4枠を地域横断Qualificationから決める。

世界大会経験の少ない国にも本大会進出経路を残す。

## 14.2 Format

24 nations:

```text
6 groups x 4
 -> 3 games each
 -> top 2 + best third-place teams
 -> 16-team knockout
```

16-team knockout:

- R16 single game
- QF single game
- SF single game
- Final single game

候補としてFinal best-of-3を許可するが、初期推奨はsingle game。

## 14.3 Window

**March, Year 2**

Full League calendarはWBC windowを予約する。

---

# 15. Premier 12-class Tournament

開催: **4年に1回 / Year 4**

本大会: **12 nations**

出場国:

```text
World National Ranking top 12
at qualification cutoff
```

予選なし。

これ自体が大会の個性。

`Premier 12`という名称を維持する限り12か国固定。

## 15.1 World Ranking

World National Rankingは代表戦のactual resultsから更新。

入力候補:

- competition tier
- match result
- opponent ranking at match time
- recency decay
- tournament stage

ランキングは出場資格 / seeding用であり、Player true abilityへ戻さない。

## 15.2 Format

```text
12 nations
 -> 2 groups x 6
 -> 5 games each
 -> top 2 each
 -> semifinals
 -> bronze game
 -> final
```

knockoutはsingle game。

## 15.3 Window

**November, Year 4**

---

# 16. Four-year Global Cycle

推奨cycle:

```text
YEAR 1
  Annual Continental Club Championships
  Regional National Championships / WBC qualification

YEAR 2
  Annual Continental Club Championships
  March: WBC-class World Championship

YEAR 3
  Annual Continental Club Championships
  December: Club World Championship

YEAR 4
  Annual Continental Club Championships
  November: Premier 12-class Tournament
```

これにより代表最高峰WBCは4年に1度の希少性を維持する。

Club Worldも4年に1度。

Premier 12はWBCとは異なる「現在の上位12代表だけ」の大会になる。

---

# 17. Competition Calendar Principle

## 17.1 season yearではなくSeasonIdを使う

冬季leagueを含むため、calendar yearだけでqualificationを決めない。

```ts
type CompetitionQualificationEntry = {
  leagueId: LeagueId;
  qualificationSeasonId: SeasonId;
  clubId: ClubId;
};
```

## 17.2 Official Competition Window

代表・Club World等はWorld Calendarに予約済みwindowを持つ。

window中は必要な国内leagueが:

- scheduled break
- reduced fixtures
- make-up dates

を利用できる。

## 17.3 No hidden fatigue reset

大会windowだから疲労が消えることはない。

CurrentFatigue / RecoveryCapacityを通常どおり引き継ぐ。

---

# 18. Club Roster Rules

## 18.1 Registration

各Competition editionごとにclub competition rosterを登録。

候補:

- primary roster: 30
- emergency replacement list
- academy / youth supplemental slots

正確な人数は実装校正対象。

## 18.2 One club per edition

同じ選手は一つのeditionで二つのclubを代表できない。

移籍・loan後も、既に同editionへ別clubで出場した場合は次editionまで出場不可とする候補。

このcup-tied ruleは簡略化のため無効化可能なCompetitionProfile optionとしてもよい。

## 18.3 Loan

Competition roster登録時点でLoan先へ正式登録されているならLoan先選手として扱う。

---

# 19. National Team Eligibility & Call-up

## 19.1 Eligibility Policy

国籍・出生・親族・居住等のeligibilityをMatch Coreへ埋め込まない。

```text
NationalEligibilityPolicy
```

としてCompetition / World Rules側に置く。

## 19.2 Call-up does not change affiliation

代表招集中も:

```text
affiliationLeagueId unchanged
ratingContextLeagueId unchanged
```

## 19.3 Official release window

WBC / Premier / Regional Championshipはofficial national-team window。

参加資格を持つクラブは原則release obligationを負う候補。

Career Economy側で:

- player insurance
- club compensation
- injury compensation

を持てる。

## 19.4 National roster

初期候補:

- roster: 30
- replacement list
- injury replacement before defined cutoff
- tournament中の無制限入替は禁止

正確なpitcher count等は後続RuleProfileで決める。

---

# 20. Prize / Prestige / Historical Value

金額は世界経済設計前なので固定通貨額をまだ決めない。

代わりに `PrizePoolIndex` を使用する。

初期相対値候補:

| Competition | PrizePoolIndex |
| --- | ---: |
| Continental Club Champions | 100 |
| Club World Championship | 300 |
| Regional National Championship | 60 |
| Premier 12-class | 140 |
| WBC-class | 250 |

National competition prizeは主にFederationへ入り、選手bonus / development fundingへ配分可能。

Club tournament prizeはclub revenueへ入る。

### Club prize distribution

候補:

- participation payment
- group-stage performance payment
- advancement payment
- champion bonus
- broadcast pool
- solidarity pool

特にContinental Club Competitionでは、小市場クラブが出場するだけで育成投資へ再投資できるようsolidarityを持つ。

---

# 21. Prestige Effects

Prestigeはtrue abilityへ直接作用しない。

作用可能先:

- player CareerMotivation
- transfer attractiveness
- sponsor / commercial revenue
- club reputation
- coach / player recruitment
- historical records
- Hall of Fame / achievements
- manager reputation
- fan interest
- MatchImportance -> Appraisal

最後の項目も、`MatchImportance`を介して心理システムへ接続し、万能Buffにしない。

---

# 22. Records

大会ごとに独立記録を持つ。

Club:

- continental titles
- Club World titles
- appearances
- finals
- all-time wins
- club coefficient history

National:

- regional titles
- Premier titles
- WBC titles
- appearances
- all-time wins
- world ranking history

Player:

- tournament appearances
- championships
- awards
- tournament statistics
- iconic plays / PlayCapsule links

300-year simulationでも歴史を追えるよう、season summaryを中心に圧縮保存可能とする。

---

# 23. Competition Expansion

大会参加数は将来固定しなくてもよい。

例:

- Europe grows -> EBCL 16 -> 20
- Africa grows -> AfBCL 8 -> 12 / 16
- Premier 12を拡大するなら名称変更
- WBC 24 -> 32

ただし拡大はWorld State / Competition reformとして明示的に発生させる。

ゲーム途中で突然無理由にformatを変更しない。

---

# 24. Open Decisions

ユーザー確認後に確定したいもの:

1. Continental club formatをこの「3-game series group + short playoff」で採用するか
2. Europe / Asia / Americasを16 clubsで統一するか
3. Africa / Oceaniaを8 clubsから開始するか
4. Club World 16 clubs / 4年ごとを採用するか
5. Regional National ChampionshipをWBC主要予選にするか
6. WBCを24 nationsとするか
7. Premier 12を12固定とするか
8. 4-year cycleを採用するか
9. National knockoutをsingle game中心にするか
10. Club World finalだけbest-of-7とするか
11. PrizePoolIndexの相対比を採用するか
12. official national-team release obligationを設けるか

これらが承認されたら、本書を設計承認版へ昇格する。
