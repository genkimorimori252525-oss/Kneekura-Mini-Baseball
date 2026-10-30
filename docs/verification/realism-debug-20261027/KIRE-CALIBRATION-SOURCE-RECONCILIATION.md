# キレのモデル不足と校正Sourceの確認

2026-10-29 / `MB-20261027-REALISM-DEBUG-PLAN`。既存結果と実Coreを読取照合し、一次資料3系統を調べた。新しいgrid、計算、モデル、係数は追加していない。

## 再試行しない既存結論

V180の結論は、Q / P / D / Lを同時に満たす候補が0というもの。軌道差が0だったという意味ではない。保存されたシミュレーション結果には、姿勢による最大終点差としてslider約14cm、splitter約16cmがある。原因は未同定であり、高回転による平均化を確定原因にしない。既存 `KIRE-BASE-PRESERVING-V180.md:26` / `:30` を参照する。

実Coreではspinによってmaterial quaternionが更新され、RK中間段階の姿勢も空力計算に渡る。`AerodynamicPitchTrajectory.ts:247` と `SourceFreeBallKernel.ts:78`。保存descriptor32件は明示姿勢と `seamForce.coefficientScale=1` を持ち、`BaseballAerodynamics.ts:369` で姿勢依存の係数を加速度へ加算する。姿勢の固定や係数0・無効routeを理由に、同じ試験をやり直さない。

現 `BaseballSeamForceV1.ts:59` の方向・姿勢mapは未校正で、windowの位置・幅・gainが未校正。Re・spinFactor・流れ履歴を直接入力しない。既存判断 `docs/agent-decisions/2026-10-28-kire-base-preserving-v180.md:11` のモデル / 入力不足UNKNOWNを保持する。

## 一次資料で確認できた範囲

| 一次資料 | 公開状態 | 今回不足するもの |
| --- | --- | --- |
| [Smith / USU修士論文、2020](https://digitalcommons.usu.edu/etd/7903/) | landing pageは公開。trackingと高速撮影による姿勢依存の実験を記載。PDF取得は今回403、再利用許諾は未確認。 | 本文を取得していないため、同期したraw q / ω / PV / timeの公開状態はUNKNOWN。 |
| [Garrett & Smith / USU公開データ、2022](https://digitalcommons.usu.edu/all_datasets/191/) | CC BY 4.0。CSV、PIV vector maps、raw imagesを公開。landing pageの説明はseam位置と剥離角を対象とする。今回CSV / README取得は403、実列未確認。 | 同期した横力・完全quaternion・PV時系列を確認できない。剥離点を横力係数や遅延時定数へ変換する根拠はない。 |
| [Issakhanian、2025](https://link.springer.com/article/10.1007/s44245-025-00111-9) | 非定常CFDの論文。姿勢に対する揚力・抗力と起動過渡を扱う。論文CC BY-NC-ND 4.0、生データは著者へのreasonable request。raw利用条件は未確認。 | 実測ではなく、横方向力も非掲載。現slider / splitterの校正Sourceとして採用しない。 |

必要なのは、既知のmaterial姿勢・角速度・相対風速条件と同期した横力係数、またはPV / 横加速度の時系列。流れ履歴による遅延を主張する場合は、その過渡的な力・剥離 / wake応答の観測も必要になる。現在保存されているSourceはこの校正データではない。

調査は上記3系統で止めた。認証、購入、著者への連絡、大容量取得、実データとしての推定値登録は行っていない。この枝の不足を、守備観測・通常decision・高速検証等の独立作業を止める理由にはしない。
