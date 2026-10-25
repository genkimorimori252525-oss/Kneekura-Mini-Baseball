# 球場の立体構造 checkpoint

2026-10-24 JST / MB-20261024-BALLPARK-ARCHITECTURE / IMPLEMENTED_AND_VERIFIED（設計室のみ）。本人の外観確認は未取得。原指示/判断は [PLAN-architecture-v4.md](PLAN-architecture-v4.md)、再利用入口は [README-architecture.md](README-architecture.md)。

## 結果と根拠

本人が外観/内観の参照を提示し、視点切替でも品質を保つ構造と、芝生以外の狼/繊細な部分への同技術の使用を直接指定した。このscope内の改修を実行。外装/階間がない薄い構造と、開いた屋根の張出しが主因。単なるカメラ変更では解消しないので、全周の外壁・赤青金の装飾・基壇/階段・客席前壁/歩廊・曲面屋根/トラスを接続。元の1,920群衆quad/固定内野/芝生素材/PNG/Coreは保持。

非芝生の手描き代替狼を撤去し、承認済みPNGをUV素材合成→局所光点で描く。周囲の看板面も同じ格子。外装装飾もUV素材経路。精密点は投影三角形の局所索引で遮蔽し、共有world depthとdotを通す。外観/スタンドからを加え8視点。建築の細部にロゴ/装飾toggleと2〜8倍、optionalなdetailsを保存/履歴/旧JSONfallbackへ接続。

最終HTML: outputs/球場設計室_v3_局所密度版.html / 45,829,635 bytes / SHA `65940c5fd59397689ed25c99e76fc4df081c25dfba2d09ed549f9b896f0a6af0`。
復旧用: outputs/球場設計室_v3_立体構造改修前.html / SHA `82f83110a3b09a33ce637795045a29ee1d092e76b048dff88b7f3d553dc82344`。元V114/v1/v2とその証跡も保存。

## 検証

task-ID付き全receipt/log SHAの索引は [architecture-receipts.json](evidence/architecture-receipts.json)。技術PASSは本人の造形承認へ昇格させない。

- unit35/35 PASS `55dcf296b7234fd7a40d99d7387c604e`。屋根の角の外形内収容、旧JSON/厳格入力、固定geometry/群衆/芝生素材も含む。
- 最終build a8 PASS `0a34e96e199a4b688c2e1a4459766e8e`、19 SHA読戻し PASS `d74e469bb917433cb80efb87c4b668fa`。Core不変、変更はコピーのrenderer script1つ、完全逆変換、構文、15入力/元V114/v1/v2/製品SHA。
- 最終8視点/自由回転/素材toggle/独立密度/保存再読込/旧JSON無追記/満員と空席/390・320幅 Chrome PASS `88527e7820da404fa02d6ceaabe7b937`。evidence/architecture-architecture-a8/report.json。開閉・外観・内観・orbitの精密点 2888 samplesを独立world ray/triangleで検査、漏れ0。承認済み芝生cropは改修前HTMLと完全画素一致。画像を目視済み。
- a7で6視点/編集全般 PASS `08e9255cc0d544c6bbc6b81aaaff3281`、一般browserフロー PASS `94991d9fa68644499ff154d978ed30fc`、群衆再生 PASS `0a7793e796244b27b6590fcd8163af24`、従来外観調整 PASS `b72d8899c8e942c597fb133644c26332`、独立屋根深度 PASS `adf26187da1b43df994f6378686bd3d5`（1590赤色cellの漏れ0）。a8との差は追加したinteriorカメラのf/cyのみで、a8の8視点検証で再確認。
- a8の無観客保存/復帰/元座席material/履歴/モバイル PASS `8012ee02853e48ae9cd97275a19f1554`。群衆の発光/占有率/屋根/保存と旧芝生一致 PASS `130ea67e22e9475dbd60bb51f0edcb38`。
- 最終Chromeの設定変更から3画像cache生成完了まで143〜328ms（待機80ms・UI操作を含む1回の測定）。これはFPS/端末横断の性能保証ではない。idle/観客コマ送りでscene再構築0を確認。固定の世界全体を精密格子にしない。

## 原FAILとテスト変更

- `fd5339b8c7a94ffa8dcaa89f66c9c00f`: 旧屋根の開口>150m/特定画素depth253という固定期待。改修で屋根幅と曲面が変わったため、形に依存しない「葉の角が外形内に収まる」「投影した中央屋根が地面を隠す」へ変更。旧証跡は削除しない。
- `c37dc812a6c5497d8d0fd5d85a6d3249`: orbitの試験がほぼ真上から見て、屋根で細部が全遮蔽されたのにsample>0を要求した。製品の遮蔽漏れではない。試験の回転角を外装が見える高さに修正し、独立ray検査を成立させた。
- `9aaee078ee4c470da425b2e689455d11`: 増強した外形検査で全開葉の前角が約0.85m張り出す実装不備を検出。半幅を外形の前後端での最小幅×0.49から導くよう製品を修正。0/25/50/75/100%で角の収容をPASS。
- 旧check-attendance/tilesの旧HTML全景画素一致は、本人が指定した建築変更と両立しない。空席は同rendererの元座席material経路と一致、旧HTML比較は承認済み芝生領域の一致へ変更し、新建築で全景が変わることも明示的に検査。旧比較のPASSと原画像は履歴として保持。

## 次/未検証/所有

本人による新造形の確認が次。通常試合への壁/屋根衝突・守備・HR/ホームランキャッチ・公式イベント自動連動は未実装: **DESIGN_ONLY_NOT_MATCH_CORE_ADMITTED**。PC Chromeの幅変更であり実機スマホ/Safari認証ではない。極端な全設定組合せ/長時間実機性能/建築認可は未検証。

対象は専用tools/docs/生成HTMLのみ。他chatのsrc/dist/メーカー/V115/共通CCG CURRENTは編集しない。専用CURRENTと固有receiptでcheckpoint。既存PR380 commentに判断を集約し、commit/push/merge/deployを行わない。

最終監査 PASS `d9484c5ad6ea4791a203dc7590d2d247`。evidence/architecture-final-audit.json：製品/復旧hash、a7→a8の差がinteriorカメラを含むpreview-bridgeだけであること、回帰report、原FAIL3ログのSHA保持、初期JSON検証、GitHub既存commentとローカル本文の一致を確認。GitHub記録同期済み: https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/380#issuecomment-6375221684 。ソースcommit/push/merge/deployは未実行。UIの再表示依頼はqueuedであり、表示済みとは扱わない。
