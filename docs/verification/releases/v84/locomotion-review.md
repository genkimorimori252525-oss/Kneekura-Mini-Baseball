# V84 live locomotion — Core review

確認日: 2026-10-21 JST。対象baseline: `4057a83acb7efe5542b9a0565ecb0cba4b904ef8`。

現時点の判定: **限定Sourceレビューに未解決findingなし。出荷判定はHOLD — 最新Sourceによる通常試合・最終型検査・artifact照合待ち**。
この文書は限定したCoreコードレビューであり、V84の出荷判定、最新artifactとのSource一致、元計画の非デザイン接続全体の完了を表さない。

## 対象と独立性

- 共通helper: `src/core/sim/locomotion/LiveLocomotionV84.ts` と同test。
- 野手接続: `LiveFieldPlayV1.ts`、`LiveFielderAvoidanceV1.ts`、`LiveFieldArrivalV84.ts`、`LiveFieldRoleAssignmentV1.ts`。
- 走者接続: `LiveRunnerMotionV1.ts`、`LiveRunnerRetreatMotionV1.ts`、`LiveRunnerAdvancePolicyV1.ts` と関連test。
- 旧aだけを仮定していた継続性testの更新: `LiveDefensiveOpportunityV1.test.ts`、`LiveFieldRelayMotionV1.test.ts`、`LiveFieldRoleMotionV1.test.ts`。既定ellipseの最大軸であるb=`1.8a`を速度差の積分上限とし、速度・位置・捕球・送球・裁定のassertionは保持した。
- 野手・走者接続は別担当の実装を読取専用で確認した。共通helperは本レビュー担当自身の実装であり、その部分は自己再点検と回帰テストによる確認である。第三者によるhelper全体の承認とは扱わない。
- 最終Source hash、Native bundle入力、成果物hashとの照合はroot担当が別途実施する。

## Findingと状態

| ID | 状態 | 内容・根拠 |
| --- | --- | --- |
| R1 | 修正・限定検証済み / 通常試合再検証待ち | 通常試合で `speed exceeds top speed`。`sampleRunnerRoute` のtangentから再構成された速度ベクトルが上限を約1 ULP超え、走者再計画で拒否された。生成した速度ベクトルの数値再構成、kinetic radiusの安全側丸め、制動派生上限の自己検査で修正。入力位置・速度は変更せず、外部から既に上限超過の入力はnullで従来plan保持。BOUNDARY-FINAL 35 testsがPASS。過去の通常試合FAILは保持し、再build後の完走は別検証とする。 |
| R2 | 修正・限定検証済み | 微小な連続event cutで `(nextSpeed - speed) / dt` が桁落ちし、上限3.5に対して推進4.440892を生成、さらに小さいdtでは例外になった。帯ごとの `a * 使用時間` を直接積分するよう修正。`dt=1e-6…1e-18` の回帰とfocused 48 testsがPASS。 |
| R3 | 修正・限定検証済み | 野手の目標方向ベクトルの再構成が最高速度を約1 ULP超えた。入力状態を変更せず、導出する目標速度に `8 * Number.EPSILON` の計算余裕を付与。180角度×4方向で、次stepへ渡す速度が厳密に上限以下となる回帰がPASS。 |
| R4 | 修正・限定検証済み | 速度の平方根と距離反転のULP差による短距離planの誤ったnull、微小負coast、時刻境界を表現できないcoastを確認。導出距離だけに相対8 EPSの丸め範囲を設け、時刻を分離できない加速度0のcoastだけを省略。入力速度のclampは行わない。 |
| R5 | 修正・限定検証済み | peak二次根を安全側へ丸める処理が、受理済みinitial/finalよりpeakを下げて速度順序例外を発生させた。root算出と各丸めで `minimumPeak=max(initial,final)` を保持。exact距離`.15161042144180417`、from`6.0397837366873`、to`5.809475019311125`、limit`8`でREDを再現し、helper/runner 44 testsがGREEN。 |

