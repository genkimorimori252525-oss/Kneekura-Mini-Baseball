# Europe Real Club Catalog — 74 Clubs

更新日: 2026-09-20  
状態: **初期Seed Catalog v1。私的利用前提。Career開始後の現在状態ではない。財務値はsnapshot sourceを固定し、未確認値は捏造しない。**

関連:
- `docs/game-design/10-world-league-catalog.md`
- `docs/game-design/13-domestic-league-championships.md`
- `docs/game-design/16-club-economy-rivalry-design.md`
- `docs/game-design/18-club-state-lifecycle.md`

---

# 1. 方針

Europe 7 Full Leaguesでは、架空のFootball-inspired Club名を作らない。

**実在Football Clubを同名の野球Clubとしてゲーム世界へ配置する。**

引き継ぐもの:

- club name
- home city / regional identity
- brand / fanbase hierarchy
- real-world economic scale
- ownership / funding character where data is available
- academy / development reputation
- traditional rivalries

ただしBaseball roster / baseball stadium / baseball resultsはゲーム世界側で生成する。

Football成績をBaseball勝敗へ直接コピーしない。

## 1.1 この文書はInitial Seedである

本書のBand / finance / fanbase / academy / rivalry情報は、Career作成時の初期状態を生成するためのSeed。

Pennant開始後は `docs/game-design/18-club-state-lifecycle.md` に従い、Save内の歴史だけで変化する。

```text
catalog says Bayern = MEGA at start
          ↓
Career begins
          ↓
current Bayern economy becomes simulation state
          ↓
MEGA / ELITE / HIGH... are recalculated over time
```

したがって本書を参照して2035年のBayernを再びMEGAへ戻すことは禁止する。

Club名・origin reference等のIdentityと、Economic Band等の初期状態を区別する。

---

# 2. Economy Snapshot Policy

Economic seedは実在Football Clubの財務snapshotを参照する。

初期基準:

- season: **2024/25**
- publication cycle: **2026**
- major source: Deloitte Football Money League 2026
- Russia supplemental source: 2025 RPL club expenditure reporting

実額が確認できる場合は `verifiedRevenueEurM` 等へ保存する。

確認できないClubには精密な架空実額を入れない。

代わりに `economicBand` を使い、後続データ収集で置換する。

## 2.1 Global Economic Bands

| Band | 意味 |
| --- | --- |
| MEGA | 世界最大級。リーグ中央値から大きく突出 |
| ELITE | 欧州最高水準の巨大Club |
| HIGH | 大陸大会常連級の強い経済基盤 |
| UPPER | 国内上位の安定した資金力 |
| MID | 国内中位規模 |
| LOW | 小市場 / 小規模 |

Band自体はMatch Core Buffではない。またPennant中の永久属性でもなく、Career開始後はCurrent Economyから再計算する。

---

# 3. Netherlands League — 10 Clubs

| Club | City | Band | Verified 2024/25 revenue |
| --- | --- | --- | ---: |
| AFC Ajax | Amsterdam | UPPER | — |
| PSV Eindhoven | Eindhoven | UPPER | — |
| Feyenoord | Rotterdam | UPPER | — |
| AZ Alkmaar | Alkmaar | MID | — |
| FC Twente | Enschede | MID | — |
| FC Utrecht | Utrecht | MID | — |
| SC Heerenveen | Heerenveen | LOW | — |
| FC Groningen | Groningen | LOW | — |
| NEC Nijmegen | Nijmegen | LOW | — |
| Sparta Rotterdam | Rotterdam | LOW | — |

初期構造:

- Ajax / PSV / Feyenoordを国内最大経済圏
- AZ / Twente / Utrechtを上位挑戦層
- 残りを育成・売却・地域密着型

---

# 4. Germany League — 12 Clubs

| Club | City | Band | Verified 2024/25 revenue |
| --- | --- | --- | ---: |
| FC Bayern München | Munich | MEGA | €860.6m |
| Borussia Dortmund | Dortmund | ELITE | €531.3m |
| VfB Stuttgart | Stuttgart | HIGH | €296.3m |
| Eintracht Frankfurt | Frankfurt | HIGH | €269.9m |
| Bayer 04 Leverkusen | Leverkusen | HIGH | — |
| RB Leipzig | Leipzig | HIGH | — |
| Borussia Mönchengladbach | Mönchengladbach | UPPER | — |
| VfL Wolfsburg | Wolfsburg | UPPER | — |
| SV Werder Bremen | Bremen | UPPER | — |
| SC Freiburg | Freiburg | UPPER | — |
| TSG 1899 Hoffenheim | Sinsheim | MID | — |
| 1. FC Union Berlin | Berlin | MID | — |

