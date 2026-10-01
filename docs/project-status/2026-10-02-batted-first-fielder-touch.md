# 実際の最初の野手接触 — 2026-10-02

## 実装

- 元の canonical `BatBallContact` と完全な World 物理 Source を照合し、最初の接触を再計算する。呼出元の接触結果や「先行接触なし」フラグを判定証拠に使わない。
- 実際の守備者への sole contact なら、グラブ・身体・手・両足について元の球位置と半径から first-fielder-touch 証拠を記録し、既存のフェア／ファウル規則へ渡す。捕球・所持・OUT・得点・終了は含意しない。ファウル側は捕球未確定の pending、フェアは live とする。
- 空中・接地・球場面・打者・同時複数接触は理由を持つ unresolved として保持する。接地の既存 canonical 証拠も保持する。
- SQLite の共有 own-connection reader で元の Player／Person／モデル／flight／World 接触 Source を再導出し、判定 Source と証拠を保存する。書込み前後・再試行時の原本照合、現在の World head と flight 全 prefix、Match／workload fence を検証する。
- 空中から次の実接触へ進んだ後や後日の正当な回復履歴追加後も、元の保存記録を再読込できる。公開 Store の close 検証は維持する。

## 検証

- Core・Native 保存・disk WAL・既存 World 接触・独立レビュー再現: 6 files / 72 tests GREEN。うち独立レビュー用 scratch は1 file / 1 test、公開対象外。
- 型検査 GREEN。独立レビューの Important 指摘１件（別の打球証拠との取り違え）は、tracked 再現 RED → 元接触 binding／再計算 → GREEN。その他の Critical／Important／Minor 指摘なし。
- 全体検証 `npm run verify -- -- --maxWorkers=2 --minWorkers=1`: exit 0、567 files / 3,414 tests GREEN、3,263.01秒。公開対象の Source は559 files / 3,391 tests、公開対象外の８レビュー用 scratch files は23 tests。型検査も gate 内で通過した。
- C: 容量不足を避け、プロセス内の `TMP`／`TEMP` を K: の専用ディレクトリへ指定した。Source は全体検証中に変更していない。恒久設定は変更していない。
- ベース PR #244 の P0 run `36911934869` は C: の SQLite full／I/O エラーで４テスト失敗、552 files 通過だった。CI の一時データを確認済みの K: 上の `RUNNER_TEMP` に置く設定差分を用意したが、設定ファイル変更の確認待ちのため適用していない。

## 残る作業

実際の捕球保持／落球、球場面・身体反射とその後の球運動、転がる球の pickup、送球、走者、foul の次投球 replay、公式終了の実 Source 接続を続ける。デザイン・UI・Presentation へ接続せず、PR merge は行わない。非デザイン系の全体目標は未完了。
