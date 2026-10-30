# 配達済み観測から測定スイングへSPIN試行を反映

2026-10-30 JST。製品の`simulateLivePitchV1`に、明示した未校正試行を測定clipの最終登録へ反映する入口を追加した。**LiveMatch／Makerの選択UIへの配線、技術名どおりの4回転、人間校正・真正資格・最終配送は未完成。**

## 利用可能になった範囲

optional request `observedSpinTrialV236`で、技術・subject・clip id／SHA／左右・二平面とXY deltaを宣言できる。同じ配達済みV151標本／cutoffを凍結し、保存forecastとの一致を確認して二平面crossingを求める。完全空力trajectoryの型へ偽装せず、実接触を見て入力を逆算しない。

contact-depthと到達時刻は実行clockへ、`aimedContact + aimError`は最終translationへ反映する。`nominalReferenceV153`によるspin offsetの消失を回避した。plate側の`aimedPlate`は診断値で、直接の運動入力はcontact側。既存latency・速度制約・誤差によるずれを残す。適用後のlate reaimは行わない。

`APPLIED`は計画／登録への適用だけを示す。subjectは`CALLER_DECLARED_NOT_AUTHENTICATED`、`earnedQualification:false`、未校正であり、Native資格や習得への昇格経路はない。欠観測・域外・clip違い等はNO_TARGET、不正値／改変forecastは拒否する。未指定時は旧経路を保持する。

## 実装と検証

新adapter／testとLivePitchの最小差分。新依存・Owner・保存schema変更は0。Astraは今回新しく実装されたforecast／clock／最終登録とauthorityの境界だけを読み、明示試行限定でReadyと判定した。

- 7 tests `f0f38f5af00b48f79d0600211fc54e43` PASS、4,500ms。汎用右打者・測定clip・同seed31・同V153 PLANNED入力で、4つの明示XY指定は異なる最終登録となり、有限fixtureでは4件とも接触した。技術名からdeltaを自動生成する試験ではなく、回転方向の成功判定はしていない。
- 未指定時の全recordと2時点のバット標本は、編集前Sourceを使うbundleと厳密一致。連続運動全区間の比較へは拡大しない。
- contact-depth変更は最終深度と実行clockを変え、同じ誤差・latencyが継続することを確認。
- TOPと宣言した1件の実contact exit velocity／spinを、そのまま既存空力Coreへ渡し10ms進めた。全4件の全飛行・公式終端ではない。
- 対象strict `63025be34cc34de0a349cfc5faac1dcd` PASS、2,578ms。

log SHAはtests `2bbdb49921978f25f19ef2ba7eb2c8de49b7eb22919a0db469ba6d53f7af8385`、strict `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`。Rootはtask／PASS／exitとlog実bytesを照合し、同じテストを再実行していない。

Rootレビューで、互換テストがprivate baselineを必須にするP2を修正した。baseline不在では当該1件を明示skipし、通常6件は依存しない。変更対象の互換1件だけ `d6395c33fb2a4c41baee019aab69ada4` PASS2,842ms（他6件skip）、最終strict `30b7fd1b2a3845d7af6d28484068f3da` PASS2,937ms。production2Source不変なので他6件の既存PASSを再利用。baseline不在の実環境での実行はしていない。

Source SHA: LivePitch `70504098d91ca4e0a0f4cde4d6d568812747927fd643b4d0ad0ae4816d366cea`、adapter `7ce1062800a696eac4e94f435501c9c2b1395608767d952ff359586a7098f6a5`、最終test `1ed52c9a4c71b68e5f6c2cbda607f04561104dc8b02d021faf19084ac94fa254`。

Rootはworktree／Git親baselineと現Sourceの全bytesを確認し、隔離したscratchへ逆patchを実適用して元101,876Bへ全bytes復元した。実Sourceは変更していない。baseline SHA `8b3b338d55b62f9cd7727f1227f9af6c3bdf645d2a2c3595640098801d33ec59`、担当reverse proof SHA `7f80c2f0f237abf475c6b02fe97dcea07e5111cc9d132bd67c3da25dd40829e2`、Root確認 `work/v236-root-reverse-check-01/review.json`。

途中の空力テスト`b9a20c2f`はcontact後elapsedを0に戻したためhorizon外で失敗。実contact elapsedを保持して修正した。`3fb6f215`は未配達標本を凍結済み集合に混ぜた壊れたfixtureで拒否され、正しいdelivered-only集合へ修正した。元失敗receiptは保持する。上位package.jsonのtype警告も環境変更せず残す。

## 次の具体操作

本人原JSONを正常なMaker／試合の変換経路で使用し、現在の実行clip／観測へ明示試行を配線する。最終実運動・実回転・全空力／弾道を技術別に確認し、成立しない指定は未成立のまま保持する。汎用fixture、技術名、Native資格fullrefの転記だけで4技術完成にしない。獲得・自然Goldと完成3HTML配送も残る。
