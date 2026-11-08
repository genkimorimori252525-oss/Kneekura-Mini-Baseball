# Native lifecycle正常読取のCPU帰属 V200

2026-10-29 JST / `MB-20261027-REALISM-DEBUG-PLAN`。新しい性能帰属の測定で、過去の成功caseの再資格化ではない。全goal・総性能改善は未完。

保存済みV195 resolved cut11に対し、通常のcurrent getterを1回だけ測定した。`2a649a8434c448d8a726273a602aa701`はPASS8313ms、getterの実測は7103.5292ms。Node v26.1.0、4720 samples、重み付き時間7129.782ms。compile/import/DBopen/raw digest/Profiler設定はgetterの測定区間に含めていない。

## 実行条件と保全

新entry/driverだけを追加し、既存Core・phase・memoを変更していない。限定strict`0e2a804b8bc3433995c8646b6da74bd7` PASS8203ms、構文`9e5402f088d14d56bddf1fc1a992ea83` PASS46ms、独立静的reviewで具体的な重大欠陥なし。

元DBはOS readonlyとquery_only=1で開き、caller transaction/savepoint/authorizerと全row/rowid/catalog/head、main/WAL/journalを保持した。SHMは別観測とした。792 Source/bundle/harness/inputの開始終了pinが一致し、正常resolved viewとparticipant10を確認した。新Writer/physics/practice/TAKE/校正受理は0。古いFAIL/UNKNOWNを保持する。

raw digestを先に行っているためSQLite/OS page cacheは暖まっている。正常Owner getterのwarm-upはなく、getterの呼出しは1回のみ。これは冷状態の性能や複数runの統計ではない。V8 sampled frame weightは排他的なJS/C++ CPU時間ではなく、同期native処理が呼出側frameに帰属する場合がある。

## Offline分析

getterを再実行せず、private CPU profileとpinned bundleのSource位置をoffline集計した。正本は`b2574730e7f34275991686a4b8f67f96` PASS186ms、`analysis-v2.json`。

| frameの区分 | self sampled weight | 全sampleに対する割合 |
| --- | ---: | ---: |
| SQL all/get/prepare合計 | 4958.546ms | 69.55% |
| 上記のうちinspectLifecycleIdentityのSQL | 2140.817ms | 30.03% |
| 上記のうちClaimGuard resolveのSQL | 616.318ms | 8.64% |
| CanonicalActorJson全体 | 783.500ms | 10.99% |
| GC | 144.896ms | 2.03% |
| Core simulationのSource frame | 77.474ms | 1.09% |

初版の2661.931ms/37.34%は共通SQL wrapper全体で、identity単独への帰属は過大だった。直接のJS callsiteへ分けて30.03%へ訂正し、初版・script・原証拠は保持した。

## 次の一件

`SamePlateAppearanceLifecycleFromSqlite.ts`のidentity候補SQLを対象に、既知10/32 IDの現行scalar取得とNative SQL batchの限定比較を行う。6table・両JSON mirror・alias/重複/Unicode binding・全rowid候補の同値を確認し、fresh prepareと四つの検証境界を保持する。候補取得の一致を正常Owner認証の証拠へ昇格しない。production Sourceへの適用や速度効果はまだ未実証。

走査table数の初期説明は4から6へ訂正した。受理kindのprefix/total/view/calibrationは4種類だが、identity候補SQLはoutcome/resetも含む6tableを横断する。実Sourceとprofile計数は6tableのままで、30.03%のcallsite帰属値は変わらない。

既存physical traversal/lifecycle phase/shared memoを追加し直さない。過去のmalformed JSON/heap問題との関係が未確定なprepared statement cacheも復活させない。private DB/raw/profile/manifest/bundle/分析payloadは公開しない。

凍結SHA-256：entry `9e108af365ab0f79ce7f7fb9169b0584356d669fa9f241688dd9c6b664113084`、driver `acecbab3a9fad36fe305e6f291b301313531f91628c86f0f7d575ff47d8b7e77`。測定bundleは`b24a5450913f938655c11e06612bd58bb8f5b81d3f0c13511d3e79b80391ab5b`。
