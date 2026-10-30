# 中断した守備観測の正常状態認証 V216

2026-10-29 / `MB-20261027-REALISM-DEBUG-PLAN`。V214で保存されたDBを正常readerから認証し、6人分の観測と状態更新、5件の次観測用calibrationが既に受理済みと確認した。残りだけの復旧へ渡す。元V214のFAILと終了時UNKNOWNは保持する。

## 原本を保持する読取経路

元failed DBを直接開かず、停止後のmain / WAL / SHM / journalを新しい所有stagingへ同じbytesでコピーし、そこからSQLite backupを作った。開始前に元artifact全体、Source、input、bundle、11個の保存DBをpinした。実Vitestの `NII216-S01` はbackup上の通常physical・historical/current lifecycle・TOTAL・calibration readerだけを使い、physical / lifecycle受理APIの呼出しは0。

独立reviewで、SQLの `view_source_id` だけからcalibrationの有無を判断すると、破損行を未作成と誤認し得る点を修正した。既存factoryから得たexpected Source IDを正常calibration readerで先に読み、SQL locatorとも厳密照合する。別のguard copy2個で、hidden SQL locatorと再hashした両JSONの改変が通常readerに拒否されることを確認した。原DBとinventory DBは変更していない。

## 認証済みの境界

| 保存済み | 件数 |
| --- | ---: |
| physical observation | 6 |
| lifecycle prefix | 6 |
| TOTAL | 60 |
| lifecycle view | 6 |
| scoped calibration | 5 |

V212からの追加は計83行。physical headは同じrowidでordinal7→13の6 CASだけ変化した。current cut19が最新physical headを覆い、phaseは `SCOPED_CALIBRATION_PENDING`。cut19のcalibration1件と残る3観測分、計43行・3 CASが未完だった。stageの最終出力だけで判断せず、DBの正常認証を根拠にしている。

全旧immutable rowとrowid、schema、他head、World2、元failed DBと全artifact、11保存DB、Source / input / harness / bundleの開始終了pinを照合した。完了済みの観測・prefix・TOTAL・view・calibrationの再受理は0。

## 実測と後処理の修正

実inventoryの外側receipt `08585b27a5b14888a40f785ca27f9eaf` は **FAIL36375ms / exit1**。内部の実 `NII216-S01` はPASS28113ms / exit0で、正常状態認証とguard2件を完了した。その後、catalog SHA一致後の比較で、SQLiteのnull-prototype rowと保存JSONのplain rowのprototype差によりdriverが失敗した。Root handle44218とchild14428は終了済み。

旧3Source・receipt・DBを変更せず、新しいverification-only driverを追加した。旧receipt / log SHA / 保存inventory / guard / endpinsを再認証し、新しいpaired copyだけをreadonlyで開いて残る保全検査を実行する。catalogのrecord prototypeだけを保存境界に合わせ、key順・SQL型・null・全値・配列順とSHAを厳密に比較した。物理値の丸めや比較項目の省略は行っていない。

この別proofは `c9dd5da8663646c081aaefad7c8590fa` **PASS1639ms**。83追記、6 CAS、全旧rowid / schema / other heads / World2と全endpinsの不変を確認した。Native testと正常inventoryの再実行は0。旧08585の全体FAIL、元V214のFAIL / 終了UNKNOWNをPASSへ改変していない。

## Source検証と残作業

最終strict `0adc8e45` PASS9093ms、pure / import `f7850a1c` PASS7281ms（3 passed / actual skipped）、inventory driver構文 `4d07ce97` PASS47ms、proof driver構文 `92400345` PASS46ms。entry / testとdriver / proofはauthor以外が独立reviewした。初期RED `74724865`、型FAIL `842011fc`、中間GREEN / strictも原記録に保持した。

| Source | SHA-256 |
| --- | --- |
| inventory entry | `a600320ea045608565314eddde74c45da6e845b68f9c2ce695d57dd1b5d359c7` |
| inventory test | `80b52df1813e54a5c9d32a8baaa9d7b663f1305cbc288dbd16bc9387bea363ee` |
| inventory driver | `169f91063e94417fed53501fd72bb957dddfdc97a8d60adbef534c86cdca1145` |
| verification-only driver | `3a93fc41608a5cfdff4a54c3a5fbc4c15bcb51330657181bcf1c7422cd07d6dd` |

次のV217は別backupで未完43行だけを受理する。9人完了、継続gaze・AI・公式終端・full continuation・全RNG・高速性能は、このinventoryの受入範囲へ含めない。private DB / raw / manifest / bundle / guard copyは公開しない。
