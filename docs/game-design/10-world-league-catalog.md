# World League Catalog — 21 Full Leagues

更新日: 2026-09-19  
状態: **設計承認済みの世界構成 v1。実装前。球団名・最終ブランド・細かな日程は後続設計で確定する。**

関連:
- `docs/superpowers/specs/2026-09-17-league-ecology-design.md`
- `docs/game-design/06-future-systems.md`
- `docs/game-design/09-player-trait-catalog.md`
- `docs/game-design/13-domestic-league-championships.md`
- `docs/game-design/14-regular-season-calendar-and-volume.md`
- `docs/game-design/15-season-events-and-deadlines.md`

---

## 1. 目的

Kneekura Mini Baseball / 将来の Natural Baseball で長期的に回る「世界野球」を定義する。

本書では、Full Simulation対象のリーグについて、

- 地域
- 初期球団数
- 開催時期
- 初期League Culture Seed
- Player Marketの型
- 大陸クラブ大会への所属

を決める。

重要:

> Culture Seedは「国民性」や固定能力補正ではない。

本書のCulture Seedは、ゲーム開始時点における育成・スカウト・戦術・市場のpriorである。

```text
Culture Seed
  ↓
scouting / development / roster selection / tactics
  ↓
player population changes
  ↓
actual Exposure / Familiarity changes
  ↓
observed league strengths / weaknesses emerge
```

例えば「高め速球へ弱いリーグ」を直接設定してはならない。

---

## 2. 世界構成

Full Simulation Leagueは **21**。

| Region | Full Leagues | Clubs |
| --- | ---: | ---: |
| Asia | 5 | 52 |
| Americas | 6 | 86 |
| Europe | 7 | 74 |
| Africa | 1 | 12 |
| Oceania | 2 | 16 |
| **Total** | **21** | **240** |

240球団はゲーム世界の初期既定値であり、現実の各リーグの現在球団数を厳密に再現するものではない。

Full League以外にも、

- Lightweight Regional League
- National Baseball Pool

を持てる。

---

# 3. Player Market 共通モデル

## 3.1 市場方式は一種類へ統一しない

リーグごとに歴史が違うため、以下を組み合わせる。

### CONTROLLED_DRAFT_TRADE

主に北米型。

- amateur draft
- reserve / development system
- player trade
- free agency
- waiver / release
- contract acquisition
- international scouting

### EAST_ASIA_HYBRID

- domestic amateur draft
- developmental roster
- trade
- domestic FA
- posting / cross-border transfer
- foreign-player acquisition

### FOOTBALL_TRANSFER_ACADEMY

野球が比較的新しい市場で主要候補。

- club academy
- transfer fee
- free transfer
- loan
- trial
- registration window
- agent negotiation
- training compensation
- solidarity payment
- sell-on clause
- homegrown / locally-trained roster policy

### WINTER_OPEN_MARKET

- short / medium contracts
- frequent roster turnover
- international player movement
- loans / temporary registrations
- veteran return market
- prospect showcase
- transfer / release flexibility

### GROWTH_FRANCHISE_HYBRID

- strong investor ownership
- foreign star recruitment
- academy obligation
- local-player quota
- international trials
- transfer / loan system
- expansion-friendly structure

---

## 3.2 サッカーから借りる市場メカニズム

野球がまだ主要競技ではない地域では、サッカー型のクラブ市場を積極的に参考にする。

### Academy

クラブ自身が若手を長期間育成する。

```text
academy investment
  ↓
prospect development
  ↓
first team or transfer
```

### Transfer Fee

契約中の選手を別クラブが獲得する場合、選手契約とは別にクラブ間移籍金が発生可能。

### Loan

出場機会を得る目的で、一時的に他クラブへ登録できる。

Loan中の選手はLoan先のリーグで実際のExposure / Familiarityを得る。

### Training Compensation

若手を育成したクラブが、プロ契約・一定の移籍時に育成補償を受け取れる。

### Solidarity

後年の高額移籍時にも、若年期に育成へ関わった複数クラブへ一部が還元される仕組みを持てる。

### Sell-on Clause

将来転売された時の移籍金の一部を旧所属へ還元できる。

### Trial

スカウトが完全なKnowledgeを持たない選手を、短期間の練習参加で評価できる。

```text
unknown player
  ↓
trial
  ↓
additional evidence
  ↓
KnowledgeEstimate uncertainty decreases
```

これらは能力BuffではなくCareer / Economy / Knowledgeシステムである。

---

# 4. Asia — 5 Full Leagues

## 4.1 Japan League

