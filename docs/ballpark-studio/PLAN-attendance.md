# 無観客と満員

2026-10-24 / MB-20261024-BALLPARK-ATTENDANCE。

本人の直接指示: 客のいない場所は元の座席色を表示し、無観客試合/満員試合を切り替える。既存rendererは群衆OFFで元のstand materialへ戻るのでその経路を再利用する。

プレビュー下に「満員/無観客」の選択を置き、optionalなarchitecture.crowd.attendance=full/emptyとして保存/履歴へ接続。旧JSONの欠落時はfullで、自動追記しない。無観客は群衆/LED/animationを止めて元の赤青座席を表示。満員へ戻すと以前の群衆色/発光/7コマを使う。ロゴ・球場形状・Coreは変更しない。表示だけの一時API非表示は従来どおり保存とは分離。

検証: modeのvalidator/旧JSON、無観客の座席画素一致、満員復帰の画像一致、LED0とtimer停止、ロゴ不変、undo/redo/JSONとブラウザ保存再読込、既存群衆/球場/モバイル。変更前HTMLを保存して復旧可能にし、専用CURRENT/receiptと既存PR380へ判断を記録する。