初期の経済的中心はFC Bayern München。

ただしBayernに優勝確率補正は与えない。

---

# 5. France League — 10 Clubs

| Club | City | Band | Verified 2024/25 revenue |
| --- | --- | --- | ---: |
| Paris Saint-Germain | Paris | MEGA | €837.0m |
| Olympique de Marseille | Marseille | HIGH | — |
| Olympique Lyonnais | Lyon | HIGH | — |
| AS Monaco | Monaco | HIGH | — |
| LOSC Lille | Lille | UPPER | — |
| OGC Nice | Nice | UPPER | — |
| Stade Rennais FC | Rennes | UPPER | — |
| RC Lens | Lens | UPPER | — |
| RC Strasbourg Alsace | Strasbourg | UPPER | — |
| FC Nantes | Nantes | MID | — |

PSGはリーグ中央値から大きく突出した資金力を持つ初期状態。

その差は:

- payroll
- transfer capacity
- commercial revenue
- owner funding capacity
- player retention

を通じてBaseball roster差へ変換される。

---

# 6. Spain League — 10 Clubs

| Club | City | Band | Verified 2024/25 revenue |
| --- | --- | --- | ---: |
| Real Madrid CF | Madrid | MEGA | €1,161.0m |
| FC Barcelona | Barcelona | MEGA | €974.8m |
| Atlético de Madrid | Madrid | ELITE | €454.5m |
| Athletic Club | Bilbao | HIGH | — |
| Villarreal CF | Villarreal | HIGH | — |
| Real Sociedad | San Sebastián | HIGH | — |
| Real Betis Balompié | Seville | HIGH | — |
| Sevilla FC | Seville | HIGH | — |
| Valencia CF | Valencia | UPPER | — |
| Girona FC | Girona | UPPER | — |

Real Madrid / Barcelonaの経済規模は世界最大級。

Atléticoがその次の明確な大規模Club。

---

# 7. United Kingdom League — 10 Clubs

United Kingdom LeagueはEnglandだけでなくScotlandの巨大Clubも含める。

| Club | City | Band | Verified 2024/25 revenue |
| --- | --- | --- | ---: |
| Liverpool FC | Liverpool | MEGA | €836.1m |
| Manchester City | Manchester | MEGA | €829.3m |
| Arsenal | London | MEGA | €821.7m |
| Manchester United | Manchester | MEGA | €793.1m |
| Tottenham Hotspur | London | ELITE | €672.6m |
| Chelsea | London | ELITE | €584.1m |
| Aston Villa | Birmingham | ELITE | €450.2m |
| Newcastle United | Newcastle upon Tyne | HIGH | €398.4m |
| Celtic FC | Glasgow | UPPER | — |
| Rangers FC | Glasgow | UPPER | — |

このLeagueは世界で最も経済密度が高い初期League候補。

ただしLeague全体へ能力Buffは与えない。

---

# 8. Italy League — 12 Clubs

| Club | City | Band | Verified 2024/25 revenue |
| --- | --- | --- | ---: |
| FC Internazionale Milano | Milan | ELITE | €537.5m |
| AC Milan | Milan | ELITE | €410.4m |
| Juventus | Turin | ELITE | €401.7m |
| SSC Napoli | Naples | HIGH | — |
| AS Roma | Rome | HIGH | €216.3m |
| Atalanta BC | Bergamo | HIGH | — |
| SS Lazio | Rome | UPPER | — |
| ACF Fiorentina | Florence | UPPER | — |
| Bologna FC 1909 | Bologna | UPPER | — |
| Torino FC | Turin | MID | — |
| Genoa CFC | Genoa | MID | — |
| Udinese Calcio | Udine | MID | — |

Milan / Inter、Turin、Romeの都市内Rivalryをdirected relation seedへ利用可能。

---

# 9. Russia League — 10 Clubs

RussiaはDeloitte Money Leagueと同じRevenue比較だけでは扱いにくいため、公開された2025 club expenditureも補助Evidenceとして使う。

| Club | City | Band | Verified finance note |
| --- | --- | --- | --- |
| FC Zenit Saint Petersburg | Saint Petersburg | HIGH | 2025 expenditure: RUB 22.99bn |
| FC Spartak Moscow | Moscow | HIGH | 2025 expenditure: RUB 18.76bn |
| FC Dynamo Moscow | Moscow | UPPER | 2025 expenditure: RUB 12.92bn |
| FC Krasnodar | Krasnodar | UPPER | 2025 expenditure: RUB 12.02bn |
| PFC CSKA Moscow | Moscow | UPPER | 2025 expenditure: RUB 11.87bn |
| FC Lokomotiv Moscow | Moscow | UPPER | — |
| FC Rubin Kazan | Kazan | MID | — |
| FC Rostov | Rostov-on-Don | MID | — |
| PFC Krylia Sovetov Samara | Samara | LOW | — |
| FC Akhmat Grozny | Grozny | LOW | — |

