# Native lifecycle不在ID batch検査 V194

2026-10-29 JST / `MB-20261027-REALISM-DEBUG-PLAN`。全goalは進行中。

同じ保存Native DBで、32不在IDのmetadata検査が単独計時**1844.523ms→389.8606ms**になった。旧/新の返却値、受理済み校正32件の全record、DB/callerは厳密一致した。これは不在ID部分の単発観測であり、元の600秒TIMEOUTやNative全体の性能達成へ拡張しない。

## 実装

`SamePlateAppearanceLifecycleFromSqlite.ts`の既存Native immutable phase内、一つのTOTAL/calibration batchだけでtyped claim走査を共有する。table/鏡ごとの遅延走査で早期orphan拒否を保つ。各IDのschema/index/alias/既存record再認証、full rowsの4境界、deriveSet/readSetの回数は変更しない。

SQLがbound IDごとの一致booleanを返し、元のIDへ対応させる。SQLiteのUnicode変換をJavaScript文字列keyで代用しない。32を超える入力、sparse配列、通常stored TEXT以外、virtual tableは従来経路へ戻す。新しい入力制限は設けない。phase外へ結果を保持せず、global/statement cache、新依存、物理・心理・接触式の変更はない。

開始時から存在したprovenance helperへの委譲とContinuationのphase失効処理は、検証した現在Sourceを公開するための限定依存として採用する。`SamePaAssessmentProvenanceV129.ts`、V129/V130のmetadata契約試験、Continuation/Lifecycleの関連差分だけで、Dispatchの別reader memo化や他のdirtyは含めない。判断と復旧範囲は[記録](../../agent-decisions/2026-10-29-lifecycle-absence-batch-v194.md)に分けた。

## 検証

| 検証 | receipt | 結果 |
| --- | --- | --- |
| 新SQLite metadata/absence全23case、最終Source | `e36ec36628ec433fa390287d819c43e0` | PASS 7703ms |
| 新Source/試験/公開依存を含む明示strict型 | `e7931548645e4779a54412b2b168923b` | PASS 8108ms |
| 限定公開依存V129/V130 metadata契約 | `5932a1a8787c448396f7c78c18ce2e57` | PASS 8000ms |
| 保存Native DB、旧/新3入力の全結果/状態/Source照合 | `8a67c1818277494b97d70fe588ae46dc` | PASS 18280ms |
| 他のCPU検査と重ねない不在ID単独計時 | `629767dfedb04e419d8c6658e01c7749` | PASS 3968ms |

新23caseは実SQLiteのmetadata fixtureで、Actor/physical採用の正例を作っていない。source/snapshot両鏡、同object内のtyped条件、移動/複数claim/欠落owner、schema/index、既存corruptと不在の拒否順、後方authorizer拒否へ進まない早期停止、別snapshot、caller transaction/savepoint/authorizer、sparse/33ID、Unicode、BLOB/FTS5 fallbackを確認した。各有効TEXT鏡のREAD準備観測は、1 IDの2回に対し32 IDsも2回。BLOB/FTS5は1 ID2回→2 IDs4回を保持する。

新caseの原REDは`a517a905`（16semantic PASS/性能1RED）、`0299b77f`（Unicode置換でorphan見逃し）。原FAILを残し、SQL boolean対応で拒否を修正した。初期18case `004c1852`、追加限定`a4eaf636`/`6597334d`/`e2eb25ec`/`5ff2baf2`/`219bb362`、最初の型`bc5cc2eb`は各当時Sourceに限定。最終全23caseと最終型が上表の正本。独立の最終静的reviewで重大な欠陥は見つからなかった。

公開前には既存CRLFを末尾空白と扱う検査でcommitが止まり、その後の失敗時制御が不十分で旧HEADの検証を起動した`128cebb0` FAIL3718msを保持する。元HEAD319行/変更後366行とも全行CRLFで、Source byteを再整形せず、既定の他の空白検査を保持した`cr-at-eol`で扱う。公開verifierはlocal/blob両方の改行だけを正規化し、GitHub contentとGit blobのraw bytes比較は維持する。依存するcommit/push/検証は各exit成功を確認して進める。

## 保存Native DBと計時の範囲

編集前の実Source791 inputsをNode bundleへ保存し、変更後のSource差が対象module一つだけであることを検証した。開始manifestをDBopen/import前に排他保存し、bundle/harness/全current Sourceの終了pinも照合した。baseline Source SHA-256は`94f241dfa9d0438b66237d1fddb1b381cc8f9f11d0334de594e9fe1346746365`、最終moduleは`22dc6b15d92d198536010168cc7a8fbdd8b8f0b1a87773282ba75691face4102`。

同じV193失敗suffix DBの同snapshotで、旧/新の不在1件・不在32件・正常Ownerから再認証する受理済みcut10校正32件を比較し、debug codecの全fieldが一致した。全table行/rowid/catalog、main/WAL/journal、caller transaction/query-only/total_changes/schemaが不変。SHMは別観測。新physical operation/練習/Native旧scenario再実行は0。private DB/raw/bundle/manifestは公開しない。

完全照合out02は型/単体検査と並行していたため、そのwall時間を性能結論には使わない。最終単独計時はNode `v26.1.0`で、追加のCPU検査を同時に走らせず不在1/32件だけを比較した。

| 入力 | 旧ms | 新ms |
| --- | ---: | ---: |
| 不在1 ID | 62.7126 | 60.316 |
| 不在32 IDs | 1844.523 | 389.8606 |

32件は旧の約21.1%の時間だが、反復測定の分布や他DB/環境への一般化は未検証。受理済み校正の結果同値は完全照合out02で証明し、単独計時からその速度を主張しない。初期prototype `bb2ca35c`の結果も保持し、Unicode修正前の普遍的な拒否証明には使わない。

## 次の一件と残件

受理済resolution後の未完cut11を、新しいowned copy上の正規Ownerで完成させる候補を具体化する。既存prefixのreplayと未完TOTAL/view/calibrationだけを扱い、物理・練習を再生成しない。元600秒FAIL、cut11 current未証明、元runtime endpin UNKNOWN、第二Native対照/公式終端/全RNG/production校正/rare率、他SPIN/SIGN今回基盤、キレ、同版3HTML配送と全Source同期は未完。
