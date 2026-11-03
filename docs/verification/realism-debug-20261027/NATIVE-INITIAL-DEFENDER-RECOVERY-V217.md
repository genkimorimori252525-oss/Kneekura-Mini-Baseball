# 初回守備観測の未完部分だけの復旧 V217

2026-10-30 JST / `MB-20261027-REALISM-DEBUG-PLAN`。保存済み6観測を再利用し、未完だったcalibrationと残る3観測だけを正常Ownerで受理した。全9観測とcurrent cut22の正常再読を完了した。全goalは進行中。

## 完了した経路

V216の正常inventoryと別proof `c9dd5da8663646c081aaefad7c8590fa` により、cut19・physical ordinal13・観測6・prefix6・TOTAL60・view6・scoped calibration5が既に保存済みと確定していた。

新しい所有backup上でこの境界を正常readerで再認証し、cut19の次観測用calibration1件だけを受理した。Owner解放後の正常再読を経て、残るindices6〜8の3選手について、観測→通常prefix / TOTAL10 / view→次対象のscoped calibrationを順次受理した。各段階でOwnerを解放してfresh current / historical / full reference / projection / physical head / World2を照合し、checkpointを保存した。

完了済みの6観測・6prefix・TOTAL60・6view・5calibrationの再受理は0。観測値の手入力、真のball位置、nearest fielder、未来情報による視線・方針の生成は行っていない。V214で固定した未校正のnominal initial-view modelを維持し、検出・非検出のどちらも有効な結果とした。

## 追加と保全

| table | 新しい追記 |
| --- | ---: |
| physical field steps | 3 |
| lifecycle prefixes | 3 |
| lifecycle TOTAL | 30 |
| lifecycle views | 3 |
| lifecycle calibrations | 4 |

追加は43行、新table / indexは0。同じphysical head rowidのordinal13→16という3 CASだけを許可した。全旧immutable rowとrowid、schema、他head、World2は不変。14保存DBのdata、全Parent / Source / harness / input / bundleの開始終了pinsも一致した。元DBと保存DBは直接開かず、paired stagingから新backupを作成した。

V214の保存83行・6 CASとの結合では、126行・9 CASを実証した。元V214のTIMEOUT / FAILと終了pin UNKNOWN、V216 inventoryの全体FAILは保持し、元runのPASSへ書き換えていない。

最終状態は正常current22・25参照・event references22・physical16・World2・初回観測9。現在viewのcalibrationは1件で、9件という値は全観測のscoped calibration履歴を表す。`initialDefenderObservationsAccepted:true`、`firstObservationHistoryProven:true`、`finalLifecycleCurrentProven:true`。

`rawGazeRestored`・`continuingGazeProven`・`empiricallyCalibrated`・`defensiveAiAccepted`・`legalOutcomeProven`・`officialTerminalProven`・`fullContinuationComplete`・`wholeRngConsumptionProven`・`performancePass` はfalse。`resumeReady:false` / `nativeResumeAdapterRequired:true`も保持する。

## 検証

実receipt `ae2a0eb959a945a5a9e69f43e9fdca40` **PASS873796ms / exit0**。実 `NIR217-S01` は864659ms、1 passed / pure2 skipped。Root handle94835はterminal、child32632と直接の子プロセスはCIMで不在を確認した。外側900秒・実case885秒は開始前の設定を維持し、実行中に延長しなかった。約14分34秒は保存・認証込みの実測で、高速debugやCore単体性能の達成値にしない。

pure / import `bf34fc88` は2 passed / actual skipped、strict `9e40431a` PASS8592ms、driver構文 `8496116f` PASS62ms。entry / testとdriverはauthor以外の別agentが独立reviewした。RED `aba314c3` と型FAIL `356f89b3`を原記録に保持した。型修正は新plan境界のphase入力だけで、旧Sourceの変更は0。

| Source | SHA-256 |
| --- | --- |
| recovery entry | `22f9d9f3bb1603b8110c4b5004e22ceb3336a97c6781e0375bf6e9cb38cc8f28` |
| test | `4b2762b935424a1c8ca4bcffc6f344874c7c056fe36e545a2ceaa3fe32fdd6c2` |
| driver | `e95870ce1d8f434b936994d80da2f893e3f54d94a57814ba20e4c0d030a4ad89` |

次は本人の観測full referenceを使う最初の正常defender decisionと、新current22のgetter1回のCPU計測。既存cut11の性能値を現経路へ転用せず、全Source / alias / Owner認証を保持した高速化だけを検討する。private DB / raw / checkpoint / manifest / bundleは公開しない。
