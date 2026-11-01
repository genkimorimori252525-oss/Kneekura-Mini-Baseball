# 高速debug基盤Aの受入と検証順

2026-10-27 JST。今回の元依頼は、高速で本番相当の検証を行い、合理的な順序でメーカー/心理/キレ/回転計画を実装すること。通常の実行順の判断を承認の取り直しへ置き換えず記録する。

最新Core199inputs/Chrome156で12球・4実接触/守備の5経路full-recordが一致。5球後checkpointを保存し、6球目だけの復元/CPU計測も元通常recordに一致した。別設定・別命令履歴・古い連番・payload/Source/runtimeの取り違え拒否を工具側で検証。これはlocal debugでありNative認証ではない。

Task1の基盤AをTask2〜5の検証に使用する。残りBの複数seed・有界poolの枠比較・9回・性能受入は、Task5の後/最終配送前の独立工程へ移す。未完を削除せず、Source変更前後に長い通常再生を繰り返す重複を減らす。全goalの達成条件は不変。6球目H/E比較が約20秒という速度課題は未解消、元Node OOM/Node↔Chrome差/180秒未達も保持。

根拠: `docs/verification/realism-debug-20261027/FAST-DEBUG-RESULTS.md`、計画の実行順改訂。復旧は基盤A/残りBの順序記録だけを戻す。Core/公開保存形式/生成HTMLはこの判断で変更しない。
