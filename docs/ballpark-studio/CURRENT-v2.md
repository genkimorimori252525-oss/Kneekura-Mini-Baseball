# 球場設計室 v2 — 継続記録

2026-10-24 JST / `MB-20261024-BALLPARK-STUDIO-2` / 完了（設計室のscope）。

## 人間指示・判断

本人の直接指示に基づき、前turnで生成した外観/内観画像を球場設計室で再現した。赤・青・金、12万人想定、開閉式ドーム、右翼105m・中堅128m、低いフェンス。左翼105mと壁高1.3mは未指定のため仮値とし、commentary/UI/READMEへ明記して編集可能にした。PLAN-v2が対象・影響・復旧・検証の判断記録。

変更範囲は専用tools/ballpark-studio、docs/ballpark-studio、新規v2 HTMLと初期JSON。src、dist、通常HTML、メーカー、他chatのV115 CURRENTは変更していない。共通CCGには固有task-IDの実行receiptを保存し、他taskのCURRENTを上書きしない。

## 成果物

- `outputs/球場設計室_v2_開閉式ドーム.html`、43,909,487 bytes。
- SHA-256 `28ffd3131c28dbbebbbc4b29a0240b3fcae8af0691101141b5be705ee11dbe31`。
- `outputs/球場構想_v1/球場設計_ドーム_v2.json`、`docs/ballpark-studio/examples/russian-dome-v2.json`。
- 元V114 SHA `c6f32e13eb34a3545a178b1d40db92d58ac794732d224af5ad97b37133d77a71`、元設計室v1 SHA `0b97ab18f3639b2f086405e3574ff47cec9954780af58c2aa379aa3ceeb48a20` を実Chrome検査で読戻し確認。
- 内包Core SHA `3d0ef3a2477816a3157e59f9a8235e1459913fa35f74f791541c8cee8e885a37`。元Core不変、コピーrendererだけ変更、パッチの完全逆変換をbuildで確認。

5層24列の観客席、金の通路・トラス、狼の幾何意匠、世界座標で左右へスライドする2枚の銀色屋根。定員120,000は設計値、17,280光点が観客群を表す。全景カメラ追加、従来5視点維持。開度・色・定員・寸法編集、断面表示、局所エラー、取消/やり直し・JSON/ブラウザ保存・AI inspectを接続した。通常試合のCore/判定には未接続。

## 実検証

receipt位置: `docs/ai-continuity/verification-receipts/MB-20261024-BALLPARK-STUDIO-2_<id>.json`。

| 検査 | 結果 / receipt ID末尾 |
|---|---|
| 最終unit、geometry/旧JSON/屋根座標/容量上限/格子欠け回帰の15 tests | PASS `0b2d0f295f9643108a9b1f0b10f95eee` |
| 最終build dome-lattice | PASS `05bf113fe36549098cb4c7ff8184f0e0` |
| 最終実Chrome dome-lattice-final | PASS `e608f82a4eec4d90b8d3e9490616490f` |
| 閉屋根の独立ray/triangle検査 | PASS `d395fd82191c4e00a1732cbf977e6925` |
| 従来の編集・追加点削除・図drag・JSONのv2回帰 | PASS `ef898a1acee84ddc9b36275385d49e85` |
| ドーム初期JSONのCLI | PASS `d827b629f56342608cc7fdace4b01e2b` |

最終実Chromeでは指定寸法・固定内野不変、開閉と取消/やり直し、色変更、容量エラー近傍表示・最後の有効描画保持、同じカメラでの連続外周編集、旧v1の建築なし読込、元rendererとの基準画素一致、JSONダウンロード/読込、保存再起動、6視点/右drag、idle再描画なし、1280/390/320px横溢れなし、外部HTTPなし・JS例外なしを確認。実機スマホ/Safari検証やFPS目標達成の証拠ではない。

閉屋根の検査は1,367の検査対象光点について、屋根に遮られるのに残るセル0を確認。全ての物体/全てのカメラ/任意屋根形状に対する数学的完全証明という意味ではない。実画像も `evidence/dome-lattice-final/` を目視確認した。

## 不具合と検証限界の保持

- v1のpark cacheは独自外周がkeyに含まれず、同じカメラで編集を続けると前の画像が残る可能性があった。外周値のboundaryKeyと建築の有無をkeyへ加えた。RFを110→115mと続けて変えて各画像更新を回帰確認。色/開度変更時は外周keyを維持。
- 初回/継ぎ目調整後のChrome検査はPASSだが、閉じた屋根の一部に観客席色が抜けていた。原因は `y += 10/3` 等の小数加算が上限を超えて三角形の端の行を落とすこと。既存V84 `grid.range()` の整数index走査へ修正。端のセル回帰testを追加し、独立ray検査の漏れ269→0を確認。初期PASS報告を遮蔽修正の証拠へ昇格しない。
- 深度調査の途中で、漏れが減った後も3件目を参照したデバッグscriptがTypeErrorで終了した（通常tool出力に原エラー保持）。検査側を空/少数リストでも集計できる形へ直し、漏れ0の明示assertと証拠JSON/receiptを取得。製品の例外ではない。
- v1の過去FAIL/BLOCKED/UNKNOWNと他taskの未解決は `CURRENT.md` / 共通原記録に保持。このtaskのPASSで解消扱いにしない。

## 未実装・次の境界

`DESIGN_ONLY_NOT_MATCH_CORE_ADMITTED`。通常試合の壁/屋根衝突・守備経路・HR裁定・グラウンドルール・フェンス越え捕球への接続は未実装。低い壁だけでHRキャッチの成功を保証しない。球場建築の構造/防災認可も対象外。次は単一geometryの版付きCore admission、旧円形互換、描画と衝突/予測/裁定の一致を計画してから接続する。

操作・再生成・APIはREADME-v2。復旧はv1または元V114を開く。v2保存領域は別でv1を上書きしない。ソース/HTMLのGitHub commit/push/merge/deployは行っていない。
