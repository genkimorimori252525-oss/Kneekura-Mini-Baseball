# 現在の非デザイン統合: 初回354件の固定Source結果

更新: 2026-10-06 15:52:01 UTC。**現在Sourceの32 complete files / 354件、catalog、full compilerが通過した。全体検証と残実装計画は未完了。**

検証したSourceは `10934028ff85b00b38b37142dfeda45b9e3c0814`、full treeは `b065b4e29ce70ba931f17cd95c4de8405788e6da`、src treeは `f02849963df3fca3c32b9c411b9d53c590d59575`。この文書と証拠保存用の追加ファイルは検証後の文書変更であり、実行Sourceには含まれない。

初回 `first-union354` はcatalog、full compiler、32個のテストファイルをそれぞれ完了させ、34段すべて `passed`、354 PASS / 0 FAIL / 0 SKIPを記録した。所要666.378945秒、上限1,200秒。最終terminalとledgerの対応、各receiptとその198個の参照artifact hash、全case名・assertion・hook結果を独立に照合した。実行coordinatorはexit 0と全所有processの回収を確認し、terminalもSource/dependencies/controls不変と空の残processを記録する。

- [閉じたterminal](../verification/current-union354-2026-10-06/batches/first-union354/terminal.json): SHA-256 `3f641e2e04be5f68d4682f722aef7d9ab9756bbc0ea4d726fd4c725a33bef064`
- [対応するledger](../verification/current-union354-2026-10-06/ledger-first-union354.json): SHA-256 `0b74305b3c363104c1c1220dfb127ecafc3ea46ba2910f8d0260ddc98c4d5a01`
- [32ファイルの件数とreceipt一覧](../verification/current-union354-2026-10-06/completed-source-files.json)、[保存範囲と復旧条件](../verification/current-union354-2026-10-06/README.md)

この統合はPR337相当のlocal `60290349b7847a952d4db3ccc4344445c1c0d9a6`から、prospective batting stance、runner policy/view、main-only runner read boundary、foul runtime registration/admissionを接続したもの。Authorのstance158件、runner62件、foul84件は各author Sourceの結果として従来どおり保持する。今回354件はそれらの数字の合算ではなく、固定した現在Source上でcomplete filesを新たに実行した結果。

現在の名前inventoryは946 src files / 7,479 casesで、そのうち9件が既定でoptional artifact cases。Collectionはcase発見であり、通過数ではない。今回のledgerは914 src filesと15 Node files、5 Python filesの計934段を `pending` のまま保持する。残るsrc casesは7,125件（普通7,116件とoptional 9件）。別captureで通過したNode 15 files / 1,634件は同じSourceの独立結果だが、ledgerへのcredit移転はなく、このcheckpointでNode段を通過に変更しない。

Controllerの別qualificationは旧22 PASS / 意図した2 FAIL、新24 PASS。これは検証controllerの確認であり、application件数ではない。保存したterminal/result pairと元control hashesで区別する。

`wholeDefaultSuitePassed` と `physicalArtifactCasesExecuted` はともにfalse。普通の重いPositive、32-piece Integrity、mixed-motor、残る一般foul経路、optional artifact検証、whole回帰は未完了のまま。今回の統合はprospective batting release/sensing、runner semantic capture/選択/motor/settlement、physical foul end、公式適用/reset/resume、一般自律行動や残計画全体の完成を意味しない。別SourceのPR338 role証拠と未完next-TAKEも今回へ合算しない。

[旧stance/runner統合記録](2026-10-06-stance-runner-current-integration.md)と[旧foul/runner統合記録](2026-10-06-foul-runner-integration-pending.md)の「現在検証は未実行」は各作成時点の記録。初回complete-file検証の最新状態は本文書が置き換える。[既存残計画](2026-10-05-nonvisual-remaining-matrix.md)の実装範囲と未完境界は維持する。

この保存にはDB、domain row/snapshot、未承認のraw physical artifactを追加しない。実行済みのreceiptが参照する小さなテスト出力とprocess/resource metadataは、全内容を照合して元のhashのまま保存する。これにより結果要約だけでなく、次の同一Source batchが要求するpredecessor evidenceも保持する。公開用checkout自体をruntime checkoutとして起動したり、保存だけで次batchの実行を承認したりするものではない。
