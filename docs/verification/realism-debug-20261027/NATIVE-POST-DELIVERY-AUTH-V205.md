# Native post-delivery再開入口 V205

2026-10-29 JST / `MB-20261027-REALISM-DEBUG-PLAN`。V204の保存deliveryを正常に再認証するNative専用入口を追加した。限定Native実行`e86ec27dac694212bfe4b9f65dfb6cb5`はPASS16500ms、実case `NP205-S01`は8012ms。全continuation・field/公式処理・全goalは進行中。

## 変更と停止位置

既存LAN専用entryの固定条件を転用せず、同じshared helperへ`continueNativeSpinNeutralV193PostDelivery`を追加した。既存の薄いcontextと7つの保存fullrefだけを受け取り、posture・intent・launch・capture・observation・delivery-cut・deliveryを正常readerで認証する。Native source IDsとlineage、HISTORICAL cut5、current physical delivery-cut ordinal2、prefix/events/TOTAL/calibration32/zero observation、generic AFTER fenceを確認する。tool側でも原Actor/model/body・fresh field校正・資格2・control/genesisを再認証する。

読取phaseを閉じた直後に`native-post-delivery-entry-authenticated`を通知し、専用sentinelのオブジェクト同一性だけを捕捉して停止した。他の例外とcleanup失敗は伝播する。stageを通過する通常経路は、既存private `completeInFlightBattingDelivery`へ`options`をそのまま渡す。NO_SPIN_TARGETの2資格参照を含むhookを保持する。

新exportの64行を除いた全helper bytesが、V204実行manifestのSHA `8188b012f2253f4408beb53e988f641534e0fefe38d9747619f9a1114a479293`と一致することを`8c9ef7ffd3954f66917726a03c169e3a` PASS93msで確認した。LAN entry・既存post-observation entry・private tail本体に変更はない。

## 実証範囲と保全

V204 retained verificationのPASS記録とmain/WAL/journal pinを固定し、新owned SQLite backupを使った。新しい受理・lifecycle advance・cut6 admissionは0。全row・rowid・schema・headのdigestが実行前後で厳密一致し、元DBとSource/bundle/harness/inputの開始終了pinも保持した。練習・TAKE・launch・capture・観測・deliveryを再生成していない。

842 Sourceのclosureはpin専用で実行せず、実Vitest hostで上記1caseを実行した。Nodeで実行したのは1 Sourceのdigest bundleだけ。private DB/raw/manifest/bundleは公開しない。

保存状態は`nativePostDeliveryEntryAuthenticated:true`・`nativePostDeliveryConsumerProven:true`・`nativeResumeAdapterRequired:false`・`resumeReady:true`。deliveryは未admissionで、`finalLifecycleCurrentProven:false`・`consumerAdoptionProven:false`・`fullContinuationComplete:false`。後続admissionから公式終端までの実証と、この入口の通常consumerへの採用は今回に含まれない。8012msを試合全体の性能値として扱わない。

## 検証と判断記録

strict `434c996ca9e64ff0be7144ede6a7863c` PASS9328ms、host import-only `8a0846dd834c4b5fbcd97e4ed40ae4be` PASS8047ms（実case skip）、driver構文 `43d7758a892c4bd887b58dff81dc4864` PASS47ms。Sourceとdriverを別々にreviewし、具体的な重大欠陥なし。元V204 driverのFAILとreadonly復旧証拠、過去のFAIL/UNKNOWNは保持した。

凍結SHA-256：shared helper `ee92e0bdc9dde99130d0b00b7d00485b6d375e1ff99ce39a7c46e0ed56d35f74`、tool `2f64e20cddb894af0b77140cc25dcd400e7a461bbb9f67bb646d48f3732f10e7`、wrapper `c7fced6e476293a7154eccc1bf9595d897debe41b69f55fd65f072eda93f9241`。

次はこの入口から既存tailの最初の正常admission境界へ進み、保存できる次の最小区間を実証する。全tailや完了済みsetupの反復へ戻らない。
