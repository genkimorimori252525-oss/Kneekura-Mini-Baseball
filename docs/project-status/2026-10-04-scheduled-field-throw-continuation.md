# 非デザイン継続: actual transferの途中保存とrelease handoff

更新: 2026-10-04 JST（2026-10-03 UTC）

[PR262](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/262) の実物理履歴に続き、runtime06 §9のcommitted physical workを、既存のactual throwへ接続する。従来は一回の採用で持替えから送球まで実行していたが、今回の追加経路ではrelease前の物理時刻で保存・再開できる。

## 実装

- Core `prepareBattedWorldScheduledFieldThrow` は既存のPlayer/Person model、確保済みcursor、active receiver、完全なmotor commandsとcoverageからoriginal planを作る。予定の物理結果を先に保存しない
- `advanceBattedWorldScheduledFieldThrow` は元のaccepted trajectoryを、要求されたelapsed時刻・最初の接触・元のrelease時刻のうち先に来る境界まで再導出する。新しく採用するspanは検証済みのactual前回cursorから結果までに限定する。Recorded tickが同じでも実elapsedが異なる途中点を扱う
- 元のtransfer開始・due・RNG identityを維持し、再開で持替えを最初から数え直さない。Coverage外への延長、偽のplan/progress、terminal後の再releaseは拒否する
- Release前またはreleaseと同時の実接触は中断になる。Releaseを越えるcheckpointを要求しても、まずexact releaseで止まり、以後のfree field motionへ渡す
- Nativeは既存の一つのfield-execution ownerに `throw_plan` と `throw_advance` を追加する。別の競合ownerは作らない。pending transfer中の新しいmotion/acquisition/throwは拒否し、履歴/rule観測は時間や仕事を増やさない
- Event receipt、transfer sourceの状態、actual release field/cursor、後続ball/contact workへのhandoffは同じimmutable snapshot/headのtransactionに含む。Callerからrelease結果、完了、watermark、terminalを受け取らない
- Source固有のqueue coverageは実行済みの時間を越えない。Transfer sourceが完了しても後続ball/contact sourceは未完了であり、全プレーのregistryやPlayEndとは区別する
- Planはfuture workとして分離し、実行済みtransferだけをfield/base/whole-play履歴へ追加する。元pitchのserialized timelineや既存atomic throw APIは書き換えない

## 境界検証で修正したもの

1. 非2進端数の加速を細かく分割すると、保持球と同じgloveの計算丸め差を自己衝突と誤認する問題を再現した。さらにrelease queryの接触構成にも同じ丸め差が波及することを独立reviewで再現した。元のaccepted originから要求境界までのbounded再導出へ揃え、新しく採用するdeltaだけを前回cursor以降に限定する。球・actor geometryを移動せず、共通kernelに緩い許容値を足さない。複数の加速度と分割数でcontact/response/cursorの一致を検証する
2. Release直後のzero-duration queryでground/actor接触が起こる場合、releaseCursorとactual continuation cursorが異なるか、後者がnullになり得る。Receiptは元releaseCursorを保持し、handoffはactual fieldとnullable cursorを保持する。架空のfree-flightを作らない
3. Whole-play historyも上記のraw release/boundary/responseを保持する。Releasedという理由だけで、必ずhorizon/free cursorになると仮定しない

## 検証状況

Node26.10.0 / Vitest2.1.9、既存lock、cloud-local TMPDIR、one worker。

- 最終Core integration: **5 files / 115 tests PASS**、9.25秒、exit0（scheduled31、既存atomic23、live-work27、new history9、既存history25）
- Source固有live-workと既存queue/registry: **50 tests PASS**
- 最終Native基本経路: **3 tests PASS**、77.48秒、exit0。対象Core/live/Native production SHA256は実行前後で一致
- 履歴結合: **3 files / 38 tests PASS**。旧physical-prefixとSQLite whole-history回帰: **16 tests PASS**
- 初回WAL/currentness: **30 tests PASS**、693.76秒。これは丸め修正前のCoreで実行した結果であり、最終Source全体の結果にしない
- 最終Coreでのselected WAL再実行: **5 tests PASS**、136.25秒。late plan rollback、cached peer、future head、receipt/handoff atomicity、canonical rehashを確認。対象6 SHA256は実行前後で一致
- 17種類のlate-mutationを一つのfixture/trigger loopへ統合し、全variantのarchive/head/dependency保存・release不在を個別assertする。重いfixtureを17回作り直さない。最終Coreで統合loopと2種類のreceipt integrityを再実行: **3 tests PASS**、155.54秒、対象6 SHA256不変。最終fileは16 testsで従来の32 behavioral variantsを保持し、late-mutation部分は367秒から89秒へ短縮した。未選択の13 testsをこの最終runで実行済みとは扱わない
- 最終typecheck / tracked diff check: PASS
- Fresh independent review: new sliceのCritical/Important findingなし。115 focused tests、21種類のfloor/partition外部probe、100回の不均等checkpointと完全なhistory採用、実wall/receiver/carrier-body contactを独立検証。指摘されたzero-time historyとpartition-dependent contactは修正後に再検証済み

新しい累積Sourceのwhole成功はまだ申告しない。PR262の固定Source wholeは独立checkoutで実行中であり、その結果をこの変更へ流用しない。

## 既存経路で確認した別の互換性課題

旧atomic `throw` にzero-delay modelを用い、直前motionとexact same-timeでreleaseするNative prefixでは、直前control windowのinclusive終端が残ることを独立probeで確認した。実際のfoot/base接触や誤OUT/SAFEまで再現したものではない。新scheduled経路はrelease時点をexclusiveに補正する。旧保存済みsnapshotの再生規約を無言で変更しないため、旧経路は版付き解釈・互換性を保つ別の修正として残る。

## 残る接続

- Acquisition自身のsecureまでのscheduled lifecycle
- 実ball/rule/perception/decision sourceを完全に集めるNative registryとcausal actor settlement
- 実証されたPlayEndからofficial closure/scoring/legal Match/actual-role workloadへ至る接続
- 本番の観測・判断・運動policy/calibration bindingとcontroller、next-play、development/opportunities、自律Career

Source固有の消費済みeventやsynthetic fixtureは、全プレー終了・自律controller・本番calibration・Career全体完成の証拠ではない。デザイン/UI/art/Presentation、自宅/self-hosted CI、workflow/config/lock、merge/force pushには触れない。
