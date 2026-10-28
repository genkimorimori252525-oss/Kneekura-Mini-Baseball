# V182: 原接触から測定へ渡すNative adapter

2026-10-28 JST / MB-20261027-REALISM-DEBUG-PLAN Task5 SPIN-03。新NativeMeasuredBattingContactV182.tsと専用testを実装。既存Source/物理/DB schema/UIを変更せず、正規SamePA resolution/launchを同じNative read snapshotで認証して、当該投球の原contact・actor binding・Source・元game/play/pitch/event scopeをdetached/frozenで返す。無接触はnull。過去投球のcontactを再計数せず、TraitTime/認識Source/model/名札を生成しない。

## 実検証

- RED50949a79（初回missing module/0test）と54ada729（S01のnull/期待contact差）を保持。最小実装後f58f4f66ffef4fd1a8189340d4144f05 PASS7015ms、専用3test。pure helperのsynthetic timelineはNative認証の証拠としない。Native空DB/不正refではcaller transaction/query_only/authorizerを保持して拒否。
- 全型ad49f2a5d29f4950af34efa632fbed91 PASS26610ms。独立read-onlyレビューで具体的な欠陥は見つからなかった。
- 正規Owner実対照519919ed72fe4e6285c3864ac195d805 PASS21000ms。旧保存Native試験の既知1接触を私的コピーで読み、新APIの成功2回がメモリ上でlossless一致。原contact/exitVelocity/exitSpin、binding、Source、native event/scopeとの比較差0。深いfreeze/全objectのdetach/input ref detach、caller transaction/query_only0と1/authorizer、total_changes不変を確認。既知snapshotHash改変ref1回を拒否。
- 元main/WAL/SHM/journalの全状態pin、私的コピーの終了状態、compile load時と終了時のSource791入力SHAは一致。元DBをopen/PRAGMAせず、旧V147全工程/成功型/UI/キレ研究を再実行していない。

Native試験はsynthetic pole等を含む旧fixtureで、実在選手/正式calendar/自然cohortや物理校正の証拠ではない。原payload/本人binding/私的DB pathは外部公開しない。実結果はローカルnative-measured-contact-v182-02/に保持した。

## 入口のFAILと判断

raw locator d875fcd6 PASS78msは既知3rowのhash/接触1件と元main不変の確認だけで、Owner再認証はfalse。初回688549ecはRoot harnessのaction table名誤記を正規Storage定義action_plansへ修正したFAILとして保持する。

Native probe初回3eaf5ff4はWAL存在条件で109ms停止、コピー/API0。実WALは厳密0 bytesで、元全状態は不変だった。[SQLite WAL形式](https://www.sqlite.org/fileformat2.html#walformat)と照合して0B/empty SHAだけをコピー対象へ加え、非空WAL/journal停止と全入力pinを保持した。元FAILを成功へ書き換えず、新out02で再開した。詳細判断は../../agent-decisions/2026-10-28-native-contact-measurement-v182.md。

## 未完

これはNative SamePA側の測定入口の実装で、line_driveの自動認識・全打者分布・表示joinの完成ではない。元PhysicalPitch直接経路のproducer、episodeの正式対応、career暦/日内順序、BATTING_CONTACT集計snapshot、production認識modelを継続する。Native gameDay/PA sequenceをTraitTimeへ推測変換せず、fixture閾値をproductionへ転用しない。全goal・キレUNKNOWN・最終同版配送/設計照合は未完。
