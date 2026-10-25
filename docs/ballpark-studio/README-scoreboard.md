# タンボフ中央スコアボード

2026-10-25: 本人が球場全体の完成を確認。芝生ロゴ0.8倍を採用。最新成果物は [CURRENT-accepted.md](CURRENT-accepted.md)。

2026-10-24 / MB-20261024-BALLPARK-SCOREBOARD。本人が承認した [イメージ](references/scoreboard-approved-v1.png) を、専用球場設計室の立体/素材として実装。現在の成果物と検証は [CURRENT-scoreboard.md](CURRENT-scoreboard.md)。

視点の「スコアボード」で正面寄りに確認できる。球場全景/スタンドから/外観等の既存視点でも同じ世界座標の面を描く。金色の枠/背面/側板/支柱、赤青の側部、上部のオオカミ、紺色の横長LED表示を組み合わせる。小さい観客席構成では屋根内へ収まるよう全体を縮尺調整する。内野/白線/芝生ロゴ/PNG/Coreは固定。

「スコアボード（表示見本）」で、表示ON/OFF、チーム名、1〜9回の得点、H/E、BSO、球速を編集する。空の回は未入力として空欄表示。Rは各回の和から自動計算する。これは設計用の見本で、実試合の現在値/公式成績へ接続したものではない。初期値は承認画像に沿う架空の表示例。ロゴOFFと表示盤OFFは独立。表示盤をOFFにしても中央の狼を残し、カメラは飛ばさない。

optionalな `architecture.scoreboard` に保存。旧JSONの欠落時は見本を表示し、保存データへ勝手に追記しない。schema versionは変更しない。入力エラー時は原因sectionに表示して直前の有効表示を保持し、保存を止める。undo/redo/JSON/明示的なブラウザ保存へ接続。

## 描画の入口

- `scoreboard.mjs`: defaultScoreboard/validateScoreboard/runs と表示素材。Canvas2Dで文字/罫線/BSOを一度だけ素材へ描き、mipmap化してUV sampleする。このCanvasを画面へ重ねない。
- `stadium-mesh.mjs`: 不透明な筐体の厚み/支柱/ロゴと文字面、shared depth/透視補正UV/局所円形光点。scoreboard materialとscoreboard-title materialを同じ枠内で使う。
- `geometry-window.mjs:scoreboardTarget` / `preview-bridge.js`: geometryから確認カメラを決め、編集/縮尺/表示ON/OFFで安定させる。
- `architecture.mjs` / `studio.mjs/html/css`: optional設定、検証、編集、履歴/保存。

中央の看板は席と干渉しない位置に置く。文字を読みやすくする処理は素材側の文字幅/coverage/発光に限定し、屋根や客席の深度を無視して浮かせない。追加の将来素材も [STADIUM-AUTHORING.md](STADIUM-AUTHORING.md) の流れで導入する。

## ロゴ遠近の改訂

本人が前段の減光を強すぎると指摘したため、壁面ロゴはdistanceに応じたopacity/contrast低下を廃止。contrast=1、brightness=1.45、glow=.08を保持し、distanceによるfilter footprintの増分は最大15%だけにする。投影サイズ/傾きで密度を変えるが、遠景でも十分なsamplesを確保する。2〜8は局所密度の上限で、元PNG/芝生sampleは変更しない。

この数値は新しい暫定値であり、唯一の正解とはしない。ただし「遠くではロゴを消さず、少しぼやける程度」という最新の本人指示を、旧の深度減光案に戻して破らない。近遠/斜め/全視点の画像で改善を評価する。

通常試合への新球場の衝突/守備/HR/公式結果/スコア連動は別工程。設計室の機能を実試合へ導入済みと扱わない。
