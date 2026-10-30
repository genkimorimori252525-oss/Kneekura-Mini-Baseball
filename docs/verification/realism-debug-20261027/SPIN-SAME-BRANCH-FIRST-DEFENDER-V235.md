# 実打球から最初の守備観測・判断まで

2026-10-30 JST。**同じ実打球の正常Owner受理とデータ保全はPASS。判断・移動の時間整合はHOLD。** 9人の移動、公式判定、settlement／release、次の独立試行は未完成。

## 実際に確認できたこと

V234と同じ分岐のcontact tick `34054578`から、新しい明示・未校正の初期holdを最大1msだけ継続。通常field step、新cut13の観測clock投影、事前固定した正常member `p2`の観測、新cut14、判断、新cut15へ進めた。ballを検出し、配達済み観測と明示prioritiesから`ball_handler`を選択した。真ball／未来結果で観測者を選んでいない。視野・prioritiesは新たな未校正modelであり、測定済みSourceとは呼ばない。

通常fixture／Source factoryで宣言し、既存Ownerが全参照を再認証して受理した。単なるfixture返値を正常受理の代用にしていない。別分岐V219の保存結果・refの移植、練習／接触の再生成は0。

途中の物理境界で早停した場合は、その実tickでcut13まで進み、観測・判断の成功にしない分岐も実装した。今回の実入力では早停せず、経過は1,000 ticks。

## 検証と保全

receipt `856ec73717c7452b949434cc2e1675e9` PASS、479,594ms。実行は1回、session `77932`は終了済み。これは正常再認証・記録を含むgate全体の時間であり、試合速度や高速化の証拠ではない。

- 原DBは非open、main／WAL／SHM／journal不変。既存全行・rowid・catalog・他head不変。
- 135行（field steps 3、prefix 3、TOTAL 30、view 3、calibration 96）の追加とphysical head CAS 3回だけ。World head不変。
- callerのquery-only／transaction／savepoint／authorizerと、Source／bundle／artifact終了pinを保持。
- 最終view snapshotHash `6b2971c3067544a26c52f4e0bbafcef32658fa005354e45c9e0c02b16dffeeef`。decision snapshotHash `5a2b4f34c19a51e0726be1265b8620c5ddb8ef06f8ac1236241e0669ed3e38ca`。

log SHA `fff0d2e323d93715896d53d22494ce83316dc759616e1f55e864282a75eba64c`、report SHA `07aa07f9eb556e73fb7dedd9a2d958c272478c8c018856a9b36c7ae1ff4d6763`。Rootが実bytes、task／PASS／exit、保全項目と未完flagを照合した。

最終entry SHA `51cf38799a9bee48ee1f7cd7a6c3a544570661537fdbed11a5be8153cf370655`、test `8e7d8dd672e9b0240171001df926f8b0b08f344db27236370462c79d46f758f1`、driver `1e904ca60c72f8038b3aeb6bcf87ba9b80cf59ac0e4d03915b63eae48f06c4e4`。親812 Source不変と新813 SourceをRoot reviewed manifestで固定し、Sol entry／test独立レビューとRoot driverレビュー後に実行した。

レビューで固定1msが短いcoverageを拒否するP2を修正。`H=min(posture,全primitive.end)`、`δ=min(1000,H−T)>0`へ変更し、999／1 tick窓、H=T拒否を確認した。RED `ed42b08b4a914eeb822d70167b79d5bc`、GREEN `07d16cbc83cf4845b760d8b4625d5756`、strict `034603981497405f9d43046abf672275`。旧review・receiptを保持する。

## 新しく残った時間の不足

実保存された判断遅延は65 ticks、最初の一歩は32 ticks。field clock 1,000,000 ticks/sへ直接加算され、65µs／32µsである。locomotionの`maxIntegrationStepTicks=10`も同clockでは10µs。

観測modelには元1kHzを認証する明示projectionがある。一方、decision／locomotion calibrationには元`ticksPerSecond`がなく、合成fixtureと値が同じというだけで元単位を証明できない。観測時計から同じ単位と推定して1000倍にする補正は行わない。Owner受理PASSを生理的・時間的に正しい判断の完成へ昇格させない。

既存の履歴を書き換えず、元clockを正規Sourceで証明できる場合のversion付き投影、またはSI時間を明示した新しいSourceを正常Ownerへ渡す経路を検討する。これを解消する前に9人motorへ進めない。9人の正常な観測／判断・実due cutが揃っていないこともmovement未完として保持する。

製品Liveの明示SPIN試行は別経路として進め、Native内の未解決確認だけを増やして他機能を停止しない。4技術の物理成立・真正資格・全弾道／空力・最新3HTML配送は残る。
