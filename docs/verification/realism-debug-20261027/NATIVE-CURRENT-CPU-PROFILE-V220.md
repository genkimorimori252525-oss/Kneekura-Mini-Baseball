# 九観測時点の正常current読取CPU計測 V220

2026-10-30 JST / `MB-20261027-REALISM-DEBUG-PLAN`。cut22の正常getterを新しいreadonly copyで1回だけ計測した。保存済みcurrentの全値と一致し、DB・Source・caller状態を保持した。最適化コードはまだ適用していない。

## 今回測った範囲

V200はfieldRoot前のresolved cut11、V202の約27%短縮もそのgetter一組の結果だった。今回は9初回観測後のcut22 / physical16を新入力として対象にし、過去の数値を現在の処理へ流用しなかった。

実Vitest host内の通常Native getterだけをNode builtin Inspectorで計測し、Profilerの開始・終了はgetter区間に限定した。比較、集計、V8 loaderSource取得は区間外。全current値をV217のlossless保存値に照合した。getter呼出しは1回、追加のwarmup / 再試験は0。

元DBは開かずFS copyだけを行い、OS readonly / query_onlyの所有copyを使用した。全rowid / catalog / head / data、caller transaction / savepoint / authorizerと全Source / Parent / harness pinsを保持した。Native受理とDDL / DMLは0。

reviewでは、WAL形式mainだけのcopyが空WALの生成を不要な変更と誤判定し得る点を検出した。旧helperを変更せず、新driver内で元empty WAL / SHMをEXCL copyして全4 filesを厳密照合し、補完前helper証拠と補完後の正式before pinを別に保存した。比較の緩和は0。この補完を独立reviewしてから実行したため、この不具合によるactualの再試行は0。

## 実測

実receipt `58ff906fba67411ab2f0ce0eb0f51520` **PASS20406ms / exit0**。getterはsampling込み12195.2464ms、8166 samples、weighted 12242.394ms。実V8 loaderSourceを165件保存し、offlineでもhashを再照合した。handle25429とchild26600は終了、直接の子もCIMで不在を確認した。

保存profileだけのoffline分析 `05a418f459aa4cf7a13786349d84d7e8` PASS187ms。追加getter / DB open / Native実行は0。

| sampled self分類 | weighted ms | 割合 |
| --- | ---: | ---: |
| SQL `all` / `get` / `prepare` | 7317.041 | 59.7681% |
| `CanonicalActorJson` Source self | 1762.508 | 14.3968% |
| Core / sim Source self | 1081.666 | 8.8354% |
| GC | 339.080 | 2.7697% |

`deriveSourceBattedFieldMotionV3` のinclusive weightは658.171ms / 5.3762%。この値はself分類と重複し、表の値に加算できない。現在getterの主要sampled weightはSQLであり、同じfield replayの反復だけを全体主因としない。最初の最適化候補は、保存profileのSQL callsiteと既存V202 batchingの適用を照合して絞る。

これはsampling付き1 getterのframe帰属であり、排他的なJS / C++ CPU時間、非計測版の性能、V217全admission、全試合の性能ではない。`performancePass:false` / `sourceOptimizationApplied:false`を保持する。raw profile SHA-256は `1165432815541d37fb00667bb62573503fabc65c472f950ad1e9e925c291e89c`。

## Sourceと検証

focused strict `23ce7740` PASS8483ms、unit / import `0c65aa75` PASS7343ms（2 passed / actual skipped）。最終driver構文 `d727cf8821774c18b2b5c5d9ea3a354f` PASS46ms、driverの旧全文3delta逆変換 / entry-wrapper-helper不変 `ceb15a5d59db48369c6e9a6498d8eeaa` PASS109ms。独立reviewは全3Sourceと補完差分を確認した。preflight `6848fc3c` と終了 `67ee8862` はParent manifest / 既存803 code pins / V219とのimport依存0を確認した。初期RED `f306a9fd` と型FAIL `4d8b0059`は保持する。

| Source | SHA-256 |
| --- | --- |
| entry | `ccfde792edcac00a640a53cb980f7485cd269fa967a07554d5d4ef6157e356ff` |
| test | `955c3dc4bc510cc4d0d7d1bed6443aecfde4d0d1cb607f3510b50e68e0a2b6a1` |
| driver | `17cc405a8f38d098ae24ac1940bc0550172e5d4dcadf676718692a663a577629` |

private DB / raw profile / loaderSource / manifests / bundlesは公開しない。今後もReader、alias / global guards、全Source hash、prefix検証を省略する高速化は採用しない。
