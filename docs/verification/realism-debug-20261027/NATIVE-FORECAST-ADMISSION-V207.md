# 予測のadmissionと同入口からの再開 V207

2026-10-29 JST / `MB-20261027-REALISM-DEBUG-PLAN`。保存forecastをcut7へ正式admitし、同じNative入口からadmission済み状態を再認証した。分離した3つの新owned SQLite backupによる`9734a66ca3444c11aa153039217923cf`はPASS96250ms。全tail・通常consumerへの採用・field/公式処理・全goalは進行中。

## 再開処理と認証

既存`continueNativeSpinNeutralV193PostDelivery`へoptional `forecastReference`の8参照経路を追加した。7参照の旧経路は維持し、exportを増やしていない。共通7参照の正常graph readerとforecast後のtailをprivateへ切り出し、同じOwner順序・処理・optionsを再利用する。

新経路は、正常HISTORICAL cut6＋forecast AFTER fenceの未admission状態と、正常current cut7のadmission済み状態を分けて認証する。current getterだけではcalibration32の完了を保証しないため、全32件を正常readerで再読し、callerの全record・member・route集合とも照合する。view間ではroute/player集合を比較し、各calibrationのmember全列は対応するcurrent viewのmemberと比較する。view固有のprojectedStateHashを異なるview同士で同一扱いしない。

admission済みと判断できるのはprivate readerの認証結果だけであり、caller booleanによる省略はない。認証phase閉鎖後に新stageを通知し、未admissionなら既存の正常prediction advanceを行い、admission済みなら重複advanceを省いて同じscore以降のtailへ進める。

## 実証した3ケース

| case | 実測 | 確認内容 |
| --- | ---: | --- |
| NF207-S01 | 74804ms | cut7 admission、正常current/cal32再読、校正不足の拒否、同入口再認証 |
| NF207-S02 | 3044ms | 共通reader固定15項目が旧V206 factsと厳密一致、受理0 |
| NP205-S01 | 7044ms | 共有Source変更後も旧7参照経路のfrontier全体が旧V205と厳密一致、受理0 |

S01は元8参照と全原入力を認証し、正常`prepareSamePaLifecycleFixture`でpredictionをcut7へadmitした。TOTAL10・view・calibration32の完了、Owner release、fresh currentと全32件の再読後に復旧用checkpointを保存し、専用sentinelのオブジェクト同一性で停止した。

次にcallerのcalibration配列だけを1件欠いた型付きcontextを渡し、既存の校正不足errorがauthstage到達前に拒否されることを確認した。DB・Source・fullrefは変更せず、query_only/transaction復帰、data_version、正常current checkpointも不変。同じ実case内で正常current cut7から再度入口を呼び、認証stageで別sentinel停止した。後半の新受理は0。想定したsentinelと負例error以外の例外・cleanup失敗は伝播する。

新規追記はprefix1・TOTAL10・view1・calibration32の4テーブルだけ。全旧row/rowid/schema/headとphysical head全行、元3DBのmain/WAL/journalを保持した。互換2copyは全logical digest不変。Source closure 845/842入力はpin専用で実行せず、実Vitest hostで上記3caseを1回実行した。Nodeで実行したのは1 Sourceのdigest bundleだけ。全Source/bundle/harness/inputの終了pinが一致した。private DB/raw/manifest/bundleは公開しない。

最終状態は正常current cut7、同8参照、event refs7、`predictionAdmissionProven:true`・`postAdmissionEntryReauthenticated:true`・`missingCalibrationRejected:true`・`nativePostForecastConsumerProven:true`・`nativeResumeAdapterRequired:false`・`resumeReady:true`。score・emotion以降の受理は0、`fullContinuationComplete:false`。NO_SPIN_TARGETと原2資格参照のhookを保持している。全RNG消費・第二Native対照・公式終端・試合全体の性能は今回の証明に含まれない。

## Source互換と検証

共通original-inputs readerはstage非依存の15項目だけを抽出し、current/HISTORICAL/prefix/TOTAL/cal32/各AFTER fenceはcallerへ残した。旧V206の呼出を元blockへ展開するとfunction bodyが同値であり、reader44行も元statement/orderと一致することを`aa48ba74b3244895b6cc55bf3bcbbe72` PASS125msで確認した。LANを含む外側処理・共通7参照reader順・旧score以降bodyの保持は`7fcfea94197d4e46b278909bd5b9e443` PASS4125ms。

初回strict `07dcd350f3f442fb89bd6da288661602` FAIL8625msを保持する。不足したtype importとBEFORE fenceの明示null引数2箇所を修正し、最終strict `b9fe47a91eea476c808cdb6d15b638ed` PASS8562ms、import-only `382a422fce1b49ddaedde21a3798ad63` PASS10485ms（actual全skip）、driver最終構文 `9cc88288e860434ba9d98f6446828455` PASS31ms。shared helper・tools・driverを独立reviewし、固定15項目集合の検査漏れを修正後、具体的な重大欠陥なし。

凍結SHA-256：shared `060b55c81ce757715488128da4ac433a14164f77641557ecb1ab6b80a29bf756`、V206 `ced0df76899a1802883c66edf0182a54214d059b791dad00b2a93341c8e79a82`、common reader `e179c129ec2855ed1eb486debae4ba19b379727066109b38dc657c800811bd10`、V207 entry `80ad9898419b7657154ce963e6e3aa2630eb115ff727e18330b462d0a860c787`、wrapper `a8421976211382782166b8ec3eec209469357f35cbaa3b0889c177341e6bf024`。

advance7の記録済みwall時間はprefix10768ms、TOTAL10959ms、view11097ms、current coverage2804ms、calibration32 12637ms、合計48265ms。CPU専有時間やCore単体性能ではない。次はこのcurrent cut7から既存`execution-input-ready`へ、残る2advanceと正常処理をまとめる。新export・新stageを追加せず、各正常advance後のcheckpointを保存し、途中失敗時に完了prefixを再実行しない。
