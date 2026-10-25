# 球場設計室の継続記録

2026-10-25: 本人が球場デザイン完成を確認。最新は [CURRENT-accepted.md](CURRENT-accepted.md)。芝生ロゴの採用明るさは0.8倍。以下は前段の記録として保持する。

最新の専用記録は [CURRENT-scoreboard.md](CURRENT-scoreboard.md)、前段は [CURRENT-logo-lod.md](CURRENT-logo-lod.md)、前段は [CURRENT-architecture.md](CURRENT-architecture.md)、前段は [CURRENT-attendance.md](CURRENT-attendance.md)、前段は [CURRENT-crowd-tiles.md](CURRENT-crowd-tiles.md)、[CURRENT-visual-tuning.md](CURRENT-visual-tuning.md)、[CURRENT-crowd.md](CURRENT-crowd.md)、[CURRENT-v3.md](CURRENT-v3.md)。以下のv1記録・原FAIL・未接続境界は保持する。

2026-10-24 JST / `MB-20261024-BALLPARK-STUDIO-1`。

## 完了した範囲

現行描画を保つ独立した球場設計室v1を作成。5基準点・追加壁頂点・場所別壁高・ファウル側外周・外野土幅、設計図ドラッグ、5視点・右ドラッグ、取消/やり直し、JSON入出力・ブラウザ保存、人間/AIモード・CLI・API・検証を実装した。

成果物 `outputs/球場設計室_v1.html`（43,886,705 bytes）のSHA-256:
`0b97ab18f3639b2f086405e3574ff47cec9954780af58c2aa379aa3ceeb48a20`。

凍結入力V114 SHA:
`c6f32e13eb34a3545a178b1d40db92d58ac794732d224af5ad97b37133d77a71`。
内包Core SHA:
`3d0ef3a2477816a3157e59f9a8235e1459913fa35f74f791541c8cee8e885a37`。
ビルドは元V114不変・内包Core不変・コピー内のrenderer scriptだけ変更・パッチ完全逆変換を検査。通常HTML、src、メーカー、dist、V115の進行中CURRENTは本タスクで編集していない。

## 検証

| 検証 | 結果 / receipt末尾ID |
|---|---|
| modelの9 tests | PASS `7360dff90f264c32bb1fe8934fa2533f` |
| 最終製品ビルド inspect-api | PASS `9664d66e1572442db3b4245357f10783` |
| 初回実Chrome総合 | PASS `040881c9d0964250bce70a5cf3e11399` |
| ドラッグ・JSONダウンロードを追加した実Chrome総合 drag-visible | PASS `7d079085cf424b418cecbc7c62f081f1` |
| 左右対称例のCLI | PASS `c84ddf56599d402faa90acfa8ce717b3` |
| 現行円形基準のCLI | PASS `e9e5b7529d1249ab970ed9195c8c9e99` |

receipt: `docs/ai-continuity/verification-receipts/MB-20261024-BALLPARK-STUDIO-1_<id>.json`。

実Chromeでは現行rendererと設計室の基準画素が同一（PNG data URL SHA `262059187a44f825b7ba01e529a1f4c468f2d7f41d1e8fc65acae8906a856c21`）。同じ静止world・カメラを比較する検証であり、全時刻の試合画素一致という意味ではない。
固定形状、非対称距離・高い壁、局所エラーと入力保持、履歴、追加点削除、設計図ドラッグ、JSON拒否/入出力、保存再起動、5カメラ、右ドラッグ、idle再描画なし、1280/390/320pxの横溢れなし、元HTML不変、JS例外なし、外部HTTP要求なしを確認。
PC/スマホ幅の実Chrome確認であり、実機スマホ・Safari・全ブラウザの認証ではない。desktop/mobileの保存画像も `evidence/browser-drag-visible/` にある。

### 保持するFAILと解消

- model初回 `e16da2e1189b4fceba0efdbf5e6d1431`: 交点計算の99.99999999999997と100をテストが厳密比較した。テストを1e-10許容差に修正。生産計算は丸めず、9 tests PASSを確認。
- 拡張ブラウザ検査初回 `4747d9820ffb46a4a99cdf4bb67b2b57`: 設計図がviewport外なのにマウスを移動していた検査の不備。対象点へscrollIntoViewIfNeededを加え、実ドラッグで距離変更・固定部分維持・Undoを確認。製品コードの回避変更はしていない。元FAIL `evidence/browser-final/report.json` を保持。

## 未実装・次の工程

`DESIGN_ONLY_NOT_MATCH_CORE_ADMITTED`。通常試合の非対称壁衝突・守備到達/経路・HR裁定・音声・球場選択への接続は未実装。旧Coreは円形であるため、保存JSONをそのまま投入してはならない。

次に接続を行う場合は、単一geometryの共有契約・版付きadmission・旧円形互換・フェンス越え/壁反射/グラウンドルール・守備予測を具体化してから進める。試合の球場別物理/摩擦を今回の土色設定から推測しない。既存の未解決FAIL/BLOCKED/UNKNOWNは本タスクのPASSで解消扱いにしない。

人間指示の「現在のデザインを壊さない」「固定塁/線」「現実に沿った外野距離/高さ」を根拠に設計室を作成。別chatの試合修正と分離するため、共有CURRENTへcheckpointを上書きせず、この記録を継続入口とする。復旧・操作/API・規則・再生成はREADMEとPLAN参照。

判断記録は確認済みの既存PRへ投稿済み: https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/380#issuecomment-6373850404 。ソース/成果物をコミット・pushしたという意味ではない。最終読戻しで製品SHA・8入力SHA・元V114 SHAが検証済みビルドと一致した。Codexのブラウザ表示要求はqueued（表示完了は未確認）。
