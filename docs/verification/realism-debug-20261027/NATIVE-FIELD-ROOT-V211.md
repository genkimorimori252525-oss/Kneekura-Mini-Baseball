# 保存打球接触から正常field rootへ V211

2026-10-29 JST / `MB-20261027-REALISM-DEBUG-PLAN`。V210の正常resolved cut11から正常field root ordinal6を受理し、cut12の正常currentとcalibration32まで進めた。`431cec0b82524ddcbe89373624b1504f`はPASS158437ms、実`NF211-S01`は148716ms。Root実行handle98517はexit0で終了した。全goalは進行中。

## 受理した経路と物理設定

正常current cut11、resolution ordinal5、実contact tick34054636、`resolution.timeline.status.kind=batted_ball_pending`、World revision2、現在のcalibration32全record/member/routeを正常readerで再認証した。V198の歴史的field calibration、prelaunch view0、元Actor・action・posture・intent、day40のBodyModel/bodyも別に認証した。歴史的calibrationのviewをcurrentへ書き換えていない。

既存の型`SamePaPhysicalFieldRootSource`で、保持済みsource ID `native-spin-neutral-field-v198:field-root`、version `same_pa_field_root_aero_ground_escape_v3`、明示ballPhysics profile、元calibrationのparameters、実contact tick、元field model各actorのzero stationary commandsを宣言し、正常Ownerでroot6を受理した。既存closureは別versionを選び次stepまで自動実行するため使用していない。legacy ground parametersを明示profileへ合わせる変更や、結果に合わせたActor・geometry・物理値の調整は行っていない。

そのrootを既存の正常prepare全体でcut12へadmitした。Owner解放後にfresh current、TOTAL10、calibration32全record/member/route、generic physical record、最新physical head全列、World2を再読した。正常recordのsourceCurve `aero_ground_continuous_source_kernel_v2`、保持profile、contact起点、solver evidenceを保存した。飛行の経過は0であり、field stepを実行した証拠にはしていない。

## 追記と保全

| table | 追加行 |
| --- | ---: |
| physical field roots | 1 |
| lifecycle prefixes | 1 |
| lifecycle TOTAL | 10 |
| lifecycle views | 1 |
| lifecycle calibrations | 32 |

合計45行、新table/indexは0。physical headの同じrowidはordinal5→6の1 CASだけ変化した。最新physical参照3列とordinal以外の全列、World2の全列、他scopeのheads、全旧immutable row/rowid/schemaを保持した。field step・守備AI・公式Ownerの行追加は0。9個の保存DBのmain/WAL/journalと全Source/bundle/harness/inputの開始終了pinも一致した。

最終状態は正常cut12・15参照・events12件・calibration32で、`fieldRootAccepted:true`・`finalLifecycleCurrentProven:true`。`nativePostFieldRootConsumerProven:false`・`nativeResumeAdapterRequired:true`・`resumeReady:false`・`fieldStepAccepted:false`・`officialTerminalProven:false`・`fullContinuationComplete:false`・`wholeRngConsumptionProven:false`・`performancePass:false`を維持した。元V208のTIMEOUT/FAILと終了時UNKNOWNは変更していない。未提供のOriginal Person・policy・assignmentを製造していない。

## Sourceと検証

既存shared/V198/V210 Sourceの変更は0。新entry/wrapper/driverだけで既存正常Ownerを使用した。Source closure bundleはpin専用で実行せず、実Vitest hostの1caseを実行した。Nodeで実行したのはdigest Sourceだけ。開始manifestをimport/DBopen前に保存し、子のclose後に終了pinを確認した。Parent全Sourceを例外なしで照合し、親harnessと新pinsも別loopで検査した。private DB/raw/manifest/bundleは公開しない。

strict `d3ba48ab14394b289b9bc8826f706539` PASS9328ms、import-only `65f0735ebba94fc9b11eab338401e947` PASS6953ms（actual skip）、旧13 Source不変 `74b3d82e1e044ab2bcff0cea3f67742b` PASS109ms、driver構文 `4472d11d4dee4963b75193a2093edfb0` PASS62ms、公開verifier構文 `f16c89f46ca04647bda32321529791ef` PASS31ms。Source・driverの独立critical reviewは重大欠陥なし。

凍結SHA-256：entry `a8e02116ef3152fad3ce0b7281eee611ae8b67809fd509e23e00ba1c4c7d3d2d`、wrapper `b0495851b4936ea513283e3b7812d1a29346c98994c9a5153b4213909584f132`、driver `9fd67b622acd3a8e7b46988d8a472bfe1bebd3cd604aece90d66b89652c447bd`。

事前に外側240秒・実case225秒を設定し、正常Owner検証と精度を保持した。158秒はこの認証・保存込みの区間であり、Core単体性能や高速検証環境の完成値ではない。次は保持入力のまま正常field continuationを進めるためのOwner契約を確認する。同Chromeの複数seed/pool 1・2・4枠比較は、計画どおりTask5後の未完工程として保持する。
