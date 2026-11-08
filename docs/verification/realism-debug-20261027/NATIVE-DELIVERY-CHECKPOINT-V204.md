# 保存観測からのdelivery checkpoint V204

2026-10-29 JST / `MB-20261027-REALISM-DEBUG-PLAN`。正常deliveryの受理と未admission境界までの限定実証。全continuation・field/公式処理・全goalは進行中。

V203の保存cut4を新owned SQLite backupへ移し、元のActor・model・body・field校正・資格2・posture/intent・prefix/TOTAL/calibration32・dispatch/controlを再認証した。既存Native post-observation helperで遅延delivery-cut、cut5へのadvance、正常delivery受理を進め、`delivery-ready`の専用sentinelをオブジェクト同一性で捕捉して停止した。後続admissionは実行していない。他のエラーとcleanup失敗は伝播する。

最終cut5はHISTORICALとして読み、現在のphysical headがdelivery-cut ordinal2であることと、generic AFTER fenceで未admission deliveryが1件であることを確認した。LAN専用の`resumeInFlightBattingDelivery`は転用していない。`resumeReady:false`・`nativePostDeliveryConsumerProven:false`・`nativeResumeAdapterRequired:true`・`fullContinuationComplete:false`を保存した。

## 実行と保存検証

実Nativeの`NF204-S01`はPASS72640ms。driver全体の初回receipt `698e12aaf8a64ce199ad35944cf6e2ff`はFAIL81125msとして保持する。原因は保存検証の対象head比較で、SQLiteのnull-prototype行に対し、期待値だけをspreadで通常prototypeへ変えていたことだった。正常Owner処理の失敗ではない。

実行時driverを元manifestのSHA/14711bytesと照合してprivateへ保存し、期待値のprototypeを保持する箇所だけ修正した。新しいretained verifierは、その限定差分・元FAIL・同Buffer入力pin・両DB初期pinをimport/DBopen前のmanifestへ保存した。Nativeを再実行せず、保存結果を読み取り専用で検証した`78f1fb996a6e452eab2f161031a29f57`はPASS968ms。

| table | 追記行数 |
| --- | ---: |
| lifecycle prefixes | 1 |
| lifecycle TOTAL | 10 |
| lifecycle views | 1 |
| lifecycle calibrations | 32 |
| physical cuts | 1 |
| deliveries | 1 |
| invocation heads | 1 |

対象physical headは同じrowidを保ち、operation ordinalの+1とdelivery-cut参照3列だけが変化した。全列比較で他の変更がないことを確認した。他scopeのphysical heads、全旧row/rowid/schema/head、元DBのmain/WAL/journalを保持した。保存targetもretained検証の前後で不変。launch用consumer/consumption/admission companionsの追加はない。

Source closureはpin専用で実行せず、実Vitest hostで上記1caseを実行した。digest bundleだけをNodeで実行し、元実行・retained検証ともSource/bundle/harness/inputの終了pinを確認した。private DB/raw/manifest/bundleは公開しない。

## 検証と次の境界

strict `90afd7af927242fd8054c7b4bdb73e20` PASS9485ms、host import-only `0f2b6ccf3e30426a8900a4b310230d47` PASS7921ms（実case skip）。実driver式のBigInt保存変換と実debug codec `ea527d45df794e6196a951331ea506f7` PASS46ms。修正後driver構文 `2d645ba68f344bac887463c90ce85668` PASS31ms、最終retained verifier構文 `6b388eefbc354258bf9ddcee968c2817` PASS62ms。Source・driver・retained verifierを独立reviewし、指摘修正後は具体的な重大欠陥なし。

凍結SHA-256：entry `aa43f73ed7e7aa67fb79f93a53c6ee1b122dde66ab43d0e203228092a85ba181`、wrapper `b344d3a40ac6c4bf8dc82e097838bee76c88450a74aa3780703702c13ae0277e`。

次は7つの保存参照を受け取るNative専用post-delivery入口を追加し、認証完了stageで停止できるようにする。既存LAN guardは変更しない。練習・TAKE・launch・capture・観測の再生成、delivery admission・予測・commitment・resolution・field/公式終端は今回の実証に含まれない。過去のFAIL/UNKNOWNを保持し、この時間を試合全体の性能値として扱わない。