- working reference: NPB
- clubs: **12**
- season: **March–October**
- market: **EAST_ASIA_HYBRID**
- continental region: Asia

### Initial Culture Seed

- command / repeatabilityを高く評価
- 多球種・変化球開発を重視
- 守備・走塁・状況判断を育成
- 長期育成と組織的コーチング
- matchup単位の細かな戦術を採用しやすい

### Player Market

- domestic amateur draftの重要度が高い
- farm / developmental pathwayが強い
- 国内Tradeはあるが、欧州型Transfer Fee市場より相対的に小さい
- FAと海外移籍ルートを持つ
- 海外復帰選手市場あり
- foreign-player枠はLeagueProfileで設定

---

## 4.2 Korea League

- working reference: KBO
- clubs: **10**
- season: **March–October**
- market: **EAST_ASIA_HYBRID**
- continental region: Asia

### Initial Culture Seed

- 強いスイングと打球出力を評価しやすい
- 投手の球速向上へ投資
- 攻撃テンポが速い戦術prior
- 若手へ一軍機会を与える組織差が大きい
- bullpen運用文化が時代で変化しやすい

### Player Market

- amateur draft
- FA / Trade
- foreign-player recruitment
- Japan / North Americaとのcross-border movement
- veteran return market
- league内育成と外部獲得のHybrid

---

## 4.3 Taiwan League

- working reference: CPBL
- clubs: **8**
- season: **March–November**
- market: **EAST_ASIA_HYBRID**
- continental region: Asia

### Initial Culture Seed

- 積極的な打撃判断
- baserunning / transition speed重視
- 若手打者育成への投資
- versatile defenderを好むクラブが生まれやすい
- 国際大会Exposureの影響が比較的大きい

### Player Market

- domestic draft
- FA / Trade
- Japan / Korea / North Americaへの移籍ルート
- 海外からのreturning-player market
- small-market clubsは育成と再獲得で競争可能

---

## 4.4 China League

- clubs: **10**
- season: **March–September**
- market: **GROWTH_FRANCHISE_HYBRID**
- continental region: Asia

### Initial Culture Seed

- 大地域からのathlete identification
- academy投資のクラブ差が大きい
- foreign coachingの吸収速度が速い
- baseball経験の浅いathlete conversionを積極利用
- 成功クラブの育成方法がleagueへ急速に模倣されやすい

### Player Market

- academyが重要
- domestic youth registration
- transfer fee / loanを利用可能
- foreign veteran / coach recruitment
- large-region scouting
- clubごとの資本差が選手獲得へ強く出る
- training compensationで育成クラブを保護

---

## 4.5 West / South Asia League

- clubs: **12**
- season: **October–March**
- market: **GROWTH_FRANCHISE_HYBRID + FOOTBALL_TRANSFER_ACADEMY**
- continental region: Asia

対象世界観:
- West Asia
- South Asia
- Gulf
- India / Pakistan周辺
などからクラブ・選手が参加可能。

### Initial Culture Seed

- international recruitmentを強く利用
- bat-and-ball系他競技からのathlete conversion
- short-seasonで即戦力を評価しやすい
- wealthy clubとacademy clubの哲学差が大きい
- 海外コーチング思想の競争が激しい

### Player Market

- transfer fee
- loan
- trial
- academy
- agent market
- foreign-player slots
- locally-trained quota
- sell-on clauses
- training compensation / solidarity

「スターを買うクラブ」と「若手を育てて売るクラブ」が同一リーグに共存可能。

---

# 5. Americas — 6 Full Leagues

## 5.1 North America Major League

- working reference: MLB
- clubs: **30**
- season: **March–October**
- market: **CONTROLLED_DRAFT_TRADE**
- continental region: Americas

### Initial Culture Seed

- maximum velocity / bat speedを高く評価
- pitch design / movement optimization
- hard contact / launch optimization
- specialist bullpen role
- high-volume analytics / scouting
- minor/development systemの深さ

### Player Market

- amateur draft
- international amateur acquisition
- trades
- options / development assignments
- free agency
- waiver / release
- large payroll differences
- transfer feeよりplayer-rights / contract movement中心

---

## 5.2 Mexico League

- clubs: **20**
- season: **April–September**
- market: **HYBRID_OPEN_MARKET**
- continental region: Americas

### Initial Culture Seed

- veteran skillを活かすクラブが多い
- contact / powerの多様な打撃哲学
- 球場環境差への適応
- North America / Caribbean経験者の知識流入
- club別の戦術差を大きく許す

### Player Market

