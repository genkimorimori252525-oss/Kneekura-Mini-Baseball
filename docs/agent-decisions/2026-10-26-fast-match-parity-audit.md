# 通常・高速・複数試合の同値性監査

2026-10-26 JST / Task `MB-20261026-FAST-MATCH-PARITY-AUDIT`。

本人の「100試合以上同時にシミュレーションできるくらい」「試合と高速試合で差が生まれる可能性はあるか調査」を受けた読取・実検証。現在のv120候補とSource/旧成果物は変更しない。通常/高速UI・同Core描画なし・continuation・独立Workerの同じ入力による一致を限定試験する。100試合の実行や大規模runner実装を完了したとは扱わない。

判断: 100試合を一括投入できる設計は校正に有用。実行枠100個を常時起動することと分け、端末CPU/メモリで有界なpoolを選ぶ案を調査する。速度を理由に物理の刻み・AI探索・catch/OUT・記録比較を省略しない。既存の101試合ツールは同Hostをimportするが、fixture選手/指示/旧保持bundleのため現在のTBD/LAD校正を実施した証拠とはならない。

一名のSol explorerへRNG/実時間/共有状態/Worker独立性の読取だけを依頼。rootはHost/高速UI/既存校正入口と実測を担当。共有checkoutの他者編集を戻さず、製品Source/依存/既存JSON/HTML/APIを変更しない。証拠・新監査harness・報告だけを追加する。

監査対象Core: `5b8aae080ef0fc600f171653ce5aa5315a181d50b8b38bb0e136c26459603912` / Native175。v120性能1件未達と感情NOT_CONNECTEDは本監査で解消扱いにしない。新規大量実行や結果省略の実装は今回の調査scopeへ拡張しない。

検証方針: 同Core/同入力/同command列で、有限prefixに実接触・守備を含める。全recordの数値/符号付き0を保持したdigestと、事実/裁定/時刻/記録を比較する。使用runtime・入力hash・clip/Source pinを固定し、経過msや完了順を試合結果として比較しない。比較不一致は原結果を保存し、差を隠す丸め・診断の一括除外・結果改変をしない。

復旧: 新しい監査folder/harnessだけを使う。元v119/v120候補を開く操作で元の製品へ戻れる。Source/HTMLのcommit/push/merge/deployは行わず、判断要約のみ既存PRへの記録対象とする。

## 調査結果と判断

通常1x/高速UI/同Chrome描画なしは同じ12球（実守備4件）の全record一致、独立Worker2本の同入力対照は各8球（実守備2件）一致。Node同環境の各球capture/resumeも8球一致 `cdc0eebc`。一方総合 `3bc17792` はNode比較でFAIL、同引数の第1球 `a270df74` /第5球 `a669cdec` も厳密不一致を保存した。12球のrules/H-E/after/ticksは一致、factsは第10球でdiff。入力transport一致のため、設定転送時の丸めと切り分け済み。

Node24.19.0とHeadlessChrome155で `Math.sin(2.5)` の末尾が相違。第1球の181数値/max3.89e-16、第5球の1360数値/max3.55e-15には姿勢・走者位置・照準等が含まれる。全seedの裁定差や統計の偏りは未実証。既存の21–91は独立した校正課題として保持する。

Ruling: まず同じbrowser build/Core/入力/commandによる描画OFFの同値gateを設け、100件以上を有界poolへ投入する方針を推奨する。NodeをChromeの無条件の完全同値計算器と扱わない。別runtimeの採用は実行環境固定または数値実装契約/再現試験を別途検討する。今回100試合は実行せず、worker数の増加による速度保証もしない。

追加検証でseedの2^32別名とconfiguration hashを持たないcontinuationの受入れを確認した。現UI内の取違えを示すものではないが、将来poolでは一意uint32 seed・job ID/全入力hash/revisionをbindし、可変状態と探索予算付きmemoを試合/プレイごとに分離する必要がある。Source入力175件と候補9fileの無変更・全監査証拠の整合 `25c95fe3` PASSは資料の検証であり、Node↔Chrome同値や100試合合格へ昇格しない。

技術報告: `docs/verification/fast-match-parity-2026-10-26/AUDIT.md` / `SUMMARY.json`。製品Source/HTML/API/能力/依存は変更なし。前回v120 RESULTSへruntime証拠の範囲だけ追記する。FAIL/未検証を保持し、前回v120の未完了を消さない。

既存公開Draft PR380（repoとhead90dba70bを実確認）のissuecomment6400613035へ判断要約だけを投稿、本文readback一致。ローカルの51MB設定/全record/私的パス等は投稿しない。調査の結論を記録したが、100試合機構の実装や別runtimeの互換合格へ昇格していない。