R1は保存された[通常試合レポート](normal-nine/report.json)で確認できる。このFAIL artifactのCore hashは `25e63cacda71af84463299ce4031d3ee55549619eeaae89e6db0b210030ac99b`。
別の読取診断では、修正前Sourceをメモリ内だけでbundleした `liveMatchFixture(1234)`、`balanced/auto/auto/managedTeam=0` で50球完了・32 field plays後の次球に `8.000000000000002 / 8` を再現した。この診断は原因切分けであり、完了receiptではない。修正は速度ベクトルの生成owner側で行い、継承済み状態の無条件resetやhelper入口の一括clampで解消していない。

## 制御・安全境界の確認

- 新helperは加速・距離・時間・到達可能速度・speed planの3速度帯を共有する。peakは各帯の区分二次式で解き、最大3帯を確認する。候補ごとの高解像度再シミュレーションは追加していない。
- 野手stepは加速度だけを返し、現位置・現速度を瞬間的に置換しない。反対方向と高速の大きい横方向変更はplant制動を先行させる。区間内停止は `stopAfter` で明示する。
- `LiveFieldPlayV1` のフェンス判定、停止点、回避の将来停止経路は同じprofileの `brakingMps2` を使う。
- フェンス制約でpreferredとemergencyを混合するのは、preferredに `stopAfter` がなく、emergencyの停止時刻も区間末以後の場合に限定される。異なる停止境界を保持したまま加速度だけを補間する処理はない。
- `LiveFielderAvoidanceV1` のoptional profile経路は、現在速度軸の推進、制動、横加速度を共通の楕円budgetで検査する。既定profileでは正方向が速度帯の推進上限、負方向がb、横がa。緊急停止・停止後の安全距離もbへ接続されている。
- 回避候補の読取診断800ケースではsafeとなった764ケース・1528 commandsに厳密な最高速度超過を観測しなかった。これは探索範囲内の観測であり、全入力に対する証明ではない。
- 走者の塁接触は実経路とtouch diskの交差から生成し、停止時刻と分離する。退却では現速度をbで散逸した後に逆方向経路を作り、制動中に実際に通過した塁も保持する。ETAからOUT/SAFEや塁接触を生成する変更はない。
- 走者の後続境界修正は、導出kinetic radiusを4 EPS外側へ、制動上限を必要時だけ4 EPS内側へ丸める。`elapsed=0`の入力位置・速度はそのまま返す。途中sampleでは解析scalarとroute partのcapを守ってからtangentを掛け、ベクトル再構成がscalarを超えた場合だけ数値誤差を補う。回転したdiamondの72ケースでthrough-base sampleから再計画する回帰を含む。
- 現Source diffでは `src/host/`、`src/integration/native-game/`、旧`DefenderMotion.ts`、旧`RunnerMotion.ts`、`SourceDefensiveControlV1.ts` に変更を認めなかった。新live helperから旧Nativeの証拠・receipt ownerへ接続を追加していない。Native全体の完了・承認を意味しない。

## ETAの適用範囲

走者の静止発進・直線・静止終端legのETAは、同じspeed planを作りtouch距離を解析反転する。関連testは複数能力・短距離・速度帯境界で実motionのtouch時刻との一致を確認する。

野手ETAは**同じ速度帯と制動値を使う戦術用first-entry近似**である。plant時の停止中の変位を含む一方、motorが目標手前で行う制動、reaction待機中の速度変化、横方向制御中の実変位、チームメイト回避まで同一軌道として再生しない。role割当、intercept、relayの比較資料にのみ使用し、物理的到着や裁定factsの根拠にはしない。「野手ETAが実motorと完全一致」とは主張しない。

## 未校正係数・保持する制約

| 設定 | V84値 | 扱い |
| --- | --- | --- |
| 推進速度帯 | `0–.25 vmax: a`、`.25–.65: .7a`、`.65–vmax: .35a` | 左右支持を平均化した制御近似。実測生体モデルではない。 |
| 既定制動 | `1.8a` | 明示braking入力があれば優先。実測値への校正は未実施。 |
| 野手の既定横踏ん張り | `a` | 推進・制動との楕円budgetを共有。 |
| 走者の横加速度・旋回半径 | 既存の明示値。省略時の走塁横加速度は従来の`1.5a` | 既存の能力値・経路個性を保持。 |
| plantの高速条件 | `speed >= .25 vmax` かつ方向cosine `< .5`。逆方向は速度によらずplant | 調整可能な未校正の制御閾値。 |