- contract negotiation
- domestic movement
- international FA
- temporary registrations / loans
- North Americaからのveteran / rebound market
- Caribbeanへの双方向移動
- transfer feeを一部許容

---

## 5.3 Dominican League

- clubs: **6**
- season: **August–January**
- market: **WINTER_OPEN_MARKET**
- continental region: Americas

### Initial Culture Seed

- high competition density
- bat speed / athletic execution重視
- 若手prospectとveteranが同時に混ざる
- short seasonのため調子・役割争いが激しい
- international experienceが急速に持ち込まれる

### Player Market

- short contracts
- temporary registration
- loan
- returning stars
- prospects seeking playing time
- frequent roster turnover
- export / re-import network

冬季だが主所属リーグになり得る。

---

## 5.4 Venezuela League

- clubs: **8**
- season: **August–January**
- market: **WINTER_OPEN_MARKET**
- continental region: Americas

### Initial Culture Seed

- technical position play
- contact qualityとdefensive versatility
- roster competition
- international-return knowledge
- short-season tactical adaptation

### Player Market

- short / medium contracts
- international FA
- loans
- temporary registrations
- returning-player market
- academy / local youth pipeline
- cross-border agents

---

## 5.5 Puerto Rico League

- clubs: **6**
- season: **August–January**
- market: **WINTER_OPEN_MARKET**
- continental region: Americas

### Initial Culture Seed

- compact leagueでscouting knowledgeが蓄積しやすい
- catcher / defense / tactical communicationを評価するクラブが生まれやすい
- young / veteran mixture
- international tournament experienceがleagueへ戻りやすい
- matchup adaptationの速度が高い

### Player Market

- short contracts
- loans
- veteran return
- international prospects
- small-club scouting advantage
- academy / local development
- North Americaへのexport pathway

---

## 5.6 Cuba League

- clubs: **16**
- season: **August–January**
- market: **DOMESTIC_DEVELOPMENT_HYBRID**
- continental region: Americas

### Initial Culture Seed

- broad contact skill
- defensive fundamentals
- multi-position athletic development
- starting pitcher developmentを維持しやすい
- club / regional development identityが強い

### Player Market

ゲーム世界では以下のHybridとする。

- regional academy
- domestic registration
- domestic transfer
- overseas transfer window
- training compensation
- returning-player registration
- selective loans

現実制度の完全再現ではなく、ゲーム内世界市場へ接続できる形を優先する。

---

# 6. Europe — 7 Full Leagues

欧州7リーグでは、野球市場そのものをサッカー型クラブ経済へ強く寄せる。

共通候補:

- club academy
- transfer fee
- free transfer
- loan
- sell-on clause
- training compensation
- solidarity
- registration windows
- trials
- agents
- homegrown roster incentives

ただし各リーグで「買う側 / 売る側 / 育成 / veteran」の比率を変える。

---

## 6.1 Netherlands League

- clubs: **10**
- season: **March–September**
- market: **FOOTBALL_TRANSFER_ACADEMY**
- continental region: Europe

### Initial Culture Seed

- technical fundamentals
- defense / baserunning IQ
- international player mixing
- academy coaching
- versatile pitchers / fielders

### Player Market

- **development + export型**
- academy卒業選手をEurope内外へ売る
- sell-on clause重視
- loanによる若手出場機会
- Caribbean / Europe / North Americaへの広いscouting
- wealthy leagueへのstep-up pathway

---

## 6.2 Germany League

- clubs: **12**
- season: **March–September**
- market: **FOOTBALL_TRANSFER_ACADEMY**
- continental region: Europe

### Initial Culture Seed

- physical development
- throwing velocity / strength training
- structured academy
- data / sports science adoption
- organization qualityのクラブ差

### Player Market

- **balanced academy + buyer**
- academy investmentが大きい
- Germany国内Lightweight poolから吸収
- neighboring countriesへloan
- mid-level transfer fee market
- strong clubsは完成選手も購入
- locally-trained roster incentive

---

## 6.3 France League

- clubs: **10**
- season: **March–September**
- market: **FOOTBALL_TRANSFER_ACADEMY**
- continental region: Europe

### Initial Culture Seed

- broad athletic recruitment
- multi-sport conversion
- wide-area scouting
- youth development experimentation
- club philosophyの多様性

### Player Market

- **academy / selling league型**
- 若手発掘から育成し、強い欧州リーグへ販売
- training compensationが重要収益
- sell-on clauseを多用
- trialsが多い
- cross-border academy recruitment
- loan受入で有望選手へ出場機会

---

## 6.4 Spain League

- clubs: **10**
- season: **March–September**
- market: **FOOTBALL_TRANSFER_ACADEMY**
- continental region: Europe

