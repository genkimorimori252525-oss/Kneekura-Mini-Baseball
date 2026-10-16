# East Asia Club Catalog — Japan / Korea / Taiwan / China

更新日: 2026-09-20  
状態: **初期Club Seed Catalog v1。実在Club identityを使用。**

関連:
- `docs/game-design/10-world-league-catalog.md`
- `docs/game-design/16-club-economy-rivalry-design.md`
- `docs/game-design/18-club-state-lifecycle.md`
- `docs/game-design/20-simple-surface-deep-simulation.md`
- `docs/game-design/21-world-club-source-policy.md`

---

# 1. 共通原則

Japan / Korea / Taiwanは実在野球Clubを使用する。

Chinaは明示的例外として、実在Football Clubを同名の野球Clubとして使用する。

このCatalogのEconomic Bandは**初期Game Seed**であり、監査済み現実財務順位ではない。

Career開始後はCurrent Economyから再計算する。

---

# 2. Japan League — NPB 12 Clubs

2026 NPBの12球団をそのまま使用する。

## Central side

| Club | Home identity | Real home stadium | Initial Economic Seed |
| --- | --- | --- | --- |
| 読売ジャイアンツ | Tokyo | 東京ドーム | ELITE |
| 阪神タイガース | Hyogo / Osaka-Kobe market | 阪神甲子園球場 | ELITE |
| 横浜DeNAベイスターズ | Yokohama | 横浜スタジアム | HIGH |
| 中日ドラゴンズ | Nagoya / Tokai | バンテリンドーム ナゴヤ | UPPER |
| 広島東洋カープ | Hiroshima | MAZDA Zoom-Zoom スタジアム広島 | UPPER |
| 東京ヤクルトスワローズ | Tokyo | 明治神宮野球場 | UPPER |

## Pacific side

| Club | Home identity | Real home stadium | Initial Economic Seed |
| --- | --- | --- | --- |
| 福岡ソフトバンクホークス | Fukuoka / Kyushu | みずほPayPayドーム福岡 | ELITE |
| 北海道日本ハムファイターズ | Hokkaido | エスコンフィールドHOKKAIDO | HIGH |
| オリックス・バファローズ | Osaka / Kansai | 京セラドーム大阪 | HIGH |
| 東北楽天ゴールデンイーグルス | Sendai / Tohoku | 楽天モバイル 最強パーク宮城 | HIGH |
| 埼玉西武ライオンズ | Saitama | ベルーナドーム | UPPER |
| 千葉ロッテマリーンズ | Chiba | ZOZOマリンスタジアム | UPPER |

### Seed interpretation

- Giants / Tigers / Hawksは大規模なfanbase / commercial power / retention力を持つ初期巨大層。
- BayStars / Fighters / Buffaloes / Eaglesは強いmarket / ownership / investment capacityを持つ上位層。
- その他もプロ一軍Clubとして十分な経済基盤を持つ。

これは固定順位ではない。

## Initial Rivalry Seeds

```text
Hanshin -> Yomiuri       very high
Yomiuri -> Hanshin       very high

SoftBank -> Seibu        medium-high
Seibu -> SoftBank        high

Orix -> Hanshin          medium
Hanshin -> Orix          medium

DeNA -> Yomiuri          medium
Yomiuri -> DeNA          low-medium
```

伝統・地域・近年の競争によってPennant中に変化可能。

---

# 3. Korea League — KBO 10 Clubs

2026 KBOの10球団を使用する。

| Club | Home identity | Initial Economic Seed |
| --- | --- | --- |
| LG 트윈스 / LG Twins | Seoul | ELITE |
| 두산 베어스 / Doosan Bears | Seoul | HIGH |
| 키움 히어로즈 / Kiwoom Heroes | Seoul | MID |
| SSG 랜더스 / SSG Landers | Incheon | HIGH |
| KT 위즈 / KT Wiz | Suwon | HIGH |
| 한화 이글스 / Hanwha Eagles | Daejeon | HIGH |
| 삼성 라이온즈 / Samsung Lions | Daegu | ELITE |
| 롯데 자이언츠 / Lotte Giants | Busan | HIGH |
| NC 다이노스 / NC Dinos | Changwon | UPPER |
| KIA 타이거즈 / KIA Tigers | Gwangju | ELITE |

Economic Seedは親会社規模そのものではなく、Baseball Clubの初期投資力・市場・fanbase・組織規模をまとめたGame Seed。

## Initial Rivalry Seeds

```text
LG -> Doosan        very high
Doosan -> LG        very high

KIA -> Samsung      high
Samsung -> KIA      high

Lotte -> NC         high
NC -> Lotte         high

SSG -> Kiwoom       medium
Kiwoom -> SSG       medium

Hanwha -> KIA       medium
```

同じ都市・地域や歴史的競争をHistoricalBaseへ置く。

