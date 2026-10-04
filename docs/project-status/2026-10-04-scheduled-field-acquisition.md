# Scheduled actual field acquisition

更新: 2026-10-04 JST

確定非デザイン残計画の、実glove contactからsecure確認までを途中保存・再開可能にする接続。既存のatomic acquisitionとarchiveを維持する追加経路。

## 接続した境界

- 元のsole-glove contact、Player/Person、retention energy、dissipation power、全actor motor coverageと実geometryを所有するplan
- Capturing、減衰完了後のfence pending、confirmed、interruptedを区別するbounded advance
- Preparationやpartial advanceから未来の接触を先読みしない。元のcurve上で実行したdeltaだけを保存する
- Exact secure evidenceは元の減衰完了時刻、current carried cursorは実行済み確認fence。時刻を巻き戻さない
- 未確認でも実際の拘束中ball位置は観測できる。支配や普通のfree/carried continuation権限はまだ付けない
- 同じNative execution ownerでplan/advance/head/receiptを保存し、途中の別motion・throw・captureを拒否する
- Whole-play/field history、actual observation、base touch、first-base raceへ同じ実prefixを渡す
- 確認待ちの支配が空でも、否定的証拠としてSAFEを確定しない。明示的なpending possessionを保持し、過去の保存済み観測・判定を後から書き換えない
- Capture Sourceの完了と、custody・rule evidenceの未完了consumerを別に保持する。全体registryやPlayEndを捏造しない

## 公開前に見つけた境界修正

1. 非ゼロ開始時刻で、solverの減算/加算によりcontact-free終端が1 ULP前後するケース。新しいscheduled経路だけが成功したrequested horizonを正確に所有するようにし、確認待ちの無限継続とfence超過を防いだ。Raw contact moment、collision tolerance、既存atomic経路は変更していない
2. 同じ接触時刻でglove constraint適用後にground contactが生じる実Nativeケース。最初のscheduled advanceだけが、正確に一致する元incoming momentとconstraint responseを使ってcanonical contact集合へ射影する。Raw progressと元incoming履歴を保持し、genericな同時刻許容や既存atomic archiveの意味は広げない

## 検証

CoreのRED→GREEN、実SQLiteのpartial/reopen/confirmation/continuation、pending競合拒否、real foot/base geometryによる確認待ち→OUT、同tick競合、raw history、知覚receipt不変性、WAL late mutation/rehashed corruptionを検証する。確認待ちに旧raceを直接適用すればSAFEとなるfixtureで、新しいNative接続が結果を保留することを確認している。

最終の固定Source、focused gate件数、独立review、publication treeはPR本文へ記録する。#266のwhole成功はこの変更後のwhole成功を意味しない。

## 残る接続

個人の知覚に基づくdecision/first-step/motor、全ball/rule/communication consumer、causal actor disposition、完全registry/watermark、physical PlayEnd、official closure/scoring/workloadと自律Career。数値calibrationは明示入力のままで、合成fixtureから実測の本番精度を主張しない。UI/art/Presentationは未接続。