Russia Club economyもLeague-relativeだけでなく、可能な範囲でabsolute Moneyとして保持する。

---

# 10. Initial Directed Rivalry Seeds

Rivalryは必ず有向で保存する。

初期seed候補:

## Spain

```text
Real Madrid -> Barcelona
Barcelona -> Real Madrid

Atlético -> Real Madrid
Real Madrid -> Atlético

Betis -> Sevilla
Sevilla -> Betis
```

強度は双方同一である必要はない。

## Germany

```text
Dortmund -> Bayern
Bayern -> Dortmund

Leverkusen -> Bayern
Leipzig -> Bayern
Stuttgart -> Bayern
Frankfurt -> Bayern
...
```

BayernはLeague支配歴・経済規模により多数Clubから `DOMINANT_CLUB_TARGET` を持たれやすい。

しかしBayern側が全Clubを同じ強さで意識する必要はない。

## France

```text
Marseille -> PSG
PSG -> Marseille

Lyon -> PSG
Monaco -> PSG
Lille -> PSG
...
```

## United Kingdom

```text
Manchester United <-> Manchester City
Liverpool <-> Manchester United
Arsenal <-> Tottenham
Celtic <-> Rangers
Chelsea -> Arsenal
Newcastle -> Manchester City
...
```

## Italy

```text
Inter <-> Milan
Juventus <-> Torino
Roma <-> Lazio
Inter <-> Juventus
Milan <-> Juventus
```

Netherlands / Russiaも同様に実際のFootball rivalryを初期seedとして使用できる。

---

# 11. Economic Translation into Baseball

Football revenueをそのままBaseball payrollに使うと桁が不自然になり得るため、relative structureを保持した変換層を置く。

例:

```text
Real football revenue
        ↓
global normalized finance index
        ↓
league economy scaling
        ↓
baseball payroll / transfer / academy budgets
```

必要条件:

- Real Madridが€1.16bn規模でBarcelonaより大きいsnapshotなら、その初期経済優位を保存する
- BayernがDortmundより大きい差を保存する
- PSGがFrance League中央値から突出している差を保存する
- lower clubをLeague平均へ無理に均す処理は禁止

ただしBaseballのPlayer Market価格水準そのものは別に校正する。

---

# 12. No Fixed Sporting Outcome

実在Footballの順位・タイトル数はBaseball Season結果へコピーしない。

```text
real club economy / identity
 -> starting resources
 -> baseball recruitment / retention / development
 -> actual baseball roster
 -> Match Core
 -> result
```

したがって:

- Bayernが最下位になることも可能
- PSGがPS敗退することも可能
- Small Clubがacademy世代で優勝することも可能
- Real Madridがbad contractsで長期低迷することも可能

経済格差は勝敗を説明する大きな原因だが、結果そのものではない。

---

# 13. Finance Snapshot Metadata

各Clubの外部referenceはversion付きで保持する。

```ts
type FootballFinanceReference = {
  clubId: ClubId;
  snapshotSeason: "2024/25";
  sourcePublishedYear: 2026;
  verifiedRevenueEurM?: number;
  verifiedExpenditureLocal?: Money;
  economicBand: ClubEconomicBand;
  sourceKey: string;
  verifiedAt: CalendarDate;
};
```

これにより将来2027 / 2028データへ更新しても、既存Career Saveの初期経済を勝手に書き換えない。

---

# 14. Sources Used for v1

主要財務基準:

- Deloitte Football Money League 2026 — 2024/25 revenue
- Deloitte Annual Review of Football Finance 2026 — European league economic context
- Vedomosti Sport, 2026-04-22 — 2025 Russian Premier League club expenditure

未確認Clubの実額はこのv1では記入しない。

---

# 15. 次の作業

次はこの74 Clubに対して、

1. stadium / baseball venue scale
2. ownership / funding model
3. academy / scouting scale
4. initial fanbase
5. full directed rivalry graph
6. starting baseball budget conversion

を順番に追加する。

その後、Europe以外のFootball-derived leagues:

- China
- West / South Asia
- Pan-African
- New Zealand / Pacific

へ同じ方式を適用する。
