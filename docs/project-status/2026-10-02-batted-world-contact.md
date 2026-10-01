# 打球の World 接触 — 2026-10-02

## 実装

- 元の Native BatBallContact／打球 flight から最初の接地、選手の球形 primitive、有限の垂直球場面への接触を計算する。同じ tick の接触を保持する。
- 実際の９守備者と選択済み打者を Player／Person／試合／会場／日付に照合する。形状は明示された Source、守備者の位置・速度は元の World、打者の身体 anchor は元の swing grip と明示された身体相対較正から得る。
- 同じ試合のモデルを凍結し、控えを含むモデル対象者全員の登録・Person 証拠を保存する。計算対象は実際の10人、各５ primitive。空中の未接触区間だけ、同じモデル・運動条件で延長できる。
- SQLite 内の元 Source、SQL mirror、hash、順序を書き込み前後・再試行時に確認する。後日の正当な回復履歴追加後も元の接触記録を再読込できる。
- 先行接触のない sole ground 接触だけ、既存の canonical 物理 timeline adapter に接続する。球場面・選手への先行接触がある場合、予測接地を記録しない。

## 検証

- 接触・Native 保存・WAL・collision API・独立レビュー再現: 5 files / 49 tests GREEN。うち６レビュー用 scratch tests は公開対象外。
- 型検査 GREEN。独立レビューの Critical／Important 指摘なし。
- 全体検証 `npm run verify -- -- --maxWorkers=2 --minWorkers=1` は exit 0、563 files / 3,368 tests GREEN（2,803.28秒）。公開対象の Source は556 files / 3,346 tests、公開対象外の７レビュー用 scratch files は22 tests。型検査もこの gate 内で通過した。Windows の空き仮想メモリ低下による worker spawn エラーを避けるため、worker 数を制限した。
- 初回の全体検証は C: の容量不足で既存 WBC テストが `database or disk is full` となった。自身の失敗済み検証プロセスだけを停止し、プロセス内の `TMP`／`TEMP` を空き容量のある K: の専用ディレクトリへ指定して全体 gate を再実行し、成功した。恒久設定は変更していない。
- ユーザーの不要成果物削除依頼に基づき、テストコードの `mkdtempSync` prefix と一致する過去の一時 SQLite ディレクトリを計1,569個、1,583,019,792 bytes 削除した（初回1,401個、追加168個）。１時間以内の更新、未知のファイル、reparse point、使用中ファイルがあるディレクトリは除外した。２回分の削除記録、Source・作業差分・再開記録は保持している。追加の旧レビュー DB 削除は自動承認レビューの `blocked by policy` により実行していない。
- ベース PR #243 の P0 CI は再実行で成功、SHA `260eeef2f598ce040a358cbc512a45bfc5118139` を確認済み。

## 残る作業

球場面・身体・グラブ接触後の継続、捕球／落球、フェア／ファウル、転がる球の pickup、送球・走者・公式終了への実 Source 接続を続ける。既存の no-pre-pitch-runner 範囲を超える場合、走者の身体 Source を揃える必要がある。新しい production 数値は補っていない。

デザイン・UI・Presentation 接続と PR merge は行っていない。非デザイン系の全体計画は未完了。
