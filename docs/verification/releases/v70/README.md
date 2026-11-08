# メーカーv70 検証索引

[機能・操作](../../../demos/releases/v70/README.md) / [設計・限界](../../../reports/2026-10-19-v70-batter-comparison.md)

最終結果は [実ブラウザー記録](maker/maker-check.json)、[配布照合](release-check.json) に保存した。1200／390幅で19.030秒PASS。通常rendererの独立4層合成・再描画とcamera/controller一致、左右・カーブ・接触／空振り／見逃し、捕球後非表示、切替・巻戻し、実右ドラッグ・リセット、JSON・20選手の不変、例外・外部通信0を確認した。時計を固定した同一描画間隔内でも捕球と打球への即時切替が成立する。Maker82・Native115入力と旧188配布ファイルを照合した。関連コマンドの原receipt／ログは下表を参照する。通常試合・調整室・物理Coreを更新する変更ではない。

## 原FAILと原因

初回の親画面と子画面の合成SHA不一致は、子だけに登録した専用フォント `Kneekura JP` を親canvasへ直接描いたためだった。差分3446pixelsは名前の帯に限定され、同じ親documentのcanvas同士は差0だった。子のcanvasで名前を含む全レイヤーを合成し、完成画像を親へ転送するように修正した。初期フォントの読込とresize描画が落ち着いてから比較を開始する。

次の試行では親画面・製品の合成・QA独立4層合成は一致した。通常rendererを再度描く追加照合で差があり、field／bat／ballの生レイヤー、名前のrects、カメラとHostは同一だった。逐次readbackでGPU／software 2Dが切り替わる試験条件が原因だった。起動時からsoftware 2Dに固定し、許容差を増やさず全画素exactを確認した。見逃し設定を変更する試験の初回は詳細欄を開いておらずtimeoutしたため、試験手順のみ訂正した。製品不具合と混同しない。原FAILは後続結果で上書きしない。

比較は打席からの研究用表示で、守備・走塁・壁・公式採点を実行しない。PCと狭幅のブラウザー検証を実機スマートフォンの保証へ外挿しない。元全計画・未達・全FAIL／UNKNOWN／Charter HOLDは継続する。

## 実コマンドreceipt

| task / receipt | 結果 | 秒 |
|---|---|---:|

| [BUILD b43123eb](../../../ai-continuity/verification-receipts/MB-20261019-V70-BUILD_b43123eb487d423c97e7ffebe3ded4df.json) | PASS | 2.218 |
| [MAKER-BROWSER 306b8132](../../../ai-continuity/verification-receipts/MB-20261019-V70-MAKER-BROWSER_306b8132c9824b1b9dd5ade0dc542df8.json) | FAIL | 5.0 |
| [FINAL-BUILD acc15cfc](../../../ai-continuity/verification-receipts/MB-20261019-V70-FINAL-BUILD_acc15cfc591a4844a58f5d885c129601.json) | PASS | 2.311 |
| [MAKER-BROWSER 0af23e1c](../../../ai-continuity/verification-receipts/MB-20261019-V70-MAKER-BROWSER_0af23e1c5277483ab7986f5eac794378.json) | FAIL | 4.827 |
| [BOUNDARY-BUILD 55f2dc18](../../../ai-continuity/verification-receipts/MB-20261019-V70-BOUNDARY-BUILD_55f2dc183f8f414f80275fe6ff7b472b.json) | PASS | 2.39 |
| [MAKER-BROWSER 88aa2d6e](../../../ai-continuity/verification-receipts/MB-20261019-V70-MAKER-BROWSER_88aa2d6ea94647df83a6a9639e843e21.json) | FAIL | 4.875 |
| [MAKER-BROWSER 812a2777](../../../ai-continuity/verification-receipts/MB-20261019-V70-MAKER-BROWSER_812a27770162418ea1f7852274581eeb.json) | FAIL | 4.703 |
| [MAKER-BROWSER 2105aeec](../../../ai-continuity/verification-receipts/MB-20261019-V70-MAKER-BROWSER_2105aeec92534cbfafb373b40800ce06.json) | FAIL | 16.485 |
| [MAKER-BROWSER 3594f6cd](../../../ai-continuity/verification-receipts/MB-20261019-V70-MAKER-BROWSER_3594f6cdc25e49ddaf4b3e713fbcd3c9.json) | PASS | 18.109 |
| [PACKAGE e04e4afc](../../../ai-continuity/verification-receipts/MB-20261019-V70-PACKAGE_e04e4afcf5ce48ee945e6d1f9a362d37.json) | PASS | 1.61 |
| [MAKER-BROWSER e2b697a4](../../../ai-continuity/verification-receipts/MB-20261019-V70-MAKER-BROWSER_e2b697a45db740319a86c6c3b2a64949.json) | PASS | 18.389 |
| [RESPONSIVE-BUILD 0d1a388f](../../../ai-continuity/verification-receipts/MB-20261019-V70-RESPONSIVE-BUILD_0d1a388f5ce74281a3d06fdef91be9f5.json) | PASS | 2.343 |
| [RESPONSIVE-BROWSER aea1d810](../../../ai-continuity/verification-receipts/MB-20261019-V70-RESPONSIVE-BROWSER_aea1d810e74e42de8029c27931e022bf.json) | PASS | 19.03 |
| [FINAL-PACKAGE e1e50f53](../../../ai-continuity/verification-receipts/MB-20261019-V70-FINAL-PACKAGE_e1e50f53410b4f2f94dc685e5546a91a.json) | PASS | 1.531 |

公開製品コミット `28b1eb87b63cff296d48eb0eb224249a480c43ed` を既存Draft PR #380へ保存。[公開照合](publication.json)でremote／PR headと公開raw9ファイルの実byte一致を確認した。記録だけの後続コミットで製品を変更しない。

- [MB-20261019-V70-STAGING 8d537a10](../../../ai-continuity/verification-receipts/MB-20261019-V70-STAGING_8d537a10e5dd40e0af7807ce88bb316d.json): PASS 1.406秒。
- [MB-20261019-V70-PUBLICATION 7aed3f1d](../../../ai-continuity/verification-receipts/MB-20261019-V70-PUBLICATION_7aed3f1d3e4b4b19903ebf8f16a227f6.json): PASS 51.265秒。
