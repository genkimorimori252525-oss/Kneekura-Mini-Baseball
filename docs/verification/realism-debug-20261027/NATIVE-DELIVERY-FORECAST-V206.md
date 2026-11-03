# 保存deliveryからのforecast checkpoint V206

2026-10-29 JST / `MB-20261027-REALISM-DEBUG-PLAN`。保存deliveryを正式admissionし、最初の正常forecast受理まで進めた限定Native実証。`765e378667314cdd9ac611a060e4920b`はPASS74360ms。全continuation・field/公式処理・全goalは進行中。

V205の保存状態と7つのfullrefから原Actor/model/body・fresh field校正・資格2・control/genesisとNative entryを正常再認証した。同じ実case内でそのまま正常`prepareSamePaLifecycleFixture`によるdeliveryのcut6 admissionへ進み、全TOTALとcalibration32を受理した。既存tailのforecast受理後、既存`forecast-ready`で専用sentinelをオブジェクト同一性だけで捕捉して停止した。認証だけの別実測、shared helperの変更、停止点の追加はない。他の例外とcleanup失敗は伝播する。

## 停止時の認証と保全

正常readerでforecastを再読し、元observation/delivery/modelとcut6への参照を確認した。最終cut6はHISTORICALとして読み、current physical headがdelivery-cut ordinal2のままであること、generic AFTER fenceでforecastが未admissionの1件であることを認証した。予測をadmitするcut7以降は実行していない。

| table | 追記行数 |
| --- | ---: |
| lifecycle prefixes | 1 |
| lifecycle TOTAL | 10 |
| lifecycle views | 1 |
| lifecycle calibrations | 32 |
| predictions | 1 |
| invocation heads | 1 |

全旧row/rowid/schema/head、physical head全行、元DBのmain/WAL/journalを保持した。forecast用invocation headだけを新規追加し、既存observation/delivery headsは変更していない。練習・TAKE・launch・capture・観測・deliveryの再生成は0。

元7refs＋forecastReferenceの8つのresume pinsと全event refsを保存した。`deliveryAdmissionProven:true`・`forecastAccepted:true`・`forecastAfterFenceProven:true`。最終viewのcurrent認証はしておらず、`finalLifecycleCurrentProven:false`・`nativePostForecastConsumerProven:false`・`nativeResumeAdapterRequired:true`・`resumeReady:false`・`fullContinuationComplete:false`と明示した。NO_SPIN_TARGETと原2資格参照の将来hookは保持し、今回実行していない。

Source closureはpin専用で実行せず、実Vitest hostの`NF206-S01`を1回実行した。Nodeで実行したのは1 Sourceのdigest bundleだけ。Source/bundle/harness/inputの開始終了pinが一致した。private DB/raw/manifest/bundleは公開しない。74360msを試合全体の性能値として扱わない。

## 検証と判断記録

strict `47c4c5bfe472441d8f115eece479981f` PASS9344ms、host import-only `60b7bd4190474c1fbb59196c1cc55a59` PASS7922ms（実case skip）、shared helperとV205の既存3 Source不変 `397e05957cc042d694e1c91629b7c0b3` PASS93ms、driver構文 `f1ae3e2eef094294b21455d1166f93c8` PASS46ms。Sourceとdriverを独立reviewし、具体的な重大欠陥なし。

凍結SHA-256：entry `194788621df8372fe79a5a69c5de90569d3a5b2431ed5bb5adf1851ae35073c6`、wrapper `3d5e23fd09ef964d1df5fe4cc43fe438a7d26af3ad66284fc8d1586b7004ced6`。

次の既存停止点までには3回のlifecycle advanceが含まれる。全tailをまとめて再実行せず、保存forecastを受け取るNative入口と、正常prediction admission後の保存境界を設計する。入口認証と続行を同じ実caseで証明し、LAN guardと正常Owner条件を保持する。過去のFAIL/UNKNOWNも保持する。
