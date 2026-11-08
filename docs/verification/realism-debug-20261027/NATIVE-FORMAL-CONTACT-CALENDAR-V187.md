# V187: 真正Native接触と正式日付の結合正例

2026-10-29 JST / MB-20261027-REALISM-DEBUG-PLAN Task5 SPIN-03。V186で未実証だった正式calendarと真正contactの同snapshot結合を、小2club/4game/1接触で実証した。既存Original→PhysicalActor→ContinuousPitch→OfficialPitchWorkloadのtest fixture経路へoptionalな正式calendar初期化を通し、Native accepted cycle/WorldBound生成日程/archive/origin/National selectionをactorより前に保存する。

Core生成gameId/day11をauthority/roster/Match/initialWorld/action/actorへ一貫して渡し、既存withIntent(bunt)の原配置・実Coreで接触を作る。旧固定一試合への偽起点後付けや生rowの書換えを行わない。既定fixtureのIDs/物理/seed/body/SourceIDsはfallbackで保持する。Authored系やproduction Sourceは変更しなかった。

## 検証

- 957be6c24b0a4093a1667eb0aa52e0dbは未実装factoryのRED。05368026f6a54eb095085c017c7e7a8b PASS7671ms/新真正Native1件。実V186 readerのISO日付2032-02-29、seasonDay11、careerDay425、careerDayOne2031-01-01を独立literalへ照合した。q0/q1、Caller状態/非消費、再open再読、改変ref・opaqueID・余計なepoch入力・未commit誤epochの拒否とrollback復元を確認した。
- 新6Source確定後の全型aa1f74fbaf424e31ae6572357bbfbbc3 PASS26655ms。独立read-only reviewで既定挙動/引数forward、actor前の正式Owner登録、実acceptからの物理/fullref取得、全接続close、期待値の独立性に具体的欠陥は見つからなかった。
- portable実Node受入b9546b09307b4d92a5f36f661e89ac0f PASS1625ms。新bundleで同caseをcreate→全close→厳密な新私的copy→新API2read。原physical members/本人/速度・回転、正式origin/selection、425!=11と閏日の対応、重複2request→一意参照1件、全record/debug codecのkey順・数値を含む厳密一致、深freeze/detach、入力不変、Caller tx/q0/q1/authorizer/非消費、不正ref/不存在正式起点の2拒否を確認した。
- 同受入のSource858入力はload/終了SHA一致。元新fixture DB/コピー全files、bundle/harness/helperも終了pin一致。既存copy/pin/compile/end-checkを再利用した。私的DB/生payload/bundleは公開しない。既済V186の29件/型/legacy受入・旧Native・全League・キレgridは再実行しなかった。

unitは新TypeScript fixtureの統合、portableは実Node bundle/非消費・Source/DB pinという別範囲である。joinedPositiveFormalCalendarProven=trueはこのOriginal経路の一接触だけ。正常AI/習得技能/自然cohort/全population/認識の証明ではない。

## 次の境界

TraitTypes.ts:11のsequenceはsame-day observationsの順であり、global物理発生順は要求しない。測定Sourceはobservation.time<=source.time<=classification.time、eventIdと(day,sequence)の一意性、同eventの別episode再包装禁止を満たす必要がある。次はNative受理済みcontact fullrefへ永続observation receiptと日内受理sequenceを与える集計Sourceを設計・実装する。

正式日付のpositive joinによって世界全接触のcoverageや異なるowner間の独立identityを解決したとは扱わない。worldRevision/ID文字列順を時刻に直用せず、model/認識/表示joinと全goalを未完のまま保持する。
