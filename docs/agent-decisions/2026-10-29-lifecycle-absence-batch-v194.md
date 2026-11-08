# V194: lifecycle不在ID検査のbatch化

2026-10-29 JST / `MB-20261027-REALISM-DEBUG-PLAN`。

本人の同一Coreによる正確な高速debug要求と、全体計画Task1/Task5の範囲内で進める。通常判断は記録して進める本人方針を適用する。public API、保存形式、物理・心理・接触式、認証条件は変更しない。

## 根拠と対象

V193の600秒実行はTIMEOUTを保持。受理済みGold2/NO_SPIN_TARGET/実接触は正常Owner readonly回収`0f10069d`で確認済み。保存69stageではlifecycle関連が約411.7秒/68.6%、advance一式が44.418→92.699秒に増えているが、個別CPU原因は未分離。

対象は`SamePlateAppearanceLifecycleFromSqlite.ts`の`readSamePaLifecycleSetFromSqlite`に限定する。現在、10–13 TOTAL/32 calibrationの不在IDごとに、同じ`pa_*`/`batting_*` tableと両JSON mirrorを走査する。実SQLiteの新caseは、1 IDで各JSON列READ2回、32 IDsで64回を観測。`a517a905`は16 semantic PASS/この性能caseだけRED。

## 判断

同一Native immutable read phaseの一つのbatch内だけで、対象ID集合についてtyped claimをまとめて調べる。identityのschema/index/alias確認と既存recordの行動再認証は従来どおり実行する。global cache、statement cache、hashによる比較代用、新依存は導入しない。

一括で先読みして後のエラーを先に出さないよう、table/JSON列ごとの走査を遅延実行し、現在のIDのclaimが見つかった時点で従来と同じエラーを投げる。前方のorphanがある場合、後方のauthorizer拒否tableへ進まない。baseline追加case `a4eaf636`でこの順序を確認済み。

保持する条件は次のとおり。

- 全owner table、index、source/snapshot両mirrorと同じtyped `owner`/`sourceId`条件。
- alias/複数claim/欠落owner拒否。削除・移動ownerを「新規」として修復しない。
- batchの出力順序・重複・nullと、先頭からの拒否順序。別snapshotへの結果持越しなし。
- full rowsの4検査境界、deriveSet/readSetの既存呼出し、schema/変更件数/transaction検査。

## 検証と復旧

新SQLite metadata/absence試験は真正Actor/physical採用の証拠と区別する。Rootは編集前の実Sourceをpinned Node bundleへ保存し、変更後と同じ保存Native DB/入力を比較する。開始manifestを実行前に保存し、timeoutでも初期証拠を保持する。対象module以外のSource差を許可しない。物理operation/練習の再生成は行わない。

Source差分後の限定試験・strict型・保存DB上のold/new結果/呼出元・行/rowid/catalog不変と実測を確認する。改善量は実測前UNKNOWN。失敗は削除せず、関連差分だけ修正する。

開始Source SHA-256は`94f241dfa9d0438b66237d1fddb1b381cc8f9f11d0334de594e9fe1346746365`。開始時から存在するassessment provenanceの3追加/6削除の共有差分は保持し、今回の変更所有には含めない。復旧は今回の限定hunkを開始Sourceへ戻すことで行い、他者差分や保存DBを巻き戻さない。

## 実装中に確認した互換性と公開依存

不正Unicodeの置換後のNative bindingと、JavaScriptの元文字列は同じkeyではない。試作がorphanを見逃す`0299b77f`のREDを受け、SQLが各bound IDとの一致booleanを返す形に修正した（`5ff2baf2` PASS）。文字列を丸めたり置換して比較しない。通常stored TEXTでない鏡、virtual tableは元のper-ID検査へfallbackする。generated/hidden鏡は元の`table_info`列挙で対象外のまま。

公開時に既存provenance委譲だけを外すと、検証した実Sourceと別になる。このため当初の「新変更所有には含めない」は維持しつつ、**公開依存としての採用**を別に記録する。既存`SamePaAssessmentProvenanceV129.ts`/V129・V130契約test、`SamePlateAppearanceContinuationFromSqlite.ts`のprovenance委譲とmutable-phase失効、lifecycleの既存委譲に限定して、現在Sourceのまま統合する。独立の静的reviewで拒否条件の弱化は見つからず、provenance-onlyは旧3条件、default/allは旧5条件を保持する。今回変更したbatch本体と混同せず、Dispatchにある別のreader memo化や他の共有dirtyは採用しない。

この依存統合に対し、関連する既存のmetadata契約試験を一度確認する。Native全練習・旧600秒scenarioは再実行しない。publicな入力形式・物理結果・保存形式を変更する採用ではない。
