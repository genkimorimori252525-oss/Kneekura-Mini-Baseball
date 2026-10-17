# 観測で判断する初球の準備計算

以下は準備計算を導入した時点の記録。続くNative実採用は[観測初球の実採用](same-pa-observed-initial-adoption-v1.md)を参照する。

初球準備Sourceに`variant: observer_decision_v1`を追加した。旧`declared_take_v1`の保存形・見送り計算・実行記録は維持する。

観測版の打者入力はplate/zone/ball radiusという幾何だけで、take/swing actionを持たない。flightは期間だけを持ち、明示した`actualFlightParameters`で空力軌道を作る。旧版の一定加速度と観測版の空力を混在させない。時計は1e6ticks/sで、ボール質量と半径を保存済み装備に照合する。

既存のNative action/32calibration/consumer/episode/right準備ownerを再利用する。保存された投手Person、timing/release、予約状態、累積role workload、fatigue responseを再読してCore deliveryを計算し、そのreleaseから空力軌道を作る。

返却値は`native_observed_launch_calculation_only`。`beforeTimeline`のevent/countはそのままで、resolutionを生成しない。計算はNative発行・時間の前進・初球slotの消費を認可しない。旧take専用physical adopterは観測版の計算を拒否し、物理/consumer/consumption/admission行を追加しない。

旧第二球take Source、旧第三球以降のnominal take geometry、旧occupied-take検査は明示的な旧型に限定した。新しい観測版を見送り用入力へ暗黙変換しない。

## 証拠と残作業

最終検証は8files/55tests PASS（owner16、旧実行9、残り6files30の3分割）、全src型検査PASS。初期の一括実行は180秒TIMEOUT、単独owner約242秒、単独旧実行約264秒。速度の改善は主張しない。途中の型検査FAIL2件は旧take限定fixtureの型区別と不足importを修正し、原receipt/logを保持した。各command/SHAはEVIDENCE_INDEXと`outputs/verification-observed-initial-calculation-v1/manifest.json`に保存する。

実ownerのみのNative fixtureで、投球履歴0件から観測版actionと32calibrationを準備し、疲労を反映したrelease、重力/空力による移動、結果イベントなし、再読一致、準備計算前後の全行不変を確認する。consumer/episode/rightを実際に準備した後も、旧physical adopterの誤使用は書込前に拒否する。

この試験は既存の合成Native fixtureを使う。新規18人genesisと実測打撃モデルを一つの初球発行まで通す証明ではない。閉DBの独立process再計算、初球の物理Source実採用、観測/判断/実測スイング採用も未達成。

次は、既存の初期球custodyと審判Play evidenceを伴う観測版launchの原Source消費・保存を実装する。旧take実行・旧ordinal>=3 family・凍結済みcensus/Source行を緩めない。初球launch/cutからNative知覚/判断へ同じ世界時計で接続し、元の9人守備・走者・裁定・混合9回・100試合監査へ進む。
