# 守備観測時計の正規Source接続 V212

2026-10-29 JST / `MB-20261027-REALISM-DEBUG-PLAN`。保存cut12から正常field stepとcut13へ進み、9人分の観測時計を正規Ownerで1000 tick/秒から100万 tick/秒へ接続した。`d82d9c8c60844232af8fe4b1b0445b56`はPASS177342ms、実`NF212-S01`は167726ms。Root handle88248はexit0で終了した。全goalは進行中。

## 変更と実経路

旧cut12の32 calibrationは保持した。同viewへ追加するとcanonical alias guardに衝突するため、新しいfield viewの32件を最初に受理する前に、9件の`defender_observation` Sourceだけを既存の`projectObservationClockV1`と正常projection契約へ接続した。変換はBigIntの正確な比で行い、非整数・overflowを拒否する。丸め・能力値の変更・得能による結果補正は行っていない。

新しいpure producerは、原nominal model、正常な原unprojected effective calibration、対象field refとclockからSourceを宣言する。正常Ownerは元model・原calibration・新current fieldを独立に再認証し、実cursorのSource profileからtarget clockを再導出する。callerのtarget値や保存済み表示を証拠として採用しない。新factoryが作る他23 Sourceは同じobjectを保持し、optional contextがない既定経路も維持した。Core projectorとOwner guardの変更は0。

保存current cut12/root ordinal6・calibration32・World2を正常readerで認証し、原postureと全primitiveのcoverage上限42765369をhorizonとして、保持escape-v3・action無しの正常field stepを受理した。評価tick34334003の最初の自然な物理境界へ進み、free cursorを保持した。結果を見てhorizon・Actor・geometry・profileを調整していない。

正常prepare全体でfresh cut13とTOTAL10/calibration32を受理し、Owner解放後にfresh current、全calibration/member/route、generic physical recordと最新head全列、World2、Source curveとsolver evidenceを再読した。9件それぞれで正規projection evidence、原model、原cut12 calibration、新field ref、refresh intervalの正確な1000倍と他SI値の不変を認証した。

## 追記と保全

| table | 追加行 |
| --- | ---: |
| physical field steps | 1 |
| lifecycle prefixes | 1 |
| lifecycle TOTAL | 10 |
| lifecycle views | 1 |
| lifecycle calibrations | 32 |

計45行、新table/indexは0。physical headの同じrowidはordinal6→7の1 CASだけ変化した。ordinalと最新physical参照3列以外の全列、World2の全列、別scopeのheads、全旧immutable row/rowid/schema、旧cut12/cal32を保持した。10個の保存DBのmain/WAL/journalと全Source/bundle/harness/inputの開始終了pinも一致した。追加のAI・公式Owner行は0。

最終状態は正常cut13・16参照・events13件・calibration32・投影9件。`fieldStepAccepted:true`・`observationClockProjected:true`。実際のdefender observation Sourceは保存入力にないため、`executedObservationClockProbeStatus:UNKNOWN`・理由`NO_RETAINED_ACTUAL_DEFENDER_OBSERVATION_SOURCE`を保持した。`nativePostFieldClockConsumerProven:false`・`resumeReady:false`・`nativeResumeAdapterRequired:true`・`fullContinuationComplete:false`・`officialTerminalProven:false`・`wholeRngConsumptionProven:false`・`performancePass:false`も維持した。Person・policy・assignment・observation Source/viewを製造していない。

carrier/cursorが失われる場合には、既受理の実step/fullrefsをcheckpointへ保存して明示FAILとする分岐を設けた。default calibrationへ逃げず、horizonを調整して再試行しない。今回は正常free cursorの分岐を通過したため、この適用不能分岐の実測を主張しない。

## 検証と失敗保持

helperの親SHA `c44601b9f9a5f9948729342db3adeb471caca94b7feefe56e8eac6275f534c4d`をprivate baselineへ保存し、3つの変更を逆変換すると旧全文bytesへ一致することを`cedc81b731cb4e0099b5395e032d0af5` PASS125msで確認した。proof SHAは`7e7cf51f2cea6e8031e0a7e32926e8bf155c645c744156c99463fd45b56de070`。driverも実物と全逆変換を再計算した。旧factoryのmap body・既定呼出し・既存引数は維持し、一般callback hookを追加していない。

strict初回`bb0879127d5d45b9a6fa7cbc8bbc1566` PASS9156ms、pure＋import `25c7cf65ac30442da3601a34a81f2140` PASS8531ms（5 pure＋S00の6 passed、actual skipped）、旧14 Source pins初回`ffa9255d9e544f61b466c6199b5b120b` PASS93ms。レビューでcheckpointのlife viewとcontinuation anchorの保存名を分離した後、strict `bb6327bacff6413396788a8950f365d3` PASS9110ms、import-only `2123b05002b94c7cae9cd654ccc98a9f` PASS7217ms、pins `2d287257bd3a4b4d9703e952be64dc9d` PASS77msを確認した。Owner処理は変更していない。

初回Root起動`03dae729d6cd4cc9b85423a4b1022ec0` FAIL108msは、保存親commandのWindows区切りとforward slashを同じ文字列として比較した前処理の不具合だった。driver22で停止し、DBopen・Native実行は0、出力先も未作成だった。親receiptは変更せず、command4件と先頭3引数を厳密照合し、末尾pathは同じ実pathへresolveすることを要求した。raw commandもmanifest/reportに保持した。修正driver構文`9f1bcfd970b44e4ba65fe40140e3b5ee` PASS47ms、独立差分review後に修正harnessで上記実測を1回実行した。旧V208 TIMEOUT/FAILと終了時UNKNOWNも保持している。

公開verifier構文`4dc853dcfb994ba8b8d79ccb744ada1c` PASS46ms。Source・helper・driverの独立critical reviewは指摘解消後Ready。Source closureはpin専用で実行せず、実Vitest hostの1caseを使用した。開始manifestはimport/DBopen前、終了pinは子close後に取得した。Parent harnessと新pinsは別loopで照合した。private DB/raw/baseline/manifest/bundleは公開しない。

最終SHA-256：producer `0b193bccc8203f82927604ee01574e8b842a7b07bd39b381f2510882b41e87c8`、pure test `4977f27abd380e3d20b6b7307f7958e0798bb7e74b80ee2906a2a167aed39a2f`、helper `71aca3074de935c84d571ee20e634afc07bd1383fbf56f5ad787de7e7b768343`、entry `f363d5b99c7be040173e59bbc7563eb4cec7862f29f56e5f78e60924b7a76aac`、wrapper `37d6cd7fb5935ea2ec34900d139a9b84c89d8fe260566963e0f0d31ce5bd1300`、driver `27564af7f2bd8087c16c0f59bab011cff2af484ffeb8bba9e818ded71a6fc67d`。

外側300秒・実case285秒は開始前に設定した。177秒は正常認証・物理計算・保存を含む区間であり、高速debug完成やCore単体性能の達成値ではない。次は実際の観測Source/view producerに必要な正常入力を確認する。同Chrome batch入口の並行準備と、そのChrome実測・9回・性能受入は別工程として保持する。
