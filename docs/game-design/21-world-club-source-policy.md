# World Club Source Policy

更新日: 2026-09-20  
状態: **設計承認版。各地域Club Catalogの選定原則。**

関連:
- `docs/game-design/10-world-league-catalog.md`
- `docs/game-design/16-club-economy-rivalry-design.md`
- `docs/game-design/17-europe-real-club-catalog.md`
- `docs/game-design/18-club-state-lifecycle.md`
- `docs/game-design/20-simple-surface-deep-simulation.md`

---

# 1. 基本方針

Club sourceは、その国・地域で現実に人々が認識している主要なClub文化を優先する。

```text
strong / established baseball club culture
 -> real baseball clubs

baseball is not the major club culture
 -> real football clubs as baseball clubs
```

単に「野球大会が存在するか」だけでは決めない。

ゲーム世界でその地域のClub hierarchy、知名度、資金格差、ライバル関係を自然に理解できることを優先する。

---

# 2. Source Types

## REAL_BASEBALL_CLUB

実在野球Clubを同名・同都市・同歴史的identityで使用する。

## REAL_FOOTBALL_CLUB_AS_BASEBALL_CLUB

実在Football Clubを同名・同都市・同ブランド/経済階層の野球Clubとして使用する。

Footballの勝敗・選手能力は移植しない。

引き継ぐのはClub identity / economy seed / fanbase / rivalry / institutional scale。

---

# 3. League-by-League Source Matrix

この表のRegionは**Competition Region**。Australia / New Zealand / Pacificの地理分類はOceaniaのままだが、大会上はAsia-Pacificに含める。

| Region | League | Source |
| --- | --- | --- |
| Asia-Pacific | Japan | REAL_BASEBALL_CLUB |
| Asia-Pacific | Korea | REAL_BASEBALL_CLUB |
| Asia-Pacific | Taiwan | REAL_BASEBALL_CLUB |
| Asia-Pacific | China | REAL_FOOTBALL_CLUB_AS_BASEBALL_CLUB |
| Asia-Pacific | West / South Asia | REAL_FOOTBALL_CLUB_AS_BASEBALL_CLUB |
| Americas | North America | REAL_BASEBALL_CLUB |
| Americas | Mexico | REAL_BASEBALL_CLUB |
| Americas | Dominican | REAL_BASEBALL_CLUB |
| Americas | Venezuela | REAL_BASEBALL_CLUB |
| Americas | Puerto Rico | REAL_BASEBALL_CLUB |
| Americas | Cuba | REAL_BASEBALL_CLUB |
| Europe | Netherlands | REAL_FOOTBALL_CLUB_AS_BASEBALL_CLUB |
| Europe | Germany | REAL_FOOTBALL_CLUB_AS_BASEBALL_CLUB |
| Europe | France | REAL_FOOTBALL_CLUB_AS_BASEBALL_CLUB |
| Europe | Spain | REAL_FOOTBALL_CLUB_AS_BASEBALL_CLUB |
| Europe | United Kingdom | REAL_FOOTBALL_CLUB_AS_BASEBALL_CLUB |
| Europe | Italy | REAL_FOOTBALL_CLUB_AS_BASEBALL_CLUB |
| Europe | Russia | REAL_FOOTBALL_CLUB_AS_BASEBALL_CLUB |
| Africa | Pan-African | REAL_FOOTBALL_CLUB_AS_BASEBALL_CLUB |
| Asia-Pacific | Australia | REAL_BASEBALL_CLUB |
| Asia-Pacific | New Zealand / Pacific | REAL_FOOTBALL_CLUB_AS_BASEBALL_CLUB |

---

# 4. Explicit Overrides

## China

中国には野球Leagueが存在しても、本ゲームでは**Football Club Cultureを採用する**。

理由はゲーム設計上の明確なユーザー指定。

したがってChina LeagueはChinese Super League系の実在Clubを野球Club化する。

## Russia

EuropeのClub CultureとしてFootball sourceを採用する。

既存Europe Catalogの:

- FC Zenit Saint Petersburg
- FC Spartak Moscow
- PFC CSKA Moscow
- FC Dynamo Moscow
- FC Krasnodar
- etc.

を維持する。

---

# 5. Real League Count Principle

REAL_BASEBALL_CLUBを採用するLeagueでは、可能な限り**現在の実在一軍Club数をそのまま使用する**。

実在Clubを使うためだけに架空Expansion Clubを追加しない。

したがってCatalog整備時に旧World Designの仮Club数と現実が違う場合、League club countを再校正してよい。

例:

```text
Taiwan old design = 8
2026 CPBL current clubs = 6
 -> Taiwan Full League = 6
```

World total club countは設計上の神聖な固定値ではない。

---

# 6. Initial Data vs Pennant State

現実Clubから取り込む:

- name
- city
- stadium / home identity
- ownership model
- financial scale evidence
- fanbase scale
- academy / development reputation
- traditional rivalry

はInitial Seed。

Career開始後は現実世界と切り離し、Save内の歴史だけで変化する。

---

# 7. Economic Data Rule

公開された実財務がある場合:

```text
verified finance
 -> initial economic seed
```

を使う。

実財務が確認できない場合:

- parent / ownership structure
- attendance / fanbase scale
- stadium scale
- market size
- historical sporting/commercial position

をEvidenceに、`initialEconomicBand` を置いてよい。

ただしこれは**Game Seed**であり、「監査済み現実財務ランキング」とは扱わない。

---

# 8. User-facing Simplicity

ユーザーはClub source policyや財務計算を操作しない。

通常画面では:

- 資金力
- 人気
- 育成
- スカウト
- 補強予算
- 財政状態

程度へ要約する。

内部だけ現実的に計算する。

---

# 9. Catalog Build Order

初期整備順:

1. Russia — Europe Catalog済み
2. Japan
3. Korea
4. Taiwan
5. China
6. West / South Asia — completed in 23
7. North America — completed in 24
8. Mexico — completed in 24
9. Dominican — completed in 24
10. Venezuela — completed in 24
11. Puerto Rico — completed in 24
12. Cuba — completed in 24
13. Australia — completed in 25
14. New Zealand / Pacific — completed in 25
15. Pan-African refinement — completed in 25

Europe 7は17で整備済み。

---

# 10. Current Source Notes

2026確認:

- NPB: 12 first-team clubs
- KBO: 10 first-team clubs
- CPBL: 6 current clubs
- China: 2026 professional football clubsをChina baseball-world Club sourceに使用
- ABL: 2026 season is a 4-club competition; Australia Full League is recalibrated to 4 clubs

Source snapshotはCatalog metadataとしてversion固定する。

- `docs/game-design/23-west-south-asia-club-catalog.md`
- `docs/game-design/24-americas-real-baseball-club-catalog.md`
- `docs/game-design/25-australia-pacific-africa-club-catalog.md`