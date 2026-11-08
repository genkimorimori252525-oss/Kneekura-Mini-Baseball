# V172 実軌道観測と重力基準の区別

Task `MB-20261027-REALISM-DEBUG-PLAN` Task4 / 実技能・UI採用・全goalは未完。

旧の重力基準残差 `r-r0-v0*t-g*t²/2` は空力寄与の分布で、実軌道の曲がり始めとは一致しない。初期gravity/lift相殺を含む滑らかな数学的反例で順位の反転を確認した。反例は現Sourceでの実現や実投手を証明するものではない。詳細と式は `docs/agent-decisions/2026-10-28-kire-net-trajectory-v172.md`。

新read-only `PitchTrajectoryShapeV172.ts` は、初期接線からの偏差を初速度に垂直な平面へ射影し、直線減速を曲がりに数えず、netの時間分布とvelocity方向角を観測する。解析用UV/zero-referenceはworld ballや別simulatorではない。旧観測/物理/Source/入力/既存Core exportsは変更しない。p10は力の開始・知覚閾値ではない。groundは与えられたphaseだけの分類で、隠れたeventを推論しない。

新7件 `b91f72574f3345d892cf40c242fe8b1b` PASS1.077秒、RED `ad2469f0`。直線減速、gravity解析、非水平初速度、順位反転、ground/非単調、不正入力/clock、raw不変を確認。V170と合わせた全型8ee4e8b1 PASS。

## 固定した旧3件の保存データ観測

`170fa70b64214afb8ccb42b88bb551f2` PASS281msは、保存sampleだけを新moduleへ渡した観測の証拠。新flight0/current game Core実行0、Nodeでの観測、技能認定なし。`net-trajectory-selected-v172-01/report.json` に全raw値/Source pinsを保持。

| phase（spin.04/gyro30） | 誘導空力p10秒 | net p10秒 | net p90-p10秒 | net late20 | net最終量m |
| --- | --- | --- | --- | --- | --- |
| 5 | .17126176394729611 | .15977636303263462 | .3337825607370436 | .34870821277112557 | 1.3625644679475122 |
| -5 | .18151635441465838 | .1598307787302514 | .3334948756266818 | .3474639447925034 | 1.360107326821953 |
| -15 | .19278273400624948 | .16082410199642558 | .33230116825900335 | .34771109864648747 | 1.3535082959661777 |

net late20は段階順でなく、最初のnet p10差は約54μs。小ささを新しい知覚閾値で拒否するのではなく、必要な終盤集中の順自体が成立していない。旧誘導空力のQ/P/D/Lだけを本人定義の実Kireへ昇格しない。V171選択/category/旧A screen/旧0結果は保持し、追加refinement/normal flightは未起動のまま。

次のV174は新基準で保存80件を再観測する。共通clockの時間分布と保存own-plane endpointを分け、own timing未取得をCLASSIFIEDへ補完しない。旧選択を結果に合わせて再選択しない。新flightを行う前に、正しい観測で検証する対象を確定する。
