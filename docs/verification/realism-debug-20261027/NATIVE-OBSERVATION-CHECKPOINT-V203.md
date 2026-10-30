# 保存captureからの観測checkpoint V203

2026-10-29 JST / `MB-20261027-REALISM-DEBUG-PLAN`。正式post-observation cut4までの限定Native実証は完了。全continuation・field/公式処理・全goalは進行中。

V199の保存current captureを新owned SQLite backupへ移し、captureのadmission、正常observation受理、observationのadmissionを進めた。`486ca163ad024e83a63b874e1604129c`はPASS109186ms。練習・TAKE・launch・captureを再生成していない。

## 正常に進めた境界

元current captureと直前historical cut2、prefix/TOTAL10/calibration32/dispatch32、Actor/posture/intent/model・fresh field校正・bodyを正常readerで再認証した。未admissionのcaptureに対して、古いprelaunch current/next-pitch/head0を要求していない。

既存`InFlightBattingLifecycleFixture`の宣言と同じ順序でcaptureをcut3へadmitし、時刻を1tickだけ変えたwrong-time観測を正常Ownerへ渡して拒否を確認した。当該Source行0・sensory head不変を確認後、正しい観測を受理・正常再読し、cut4へadmitした。

最後に実`continueNativeSpinNeutralV193PostObservation`を呼び、正式なcurrent cut4の認証完了位置で専用sentinelのオブジェクト同一性だけを捕捉して停止した。他のエラーとcleanup失敗は伝播する。shared helperの変更やdelivery以降の実行はない。

## 追記と保全

| table | 追記行数 |
| --- | ---: |
| lifecycle prefixes | 2 |
| lifecycle TOTAL | 20 |
| lifecycle views | 2 |
| lifecycle calibrations | 64 |
| observations | 1 |
| observation invocation heads | 1 |

合計90行が一致し、変更tableもこの6種類だけ。対象sensory headは元に存在せず、revision1の新規行を作った。全旧row/rowid/schema/headとphysical head、元main/WAL/journalは保持した。wrong-time Sourceは永続化されていない。

844 Sourceのclosureはpin専用で実行せず、実Vitest hostの新`NF203-S01`を1回実行した。1 Sourceのdigest bundleだけをNodeで実行し、Source/bundle/harness/inputの開始終了pinが一致した。正常view fullref、元4refs＋observation refのresume pins、元入力と全記録をlossless保存した。private DB/raw/manifest/bundleは公開しない。

`resumeReady:true`、`fullContinuationComplete:false`を保存。delivery/commitment/resolution/field-root/公式終端は未実行で、109秒を試合全体の性能値として扱わない。

## 検証と判断記録

最終strict`42468e1864484ef885c28096ed98d3a5` PASS10562ms。host import-only`f08e13940c464e329265acec5f9b4356` PASS8110ms（本体caseはskip）。原型FAIL`6559bb09`は保持した。writer受理後の再認証は、borrowed readerのcaller制約を避けるため正常`perception.readObservation`を使用する。

driver独立reviewで、子の`exit`直後にlogを閉じる問題を指摘され、stdio閉鎖後の`close`を待つ形へ修正した。最終構文`d7f3315ee0a04a34a1bcba0b4f51213f` PASS62ms。Sourceとdriverを別々に最終reviewし、具体的な重大欠陥なし。元DBの移行・Owner認証の緩和は行っていない。

凍結SHA-256：entry `f534963fd2c2aa973acd6ba352b70bd8cadecc0c22a2997c7a3fd82b7f9dcf2d`、wrapper `2dd2d0db331eb437e3aab5d2b2f55dd05932b6e23626dbee9ed1f9f257c119e2`。

次はこのcut4から、元の遅延条件でdelivery-cutと正常deliveryを受理し、deliveryのadmission前に保存する正式境界を調べて接続する。全tail・旧prefix・練習を再実行せず、以前のFAIL/UNKNOWNは保持する。