### Initial Culture Seed

- contact / bat control
- fielding technique
- warm-weather development volume
- tactical hitting
- international technical exchange

### Player Market

- **technical academy + loan network**
- youth academy重視
- reserve / affiliate clubsへloan
- Latin Americaとのscouting connectionを作りやすい
- technical prospectsの転売
- top clubsはEurope内からskill playerを購入

---

## 6.5 United Kingdom League

- clubs: **10**
- season: **March–September**
- market: **FOOTBALL_TRANSFER_ACADEMY**
- continental region: Europe

### Initial Culture Seed

- analytics adoption
- imported coaching
- cricket / other bat-and-ball athlete conversion
- high-variance club investment
- aggressive international recruitment

### Player Market

- **capital-rich buyer / academy hybrid**
- transfer fee spendingが大きくなり得る
- foreign-player recruitment
- academy investment
- loansで若手をEurope他国へ送り出す
- scouting departmentsの情報力で差がつく
- agent activityが活発

長期世界では、資本と分析の成功次第で急成長可能。

---

## 6.6 Italy League

- clubs: **12**
- season: **March–September**
- market: **FOOTBALL_TRANSFER_ACADEMY**
- continental region: Europe

### Initial Culture Seed

- tactical baseball
- pitcher / catcher cooperation
- technical coaching
- veteran mentorship
- situational execution

### Player Market

- **veteran + academy + loan network**
- experienced player acquisition
- academy prospects
- Europe内loan
- short-term transfer
- tactical fitを重視した補強
- strong clubsは即戦力と育成を併用

---

## 6.7 Russia League

- clubs: **10**
- season: **March–September**
- market: **FOOTBALL_TRANSFER_ACADEMY**
- continental region: Europe

### Initial Culture Seed

- strength / throwing development
- indoor training adaptation
- large-distance scouting
- local youth investment
- clubごとの育成設備差

### Player Market

- **domestic development + selective buying**
- academy重視
- locally-trained incentives
- domestic transfer fee市場
- selective foreign recruitment
- loanで若手出場機会を確保
- large geographic scouting costを持つ

政治・国際関係そのものを能力補正へ使わず、Competition参加資格等が必要なら別Rule / World Stateで扱う。

---

# 7. Africa — 1 Full League

## 7.1 Pan-African League

- clubs: **12**
- season: **October–March**
- market: **FOOTBALL_TRANSFER_ACADEMY + GROWTH_FRANCHISE_HYBRID**
- continental region: Africa

複数国のクラブが参加する越境Full League。

各国の国内野球はLightweight League / National Poolとして保持可能。

### Initial Culture Seed

- large-area talent identification
- athletic conversion
- academy hubs
- international coaching exchange
- rapid tactical diffusion
- high club-resource variance

### Player Market

- **academy / export型**
- open trials
- regional scouting camps
- training compensationが重要
- solidarityで小規模育成クラブへ還元
- Europe / Asia / Americasへのexport
- loan partnerships
- foreign veteran / coach recruitment
- homegrown quota

有望選手を売った収益がacademy投資へ戻り、リーグ自身が長期成長できる。

---

# 8. Oceania — 2 Full Leagues

## 8.1 Australia League

- clubs: **8**
- season: **September–February**
- market: **HYBRID_OPEN_MARKET**
- continental region: Oceania

### Initial Culture Seed

- velocity / power
- multi-sport athletes
- international player mixing
- short-season intensity
- export-oriented development

### Player Market

- domestic prospects
- international short contracts
- loans
- Japan / Korea / North Americaとのplayer exchange
- returning-player market
- academy partnerships
- foreign prospects seeking winter playing time

冬季だが主所属リーグになり得る。

---

## 8.2 New Zealand / Pacific League

- clubs: **8**
- season: **September–February**
- market: **FOOTBALL_TRANSFER_ACADEMY + WINTER_OPEN_MARKET**
- continental region: Oceania

### Initial Culture Seed

- rugby / cricket等からのathlete conversion
- small-market player versatility
- defensive / running development
- export-oriented academy
- regional island scouting

### Player Market

- **development / export型**
- academy
- open trials
- Australiaへのloan
- Europe / Asiaへのtransfer
- training compensation / solidarity
- short-term veteran imports
- Pacific National Poolsからprospect発掘

---

# 9. League Market Archetype Summary

