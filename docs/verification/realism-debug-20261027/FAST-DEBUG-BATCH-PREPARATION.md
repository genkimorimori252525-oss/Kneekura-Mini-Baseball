# 同Chrome batch検証入口の準備

2026-10-29 JST / `MB-20261027-REALISM-DEBUG-PLAN`。既存CLIへbatch入口を追加し、関連Node 41 tests・構文検査・独立reviewを通過した。実Chromeは今回実行していない。Task1残りBの複数seed一致・9回・性能受入は未完であり、計画どおりTask5のCore変更後に実測する。

## 実装した契約

```text
node tools/verification/live-debug-case.mjs --mode batch --case <case.json> --manifest <manifest.json> --seeds 1,2,3,4 --pools 1,2,4 --out <new-dir>
```

caseは既存version2のconfiguration/commandsを使用する。seedは明示したcanonical uint32を重複なしで受け付け、job IDをseedへ固定する。poolの枠や完了順からseedを作らず、configurationはseed以外の全値とcommandsを保持する。pool条件も入力順を保持する。

同一Chrome buildへ同じpinned Core/runtimeを投入し、seed別の通常main-host（描画待ちなし）でoracleを生成する。そのrecordsとinspect全stateをlosslessで保存し、既存`KneekuraBackgroundMatchV116`の結果と比較する。新seedでの通常1x UI再生まで証明したという意味ではない。通常再生との基盤A、今回のCLI準備、後続の実Chrome batch受入を区別する。

poolは1・2・4の有界page laneで、laneのpageを再利用し、jobごとにfresh hostと既存background queueを作って正常にdisposeする。永続Worker pool APIを新設したものではない。Core・Worker runtime・PRNG・時間刻み・record codecは変更していない。

比較対象は全recordsとinspect stateであり、その中のfactsと時計も省略しない。最初の差分と両方のlossless実物を保存し、保存oracleのSHAも再照合する。job結果は入力seed順で保持する。失敗後は新しいjobの投入を止め、実行中のjobを回収して全pageを閉じる。元のエラーとcleanupの失敗を保持する。

case・manifest・runtime・harnessの開始終了pinを検証し、新しいbatch moduleもharness pinへ含めた。既存parity/replayの経路を保持した。countはcommandsの有界prefixであり、今回は`nativeAdmission:false`・`fullGameVerified:false`・`performancePass:false`を維持する。

## 検証と未実証

最終の関連Node6 filesは`44ca8e912f85423f89c9da5b81c63821` PASS358ms、41 tests。対象はlive-debug-batch/case/record/core/checkpointとbackground-match-v116の既存関連試験。構文はcase `9cc0e4f9fc1248d483bd04d6b5cf6e8e` PASS32ms、batch `e9b45d43ec6c45588fd652cdc5f14671` PASS31ms。

先行REDは、最初のseed/pool API未実装`e0fdcdbbee574e4eb2ae7cd0158053d1` FAIL125ms、CLI/plan/比較/lanes API不足`e6b11126`、session接続不足`b65242ab`、non-Error失敗時のdrain/元error保持不足`0c53bc45`。全記録を保持し、修正後の関連試験を確認した。境界用fake sessionはI/O契約の試験であり、実Core計算・実Worker・Chromeの同値や性能の証拠にはしていない。

独立critical reviewでは、page.evaluateにNode closureを持ち込まないこと、同じCoreをMain/既存queueへ渡すこと、jobとpageの所有・終了、全値比較、終了pin、失敗保存を確認した。重大な指摘はなし。

最終SHA-256：case `d16315fce90c604883f3c5f40d1a7ca4045bcda43b90afab49476ad56a2b4b94`、batch `906c919e6e7889788feb013166c215cc5bcfd7547a353907b0c600c9e6acee6d`、test `2161698938fa0995216113739ff8ffaf4afa306a2c8b1ca7c2bcf13a414c6bec`。

今回の変更はNative実測のSource/harness closureと独立していることをstart manifestの全key/valueで確認した。V212の実行中にNative6 filesを変更せず、この3 filesはV212の9 files公開へ含めていない。

実Chromeの複数seed/pool一致、9回、速度目標・p50/p95・memoryを含む性能受入、最終同版3HTML配送は未実証。既存の旧FAIL/UNKNOWNを保持し、この準備を全goalや高速debug完成へ昇格しない。
