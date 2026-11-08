# 保存知覚からの最初の正常守備判断 V219

2026-10-30 JST / `MB-20261027-REALISM-DEBUG-PLAN`。9人分の正常初回観測を継承し、最初の選手の保存知覚から通常Ownerが守備判断を受理した。実際の選択は `ball_handler`。判断後の正常current cut23まで確認した。

## 入力と通常経路

V217の実receipt `ae2a0eb959a945a5a9e69f43e9fdca40`、lossless frontier、元input、full referencesを固定した。新backup上で正常inventoryを一度読み、current22・全9観測・physical16と継承したrecordを再認証した。

最初のactorは初期viewの先頭に固定する。nearest選択を使わず、本人の観測op8と、直前physical op16を区別した。当該選手の `defender_decision` calibrationだけを1件受理し、そのfull referenceと本人の観測を使う通常 `defender_decision_v1` をop17として受理した。Owner解放後のgeneric physical / historical22 / World / head確認を保存し、normal prefix / TOTAL10 / view23へ進んだ。次calibrationは0件のまま停止した。

保持入力にはprioritiesが無かったため、新しい未校正game modelとして宣言した。model IDは `native-initial-defender-decision-v219:nominal-pursuit-hold-model`、versionは `same_pa_nominal_initial_pursuit_hold_decision_v219`、authorityは `EXPLICIT_UNCALIBRATED_GAME_NOMINAL_PREPLAY_PLAN`、`empiricallyCalibrated:false`、scopeは最初の判断1件だけ。

値は既存Native初期game defaultに基づく `ballPursuitPriority:1` / `baseCoverPriorities:[]` / relay・backup・deepCoverage・hold priority各0。説明は別artifactにpinし、通常actionには既存型の6 fieldsだけを渡した。元の実チーム戦術や測定済みpolicyと称さない。

Ownerは保存済み `receipt.perceived` から候補を計算した。真のball位置・未来・nearest helper・手入力の知覚値は使用していない。`hold`も正常とする受入を実行前に固定し、実結果に合わせてpriorityや視線を変更していない。今回は `actionResult.calculation.selected.intent.kind` が `ball_handler` だった。

## 追記と保全

| table | 追加行 |
| --- | ---: |
| lifecycle calibration | 1 |
| physical field step | 1 |
| lifecycle prefix | 1 |
| lifecycle TOTAL | 10 |
| lifecycle view | 1 |

計14行、physical headの同じrowidはordinal16→17の1 CASだけ。正常current23・27 pins・23 events・current calibration0件に到達した。World2、全旧immutable rows / rowids / schema、他heads、15保存DB、全Parent / Source / input / artifact / bundleの開始終了pinsを保持した。既存段階の再受理は0。旧FAILと終了UNKNOWNを変更していない。

`initialDefenderDecisionAccepted:true` / `finalLifecycleCurrentProven:true`。移動、assignment、全AI、legal / official終端、full continuation、全RNG、性能達成は未証明のまま。`resumeReady:false` / `nativeResumeAdapterRequired:true`も維持する。

## 検証

実receipt `8c50870189814c00af7d44f2d9801bbf` **PASS306343ms / exit0**。実 `NID219-S01` は297418ms、1 passed / pure3 skipped。session90341はterminal、child15020と直接の子はCIMで不在を確認した。開始前に外側900秒 / 実case885秒を設定し、実行中に変更していない。約306秒は保存・認証を含む時間で、Core単体性能や高速化達成値にしない。

focused strict `97c2a540` PASS8703ms、pure / import `35b83d30` PASS7172ms（3 passed / actual skipped）、driver構文 `f62587c3` PASS30ms、実Parent lossless構造 `5ed37f9f` PASS125ms。独立reviewは新3Sourceと通常Ownerの候補gatesを確認した。初期RED `4f597f43` と、旧moduleの未使用type importが依存したstrict FAIL `c2c1aac5`は原記録に保持した。既存Sourceを変更せず型依存だけを変更し、emitted JS全文一致を `e8269671` PASS562msで確認した。

| Source | SHA-256 |
| --- | --- |
| entry | `d9121406237e1bdb646611d4e5a7912ba28b394a2e9b6d8dc6777d4fcaff78bf` |
| test | `331f396a03c221892358e6cdff6af575e337bddff74b584fae791103eeeca453` |
| driver | `675d46bafcfcefdf003919218b2a5940981af298a12d183f8e62cd705324406b` |

private DB / raw / checkpoint / manifest / bundleは公開しない。次のCPU計測は、九観測時点のcut22のgetter1回を独立backupで対象にし、同時実行を避ける。