---

# 4. Taiwan League — CPBL 6 Clubs

旧World Designの8Club仮設定を廃止し、2026 CPBLの現行6球団へ合わせる。

| Club | Home identity | Initial Economic Seed |
| --- | --- | --- |
| 中信兄弟 / CTBC Brothers | Taichung | HIGH |
| 統一7-ELEVEn獅 / Uni-President 7-Eleven Lions | Tainan | HIGH |
| 樂天桃猿 / Rakuten Monkeys | Taoyuan | HIGH |
| 味全龍 / Wei Chuan Dragons | Taipei | UPPER |
| 富邦悍將 / Fubon Guardians | New Taipei | HIGH |
| 台鋼雄鷹 / TSG Hawks | Kaohsiung | UPPER |

## Why 6

REAL_BASEBALL_CLUB方針では、架空の7・8番目のClubを足して旧8Club設計を守るより、現行CPBLをそのまま使う。

そのため:

```text
Taiwan Full League
8 -> 6 clubs
```

へ変更する。

Regular Seasonは100試合以上という全世界原則を維持し:

```text
5 opponents x 20
= 100 games
```

とする。

## Initial Rivalry Seeds

```text
Wei Chuan -> CTBC          very high
CTBC -> Wei Chuan          high

CTBC -> Uni-Lions          high
Uni-Lions -> CTBC          high

Rakuten -> CTBC            medium-high
CTBC -> Rakuten            medium-high
```

---

# 5. China League — Real Football Clubs as Baseball Clubs

Chinaは野球Club sourceではなく、2026 Chinese professional football ecosystemを使用する。

10Club Full Leagueとして、現行上位・主要市場のClubを初期採用する。

| Club | City | Initial Economic Seed |
| --- | --- | --- |
| 上海海港 / Shanghai Port | Shanghai | ELITE |
| 上海申花 / Shanghai Shenhua | Shanghai | ELITE |
| 北京国安 / Beijing Guoan | Beijing | HIGH |
| 山东泰山 / Shandong Taishan | Jinan | HIGH |
| 成都蓉城 / Chengdu Rongcheng | Chengdu | HIGH |
| 天津津门虎 / Tianjin Jinmen Tiger | Tianjin | UPPER |
| 浙江职业足球俱乐部 / Zhejiang FC | Hangzhou | UPPER |
| 云南玉昆 / Yunnan Yukun | Yuxi | UPPER |
| 青岛西海岸 / Qingdao West Coast | Qingdao | MID |
| 河南足球俱乐部 / Henan FC | Zhengzhou | MID |

実在Football Clubの:

- name
- city
- brand / fanbase
- ownership / funding character
- academy / youth identity
- traditional rivalry

をBaseball Club Seedとして利用する。

Footballの選手・勝敗・順位はBaseballへ移さない。

## Initial Rivalry Seeds

```text
Shanghai Port -> Shanghai Shenhua   very high
Shanghai Shenhua -> Shanghai Port   very high

Beijing Guoan -> Shandong Taishan   high
Shandong Taishan -> Beijing Guoan   high

Beijing Guoan -> Shanghai Shenhua   high
Shanghai Shenhua -> Beijing Guoan   high

Chengdu Rongcheng -> Beijing Guoan  medium
```

---

# 6. Russia Status

Russiaは既にEurope CatalogでREAL_FOOTBALL_CLUB_AS_BASEBALL_CLUBとして整備済み。

初期Clubには:

- FC Zenit Saint Petersburg
- FC Spartak Moscow
- FC Dynamo Moscow
- FC Krasnodar
- PFC CSKA Moscow
- FC Lokomotiv Moscow
- FC Rubin Kazan
- FC Rostov
- PFC Krylia Sovetov Samara
- FC Akhmat Grozny

を使用する。

Russiaを別途Baseball Clubへ差し替えない。

---

# 7. Economy Surface

ユーザー画面では詳細財務を要求しない。

例:

```text
Yomiuri Giants
資金力      S
人気        S
育成        A
スカウト    A
補強余力    大
```

内部では:

- recurring revenue
- supporter capital
- ownership backing
- stadium revenue
- payroll commitments
- scouting / academy investment

等から計算する。

---

# 8. Seed vs Current State

このCatalogの:

- Economic Seed
- Rivalry Seed
- ownership reference
- stadium reference

はCareer開始時だけ。

Pennant開始後は:

- Economic Band
- rivalry intensity
- owner
- roster
- budget
- reputation

がSave内の歴史で変動する。

---

# 9. Source Snapshot

Catalog v1 source snapshot:

- NPB official 2026 team / franchise stadium list
- KBO official 2026 club information
- CPBL official 2026 standings / club list
- China professional football 2026 admission / national-team club references

未公開のClub exact revenueは捏造せず、Initial Economic Seedとしてrelative bandのみ置く。