| League | Clubs | Season | Market Archetype |
| --- | ---: | --- | --- |
| Japan | 12 | Mar–Oct | East Asia Hybrid |
| Korea | 10 | Mar–Oct | East Asia Hybrid |
| Taiwan | 8 | Mar–Nov | East Asia Hybrid |
| China | 10 | Apr–Sep | Growth Franchise Hybrid |
| West/South Asia | 12 | Nov–Mar | Football Transfer + Growth |
| North America | 30 | Mar–Oct | Controlled Draft/Trade |
| Mexico | 20 | Apr–Sep | Hybrid Open Market |
| Dominican | 6 | Oct–Jan | Winter Open Market |
| Venezuela | 8 | Oct–Jan | Winter Open Market |
| Puerto Rico | 6 | Nov–Jan | Winter Open Market |
| Cuba | 16 | Sep–Jan | Domestic Development Hybrid |
| Netherlands | 10 | Apr–Sep | Football Transfer Academy |
| Germany | 12 | Apr–Sep | Football Transfer Academy |
| France | 10 | Apr–Sep | Football Transfer Academy |
| Spain | 10 | Mar–Aug | Football Transfer Academy |
| United Kingdom | 10 | Apr–Sep | Football Transfer Academy |
| Italy | 12 | Mar–Sep | Football Transfer Academy |
| Russia | 10 | May–Sep | Football Transfer Academy |
| Pan-Africa | 12 | Nov–Mar | Football Transfer + Growth |
| Australia | 8 | Nov–Feb | Hybrid Open Market |
| New Zealand/Pacific | 8 | Nov–Feb | Football Transfer + Winter |
| **Total** | **240** | — | — |

---

# 10. 市場はLeague Ecologyの一部

Player Marketは単なるメニューではない。

例えば「若手を売るリーグ」では、

```text
academy investment
  ↓
good young players emerge
  ↓
wealthier leagues buy them
  ↓
training compensation / transfer fee
  ↓
selling club reinvests
  ↓
development improves
```

一方、富裕クラブが多いリーグでは、

```text
large transfer budget
  ↓
foreign stars arrive
  ↓
local players encounter new pitch / swing / tactics
  ↓
Exposure distribution changes
  ↓
league style evolves
```

したがって市場構造そのものが数十年単位でLeague Ecologyを変え得る。

ただし、

```text
rich league -> power +10
selling league -> contact -5
```

のような直接能力補正は禁止する。

---

# 11. League Levelと市場価値を混同しない

選手のTransfer Valueは公開能力ランクだけで決めない。

候補:

```text
TransferValue =
  true / estimated ability
+ age
+ potential
+ contract years
+ scarcity
+ positional demand
+ nationality / registration eligibility (rules only)
+ commercial / popularity value
+ recent performance
+ injury risk
+ buying-club need
+ selling-club finances
+ competition exposure
+ uncertainty
```

ここでNationality等は能力を変えるためではなく、roster / registration ruleの条件としてのみ使う。

---

# 12. Loanの因果的価値

Loanは単に経験値を付与しない。

```text
loan to another league
  ↓
actual playing time
  ↓
real match events
  ↓
Exposure / Familiarity
  ↓
technical / tactical learning opportunities
  ↓
development update
```

出場できなければLoanの成長効果も小さい。

---

## 12.1 Competition Architecture

21リーグを入力とするクラブ・代表の世界大会設計候補は以下へ分離する。

- `docs/game-design/11-world-competition-architecture.md`

11は現在設計候補版であり、ユーザー承認後にCompetition設計の正史文書へ昇格する。

# 13. Competition設計への入力

このWorld League Catalogを前提に、次のCompetition設計を行う。

順序:

1. continental club competitions
2. club world competition
3. regional national-team competitions
4. Premier-class national tournament
5. WBC-class world championship
6. qualification
7. calendar
8. prize / prestige
9. roster call-up rules

大陸クラブ大会の基本地域:

```text
Asia:
  5 Full Leagues

Americas:
  6 Full Leagues

Europe:
  7 Full Leagues

Africa:
  Pan-African Full League
  + Lightweight domestic leagues

Oceania:
  2 Full Leagues
```

Lightweight Leagueにも予選経路を与えられるため、Full League以外を世界大会から完全排除しない。

---

# 14. 後続で校正する事項

- 各leagueの最終球団名
- expansion / contraction rules
- salary / transfer budget scale
- transfer window dates
- foreign-player / homegrown rules
- amateur draft eligibility
- academy age bands
- transfer fee formulas
- training compensation / solidarity percentage
- loan limits
- agent fee rules
- roster size
- farm / reserve team structure
- exact season game count
- postseason formats
- cross-league calendar conflicts
- national-team release obligations
- club coefficient integration

具体値はCompetition / Career Economy設計で調整する。
