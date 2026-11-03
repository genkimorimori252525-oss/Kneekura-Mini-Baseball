# v51 野手間隔の現状監査

測定対象は v50 (`01834d9e`) と同じ v49 Core。製品コード、既存テストは変更していない。`work/v51-spacing-baseline.test.ts` が明示9位置を持つ canonical 20局面×3能力層を実行した。保存された Source frame の平面距離を測定し、隣接 frame 間の弦補間最接近も参考値として分離した。弦補間は実二次運動曲線の連続衝突証明ではない。

## 実測結果

60局面中3局面で既存モデルの体半径 `.24m` の2倍を下回った。2m以内に3野手以上が同時に集まった sample はなかった。既存14分類診断のゼロは野手間隔を保証していない。

| 能力層・局面 | 2野手・役割 | 最近接時刻 | 実frameの最小距離 | .48m未満のsample占有時間 |
|---|---|---:|---:|---:|
| low / slow_roller_3B | P backup / 1B base_cover(1) | 4.36s | .329154353m | .110s |
| default / 1B_routine | 1B holder・hold / 2B base_cover(1) | 2.60s | .397667953m | .055s |
| default / fast_grounder_CF_wall | LF holder・tag / 2B base_cover(2) | 9.42s | .473866259m | .110s |

1. `slow_roller_3B`: 投手の backup 経路が一塁カバーの一塁手を横切る。投手は最近接時 `7.30m/s`、一塁手は停止中。異なる最終目的地を4m離す既存方針では移動経路を保護できない。
2. `1B_routine`: 捕球後の一塁手が減速中に、交代した一塁カバー役の二塁手が通過する。双方に同時の受球作業があるわけではない。
3. `fast_grounder_CF_wall`: 左翼手が実走者への tag を追う一方、二塁カバーが塁付近に停止している。同じ塁付近へ仕事が集まること自体は妥当だが、体の貫通は必要でない。

各局面の入力・全結果は `low-slow_roller_3B.json` / `default-1B_routine.json` / `default-fast_grounder_CF_wall.json`。最近接前後のみは各 `-near-frames.json` に保存した。

## 保存済通常試合からの追加証拠

v49 `normal-game-records.json` は全field frameを保存しておらず、最終frameのみであるため途中の衝突回数を逆算できない。

- pitch index82・ホームラン・最終時刻 `23.924652575834006s`: `0-b6` と `0-b8` の距離 `.062294182m`。位置 `(-20.48435,106.77468)` と `(-20.42456,106.79217)`、双方 `hold`、速度ほぼゼロ。明確な体の重なりがプレー終了まで残っていた。
- index26 / index161も最終距離 `.820342665m` / `.643841433m`。体径以下ではないため、それだけで衝突とは分類しない。
- ホームラン確定後の `dead` は全野手へ停止命令を出す。これは重なりを解消しないため、進入時の予防が必要。

## 改善の区別

- 受球者と中継、カバー、タグ担当が近いこと自体を異常にしない。実際の体半径の非貫通を最低条件とする。
- ターゲット分離と移動中の予防は別。backup / relay / 帰還は、捕球・送球・タグ・塁カバーの作業空間を早めに迂回する必要がある。
- 位置スナップ、既定の速度倍率、判定factの追加では直さない。加速度・最高速度・反応/判断時間の既存SIを使って有限のmotor commandを変える。
- 回避により間に合わなくなることは実結果へ反映する。診断を通すために捕球・アウトを固定しない。
- UIや新能力項目を増やす必要はない。既存の `reactionSeconds`、`fieldingCognition.decisionSeconds`、`pursuitCostWeight`、速度/加速度が引き続き個性を作る。

## 証拠

`MB-20261018-V51-SPACING-BASELINE_218993d71c924fe98499831849276b12.json` は probe実行PASS（60測定を保存した）の証拠であり、現行挙動の合格判定ではない。実行時間23.483秒。

製品入力SHA:

- `LiveFieldPlayV1.ts`: `00a2883b93bb98d5de627eaf53b06765244dcf0a894a59b32627de5cbb1c0991`
- `LiveFieldRoleAssignmentV1.ts`: `47bd7c8c70db035e9879279144a1d005967b8c670a105b19cc3af8904cca6c55`
- `LiveFieldPlayDiagnosticsV1.ts`: `49ee9b1c15e2b888755d13f36297418263d7368e5f3756085ad02627d0b2bd58`
