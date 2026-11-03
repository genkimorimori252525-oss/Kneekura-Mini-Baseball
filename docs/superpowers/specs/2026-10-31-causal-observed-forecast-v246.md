# 配達済み観測からの三次予測：明示実験

2026-10-31 JST / MB-20261027-REALISM-DEBUG-PLAN。6投球・理想位置の固定pilotでは7点三次QRの位置誤差が改善したが、人間校正と一般性は未確認。旧V151 defaultとJSONをそのまま保持し、明示policyに限るV246を導入する。候補不足時の条件を結果に合わせて変更しない。

## 第一単位: 純粋予測と旧fallback

新 ObservedPitchForecastV246 は、originTick/ticksPerSecond/cutoffTick/planeZ/maximumAfterReleaseSeconds/observations と、versioned実験policyを受ける。観測済みかつavailableTick≤cutoffの直近最大7点のみ。任意の未来球・実contact・実spin・成否・技術名は入力しない。

- 4個以上の異なる点。時刻を最後点中心・観測窓で無次元化し再直交化QRで三次を推定する。係数・位置・速度・加速度・rootが非有限、rank不足や事前宣言した数値安定条件違反なら旧V151をそのまま呼ぶ。人間知覚の実測保証値とは言わない。
- policyは外挿長／観測時間幅の正の上限と、forward crossingの安全条件を明示し、試行前に固定する。数値を特定の6投球の結果に合わせて調整しない。新moduleでは呼出側指定のpolicyを厳密検証し、製品既定値を暗黙に作らない。
- 求根は先に定めた有限horizon内の最初の減少方向crossingのみ。複数根や接線・不確かなrootから成否が良いものを選ばず、範囲外・不明は理由付き旧fallback。位置・速度・加速度は同じ多項式・同じanchorで算出する。
- 出力diagnosticにはrequested/effective model、観測ID/cutoff/anchor、外挿長・観測幅、fallback理由、未校正・未来不使用を持つ。正常fallbackに失敗した場合は旧V151自身の状態を正確に保持する。

## 受入と次単位

等速・定加速度・三次の独立な既知多項式（非等間隔/大きなabsolute tick含む）でp/v/aとforward crossing、未来や未配達の点を変えても結果不変、重複tick/点不足/rank/非有限/範囲外/不確かなrootのfallback、同入力決定性を検証する。正常old V151を再実装せず既存関数を呼び、旧入力には一切新fieldを要求しない。実行前に各testの条件を固定し、後から6投球に合わせて数値を調整しない。

次単位は既存observerとLiveに明示policyを接続し、normal/trial同一の配達予測、旧default/roster/clock/RNG/旧JSON同値を実証する。下流V153がp/v/aの定加速度として接触探索するモデル差を診断に明示し、三次が全経路で維持されたと誤認しない。実際の4技術の接触・spin・空力・既定2試行の確認/学習認証、キレ、Gold、完成3HTML配送は未完。

## 後続の既存observer／Live統合で保持する境界

現在のV244はV151 snapshotを独立再計算してforecast一致を検査し、V222のregion経験・Hostの記憶もV151の証拠を利用している。V246の結果をV151型や旧snapshotとして偽装しない。旧snapshot/旧記憶経路は従来値のまま、新policyを指定した場合だけ別のV246 snapshot（配達済み7点・policy・effective forecast・fallback理由）を保存し、その同じ入力から再導出してV244の新forecast側を検証する。fallbackなら実際の旧forecastをそのまま選ぶ。legacy V236/V238・default経路は旧V151 contractを維持する。

実験中の有効forecastと、従来V151に基づき保存される経験が異なる場合、その事実を診断で明示し、記憶の改善や同一性を主張しない。新選択forecastはnormal/trial両armで同一。下流V153のp/v/a定加速度による局所projectionは別モデルとして記録し、V246の三次軌道をcontact時点まで再現したと扱わない。入力policyはcallerの明示設定であり、UIに数値の手入力を要求する完成仕様ではない。

## 固定する一投の接続試験policy

old/source comparison用の明示実験では、事前に maximumExtrapolationRatio=4、minimumQrDiagonalRatio=1e-10、minimumForwardSpeedMps=1e-6、maximumRootBracketTicks=0.25、maximumPlaneResidualMeters=1e-8 を固定する。外挿比4は三次多項式の係数数に合わせて著者が一律に定めた未校正の実験上限として適用し、対象seedの個別結果で選び直さない。その他は1MHz tickと浮動小数の数値安定を守る固定値であり、人間能力・実測精度の保証・4技術の成功閾値ではない。このpolicyで不成立ならfallback/失敗を保持し、数値を緩めない。製品defaultの採用値ではない。