最高速度、加速能力、reaction、technicalSkills、既存の走塁半径・横加速度を失わせない。新依存、lockfile、設定、旧dist、AGENTSへの変更は本担当範囲にない。Core制御40msとPresentation周期は別ownerであり、今回の制御改善を理由にv81の無劣化性能原則や表示cadenceを弱めない。

## 観測済み検証

| 検証 | 観測結果 | receipt |
| --- | --- | --- |
| helper初回RED | FAIL。未実装moduleを確認 | [CORE-RED](../../../ai-continuity/verification-receipts/MB-20261021-V84-LOCOMOTION-CORE-RED_faafd8de57184c3b8eaa18e5bd8e03dc.json) |
| helper初版・型検査 | PASS。当時の全src `tsc --noEmit`。後続tiny修正・runner修正を含む最終型検査はrootで別途必要 | [CORE-TYPECHECK2](../../../ai-continuity/verification-receipts/MB-20261021-V84-LOCOMOTION-CORE-TYPECHECK2_d74f8a5180a34b12b680ff27f9d12765.json) |
| 微小event cut RED | FAIL。推進上限超過を再現 | [CORE-TINY-RED](../../../ai-continuity/verification-receipts/MB-20261021-V84-LOCOMOTION-CORE-TINY-RED_af19c0e12c82476c9e58bd19c2a08e3a.json) |
| tiny修正後focused | PASS。helper21、avoidance24、arrival3、計48 tests | [CORE-TINY-GREEN](../../../ai-continuity/verification-receipts/MB-20261021-V84-LOCOMOTION-CORE-TINY-GREEN_292538b5ac6e42679add3bb915225c92.json) |
| runner初版unit | PASS。5 files / 36 tests。R1の通常試合境界を網羅した証拠ではない | [RUNNER-UNIT](../../../ai-continuity/verification-receipts/MB-20261021-V84-RUNNER-UNIT_480f13b1cea54ef7b02d124edeb816e6.json) |
| 走者境界RED | FAIL。導出vector上限と外部overspeed入力の再計画境界を再現 | [RUNNER-BOUNDARY-RED](../../../ai-continuity/verification-receipts/MB-20261021-V84-RUNNER-BOUNDARY-RED_68774194798c45579c30d8bcc963b99f.json) |
| peak下限RED | FAIL。exact最小距離近傍で速度順序例外を再現 | [CORE-PEAK-RED2](../../../ai-continuity/verification-receipts/MB-20261021-V84-LOCOMOTION-CORE-PEAK-RED2_022bad765599445d8e37e7f64593bccd.json) |
| peak下限修正後 | PASS。helper22、runnerMotion14、retreat5、touch3、計44 tests | [CORE-PEAK-GREEN](../../../ai-continuity/verification-receipts/MB-20261021-V84-LOCOMOTION-CORE-PEAK-GREEN_e407c9303e08432a82aa5f0abe80407c.json) |
| 走者境界最終focused | PASS。4 files / 35 tests。生成側の速度上限と再計画を確認 | [RUNNER-BOUNDARY-FINAL](../../../ai-continuity/verification-receipts/MB-20261021-V84-RUNNER-BOUNDARY-FINAL_3abc6be7a4104b14b05848e7a57ef4ca.json) |
| 旧a上限testの更新後 | PASS。3 files / 15 tests。bによる積分継続性、role/relay/over-fence経路を確認 | [CORE-BOUNDS](../../../ai-continuity/verification-receipts/MB-20261021-V84-LOCOMOTION-CORE-BOUNDS_033e8610e5814e16bfb9747ae165ec1d.json) |

過去のFAIL receiptは削除・PASSへの置換を行わない。Source上のR1〜R5は限定回帰で修正を確認した。出荷の最終判定には、Source凍結後の関連Core回帰・型検査、最新Sourceから再buildした通常9回試合の完走、およびrootによるSource/artifact hash照合が必要である。
