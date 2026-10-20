# v66 スイングの頭の微動を走者追尾から分離

## 調査結果

人間の依頼は、v59寄りの打者視点とバットに引かれる微動を残しながら、v61と異なって見える走り出しを調査・改善すること。

v61／v63／v65の通常HTMLを同じ6投球コマンドで比較した。v61→v63の実走者の初動差は5打球で0.026〜0.380msで、接触予定時刻の差0.017〜0.350msに近い。v61→v62はCoreのリリース等も変わっているので、この比較を全物理の同一証明とはしない。v63とv65の6球はSource全体が厳密一致した。

同じv65の実打球をv61／v63の視点helperへ渡すと、微動を有効／無効にしてもカメラの位置は全時刻で一致した。実走者の開始時刻・移動を遅らせる処理はなかった。一方、スイングの微動を視線制御の角度目標へ加え、その姿勢をインパクト時の基準として保持していたため、振り終わった後の打球追尾にも角度の影響が残った。実例では走り出し付近で約2度、その140ms後にも約1.8度の差があった。

再現検証では通常HTMLで生成した18投球中8スイング（左3／右5、早振りカーブ5／遅振りカーブ1）を使用。v63の微動が振り終わり400〜800ms後に最大0.02881249rad残ることをRED試験で確認した。走者の遅延ではなく、視点の角度に残る補正として切り分けた。

## 修正

`live-camera-tuning-batter-view-v66.js` は、同じ身体位置・同じ時刻の1つの視点を維持し、基準となる視線制御へ微動を帰還させない。現在の観測バット軸の回転から小さな角度応答を計算し、最終的なyaw／pitchへ合成する。身体・走者・打球追尾の基準計算は微動なしの経路をそのまま使用する。

スイング中の応答は連続的に追従させ、登録された振り終わりから180msで角度・角速度が0になるよう五次曲線で収束させる。走者の世界位置や開始時刻を待たせず、別カメラへの切替も作らない。未来の打球・走者位置は使わず、実行済み観測prefixと打者自身の登録スイング時計だけを使用する。

初期の微動強度0.025と調整室の既存強度欄は維持。v59寄りの投球・打点注視、見逃しの同期、選球眼、HRの注視、投手視点、v65俯瞰の遠近差設定、全UIを継承する。新しい能力値・設定項目・依存は追加しない。物理、AI、走者、バット、裁定、4px格子、投球22ms／他55msは変更しない。

## 検証と限界

実行receiptは `docs/ai-continuity/verification-receipts/MB-20261019-V66-*`。原FAILを含めて保持する。

- RED63 `51c58aaa`: 上記の残留を実打球で再現して意図どおりFAIL。
- UNIT66最終 `05dbc6e0`: 1.329秒PASS。微動強度0.025／最大0.08の両方で身体・カメラ位置は基準と厳密一致。振り終わり400ms後の角度残留0、実走開始140ms後も全例0。インパクト微動は最大0.032974rad。v59／v61互換設定、見逃し・バント、未来データ遮断、seek／再生、Source非改変もPASS。
- 初回UNIT `d858fa94` は厳密な出力角速度2.5rad/sの検査でFAIL。調査すると、微動が既に0の時刻で、微動なしの従来基準自体も2.500533rad/sになる2区間があった。分数時刻の数値積分に由来する既存基準の小さな超過を今回変更しない。完全なFAILレポートを保存し、厳密2.5の達成とは主張しない。最終試験は「同じ区間の既存基準または2.5の大きい方を超える速度超過を新たに追加しない」という非退行条件で、追加超過0を確認した。
- 通常／調整室を1200px／390pxで操作し、同一6球のSource／実バット、微動の設定操作、v59比較、旧新JSON／session、表示エラー・外部通信なしを確認。
- 凍結v65からhelperと版表示だけを戻すと通常HTMLがbyte単位で完全一致する。球の表示計算、他視点、進行・AI・世界Coreはそのまま。Native114入力のraw SHA、同一Core、旧版成果物も照合する。

180msと頭の応答は表示上の作者設定であり、実測の頭部動作を再現したとの主張ではない。今回の変更を元の全計画、実機検証、100試合監査の完了とは扱わない。既存の微小な角速度超過、原FAIL／UNKNOWN、Charter未承認HOLD、ユーザーのAGENTS変更を保持する。

詳細は [回帰試験](../verification/releases/v66/swing-running/swing-running-check.json)、[残留の原RED](../verification/releases/v66/runner-red/swing-running-check.json)、[既存角速度の原FAIL](../verification/releases/v66/swing-running/swing-running-check-failure-inherited-base-rate.json)、[配布照合](../verification/releases/v66/release-check.json)。

## 実行記録

- MB-20261019-V66-BROWSER PASS、45.311秒。[receipt](../ai-continuity/verification-receipts/MB-20261019-V66-BROWSER_726038c3ab4341d9b836805cb385df7c.json)。
- MB-20261019-V66-BUILD PASS、0.139秒。[receipt](../ai-continuity/verification-receipts/MB-20261019-V66-BUILD_ddba5ad51ba54f3faa52901ab44a2229.json)。
- MB-20261019-V66-CADENCE PASS、8.687秒。[receipt](../ai-continuity/verification-receipts/MB-20261019-V66-CADENCE_328d5c939fb24c1ba7b29b7fc16f8a6f.json)。
- MB-20261019-V66-PACKAGE PASS、1.344秒。[receipt](../ai-continuity/verification-receipts/MB-20261019-V66-PACKAGE_a553dbda68fe4242b037205de534be9d.json)。
- MB-20261019-V66-RUNNER-RED FAIL、9.273秒。[receipt](../ai-continuity/verification-receipts/MB-20261019-V66-RUNNER-RED_51c58aaa3b5f455a88b76387e58c4d89.json)。
- MB-20261019-V66-RUNNER-UNIT PASS、1.329秒。[receipt](../ai-continuity/verification-receipts/MB-20261019-V66-RUNNER-UNIT_05dbc6e09be94ed09e887948d072e377.json)。
- MB-20261019-V66-RUNNER-UNIT FAIL、1.015秒。[receipt](../ai-continuity/verification-receipts/MB-20261019-V66-RUNNER-UNIT_d858fa94ff264cd290166f95f099b5e9.json)。

`ばせぼーるlv66_TBD_vs_LAD_スイングと走者視点の分離版.html` SHA `e6ff4a3924872ecbe3b0a5044cf102a5ac02ac45cb63cd771f122f3f04f34a3d`。

`カメラワーク調整室_v66.html` SHA `fbe3038d617f557e1b679dd5a67d67edb737f64fc88634455f30bbdb261aab79`。

[同一打球のhelper比較](../verification/releases/v66/cause-audit/audit-v66-helper.json)と[v61／v63／v65の通常実走比較](../verification/releases/v66/cause-audit/audit-v66-runner-source.json)も補助観測として保持する。実コマンドによるPASS／FAILは上のreceiptと区別する。

## GitHub保存

製品コミット `b687c2a85341231e2546bb5370d55fbc7c794f46` を既存ブランチ／OPEN Draft PR380へ保存。STAGING `01d1e2d6` と最終照合で54ファイルの試験済みraw byteがGit blobと一致し、credential pattern0、whitespace PASS、ユーザーのAGENTS除外。PUBLICATION `0fe429b9` PASS4.452秒でremote／PR headと公開raw12ファイルのbyte一致を確認。[公開証拠](../verification/releases/v66/publication.json)。後続コミットは記録のみで製品byteを変更せず、main未マージ。継続監査は従来のCHARTER_UNAPPROVED/HOLDであり、自動承認しない。
