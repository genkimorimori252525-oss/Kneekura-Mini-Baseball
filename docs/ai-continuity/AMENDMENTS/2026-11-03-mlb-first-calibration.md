# 較正の基準を MLB に置く方針 2026-11-03

## 本人の決定
- 打撃・走力・守備のどれも、まず MLB（Statcast で測られたデータがある）に合わせて較正する。
- 現在の NPB 設定（`cfg-npb`、NPB平均の標準リーグ）は消さずに残す。打撃を NPB に合わせても、守備力が NPB 並みだと示せないので、NPB は走力・守備も含めて後で作り直す。
- NPB の水準は、MLB で較正した後に MLB から導く。手がかりは、NPB から MLB に移った選手。特に NPB で守備の評判が高かった選手の Statcast の値（OAA、肩、スプリント、外野の初動など）と、MLB での使われ方（定位置を取れたか、守備位置を変えられたか、控えに回ったか）。
- 確かなこととして置く前提: NPB の守備力は MLB より劣る。
- 情報は取捨選択してよい（本人の許可）。

## 進め方
1. 野手と走者の体を Statcast に合わせる。外野の初動（投球から3秒で平均33.9ft）、捕球確率の時間と距離、守備位置ごとの肩（一塁74.8・二塁78.2・遊撃83.3・三塁83.5・左翼86.2・中堅87.8・右翼89.4・捕手82.4 mph）、本塁→一塁 4.47秒、90ft の通過時刻（5ft 0.55秒、30ft 1.80秒、90ft 4.03秒）。数値の出典は `2026-11-03-defense-by-evaluation.md` の「調査で得た数値」。
2. 標準リーグの野手に、守備位置ごとの差を持たせる（今は9人とも同じ体）。
3. 打撃と得点の環境を MLB に合わせる（MLB の期待失点表は FanGraphs、得点は約4.15/試合の年のもの）。
4. MLB で較正した後、NPB から移った選手の MLB での値と起用から、NPB の守備・走力・打撃の水準を導く。

## 2026-11-03 時点の標準リーグと Statcast の比較
| 項目 | 試合 | MLB |
|---|---|---|
| 外野手が投球から3秒で進む距離 | 30.0ft | 平均33.9ft（下位10%は31.3ft） |
| 内野手の10ヤード | 1.75秒 | 約1.7秒 |
| 走者の最初の5ft／90ft | 0.67秒／4.14秒 | 0.55秒／4.03秒 |
| 肩 | 全員87mph | 守備位置で75〜89mph |
| 最高速 | 26.6ft/s | 平均27.3ft/s |

## 会話で挙がった参考（外部）
- Simple Fielding（github.com/mrthames/simple-fielding）: 9人の役割分担の考え方。PolyForm Noncommercial 1.0.0 なのでコードは使わない。
- SEAM Fielder Optimization（github.com/colalb1/SEAM-Fielder-Optimization）: 打球分布と守備範囲による配置の最適化。MIT。
- Baseball Savant: Catch Probability、Outfielder Jump、Arm Strength、Sprint Speed、Outs Above Average。
- PLOS ONE「The Complete Defensive Strategy」（2026-10）。SABR Analytics 2025 の外野手の走路の発表。Baseball Positive の Ball → Base → Back-up。
- 期待失点: NPB 2015-2017（DELTA、ja.wikipedia の Linear Weights）、MLB（FanGraphs RE24）。
