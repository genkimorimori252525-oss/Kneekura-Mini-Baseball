# v68 検証索引

実装は [報告](../../../reports/2026-10-19-v68-measured-form-trajectory-maker.md)、配布は [3つのHTML](../../../demos/releases/v68/README.md) を参照する。

- 原資料: [全CSV・剛体・時刻・SHA監査](measured-library/README.md)。索引677試行／98人から673試行、各137標本。
- Core: 全673×4段階の連続サンプラー、区間端、剛体長、芯、速度上限、左右、0／省略の互換、実衝突／描画を検証。
- Host: 全カタログの有限入力、未知ID・逆の左右・記録外区間・getterの拒否。一般の100,000ノード制限を緩めずに接続。
- [通常HTML](game/game-check.json): 初期20選手不変、旧版同seed6球のSource／バット／裁定一致、新フォームと弾道3の実投球、320球・127接触・規定9回終了、PC／390px、labの新session再読・旧Core拒否、エラーと外部通信0。
- [メーカー](maker/maker-check.json): 1200／390px、初期20選手不変、全左右候補、追加661本の選択、元と4段階の560標本を独立Coreと照合。拒否入力の値復元・原子保存、実ファイルdownload／読込／再読、G〜S全境界、絶対選球眼、明るい表示、3canvas、横はみ出し・エラー・外部通信0。
- [説明UI](maker-help/help-fixture-check.json): 1000ms、フォーカス、実touch tap、47詳細項目、495選択肢を見出しへ混ぜないこと、値・output・既存handler・ARIA保持。
- [表示の更新間隔](cadence/cadence-check.json): 通常画面55ms／投球の球22msを継承。新Coreと両HTMLで確認。

Core最終追加後の対象試験は10PASS／1SKIP。SKIPは専用の実試合検証へ分けた9回試験であり、その実行を下の別receiptおよび通常HTMLの320球で確認する。以前の82件PASSを、後から変更した全Sourceに対する再実行とは表現しない。最終型検査も別receiptを残す。

## 原FAILの読み方

原FAILは削除しない。製品の問題と試験側の誤りを区別する。

- Core途中: 診断変数名の誤りと、厳密区間端／入力guard等の改修を記録。数値モデル・境界の最終検証は後続PASSを参照。
- 通常build初回: frozen HTMLの抽出・照合マーカーを修正した。最終buildのSource／HTMLは別SHAで固定。
- 説明fixture: tooltipの重なり・狭幅の枠幅を製品で修正。その後のoverlay残留はfixtureのケース分離を修正しただけで、製品byteは変更しない。
- 配布初回: メーカーmetadataのテンプレートSHAがCSS注入後の値を指していた。原テンプレートと描画用テンプレートのSHAを分けた。再build後のHTMLは最終試験のSHAと完全一致し、製品byteは変えていない。
- Maker最初のsmoke: Hostの修正中に古いbundle-input SHAと現在Sourceが一致せず、ブラウザー起動前に停止。最終Sourceで再buildして照合した。
- Maker本試験途中: 閉じた詳細欄の操作、手動changeの後に実フォーカス移動でnative changeが重複する試験手順を修正。後者が公開能力のDOMを再生成していた。実ユーザーと同じfill→Tabに直し、製品変更なしで選球眼90の絶対値・全リーグのS表示を確認した。

過去の全計画・全FAIL／UNKNOWN・Charter未承認HOLD、v66基準motorの分数時刻2.500533rad/sという既存超過は継承する。実測の生体力学校正・全100試合・実機検証の完了とはしない。

## コマンドreceipt

以下は実行時点のSourceと結果であり、後続変更への自動保証ではない。原ログは各receipt内のoutput_pathを参照する。

| task / receipt | 結果 | 秒 |
|---|---|---:|
| [LIBRARY-IMPORT cf6f2e16](../../../ai-continuity/verification-receipts/MB-20261019-V68-LIBRARY-IMPORT_cf6f2e16088c4739bb185c853b2a8413.json) | PASS | 3.78 |
| [IMPACT-UNIT cbddcd25](../../../ai-continuity/verification-receipts/MB-20261019-V68-IMPACT-UNIT_cbddcd25fcaa477a9e1547c30a6d078c.json) | PASS | 1.047 |
| [LIBRARY-IMPORT 1d3a7447](../../../ai-continuity/verification-receipts/MB-20261019-V68-LIBRARY-IMPORT_1d3a7447acec4e6996c6d0aeb3bba0f1.json) | PASS | 3.139 |
| [IMPACT-INTEGRATION 6b6348cd](../../../ai-continuity/verification-receipts/MB-20261019-V68-IMPACT-INTEGRATION_6b6348cd227a4406997971ef42d03ee2.json) | PASS | 3.202 |
| [LIBRARY-SOURCE 5bbc2079](../../../ai-continuity/verification-receipts/MB-20261019-V68-LIBRARY-SOURCE_5bbc2079f2994a2bb4b5a10ca5d49ee3.json) | PASS | 8.764 |
| [LIBRARY-DECODE d07dcaf1](../../../ai-continuity/verification-receipts/MB-20261019-V68-LIBRARY-DECODE_d07dcaf1f22543de9d9dc165c0344584.json) | PASS | 12.796 |
| [IMPACT-LIVE c27739f5](../../../ai-continuity/verification-receipts/MB-20261019-V68-IMPACT-LIVE_c27739f5c16045b2b6b014bd559142bc.json) | FAIL | 2.5 |
| [IMPACT-LIVE 78103524](../../../ai-continuity/verification-receipts/MB-20261019-V68-IMPACT-LIVE_78103524ce624ae481b840a6a62b9f1a.json) | PASS | 2.64 |
| [IMPACT-WORKBENCH 4e93e2b0](../../../ai-continuity/verification-receipts/MB-20261019-V68-IMPACT-WORKBENCH_4e93e2b01dd444ea82c2be89f007d2f1.json) | PASS | 3.609 |
| [IMPACT-TSC a2f33996](../../../ai-continuity/verification-receipts/MB-20261019-V68-IMPACT-TSC_a2f3399652fb494eb9ac1bd6f8ec19d9.json) | PASS | 43.5 |
| [IMPACT-673 c074743b](../../../ai-continuity/verification-receipts/MB-20261019-V68-IMPACT-673_c074743b9a0b43729c57dada4a2e1bf7.json) | PASS | 6.077 |
| [IMPACT-REGULATION 5de12277](../../../ai-continuity/verification-receipts/MB-20261019-V68-IMPACT-REGULATION_5de12277eafb491ab037cb9f4685eb88.json) | PASS | 70.765 |
| [HELP ae55dd84](../../../ai-continuity/verification-receipts/MB-20261019-V68-HELP_ae55dd846bc94168bf036880847196af.json) | FAIL | 4.641 |
| [HELP 877dc4ac](../../../ai-continuity/verification-receipts/MB-20261019-V68-HELP_877dc4acf474414cafb203d5e12869af.json) | FAIL | 4.687 |
| [HELP 0fbd44b0](../../../ai-continuity/verification-receipts/MB-20261019-V68-HELP_0fbd44b0ef2844a4947c57b12ebbb23c.json) | PASS | 6.078 |
| [IMPACT-FINAL 85d47d6f](../../../ai-continuity/verification-receipts/MB-20261019-V68-IMPACT-FINAL_85d47d6fecd8439e8ce5b4b2d7c0ffe4.json) | PASS | 59.343 |
| [HELP 322306f2](../../../ai-continuity/verification-receipts/MB-20261019-V68-HELP_322306f245b148a78e33b36eb2b0525d.json) | PASS | 6.156 |
| [IMPACT-GUARDS 319c878c](../../../ai-continuity/verification-receipts/MB-20261019-V68-IMPACT-GUARDS_319c878c4ebc4b7d8bfcecf690968c93.json) | PASS | 7.296 |
| [IMPACT-TSC-FINAL c2434d18](../../../ai-continuity/verification-receipts/MB-20261019-V68-IMPACT-TSC-FINAL_c2434d1808a54cea99d7258542025331.json) | PASS | 21.484 |
| [NATIVE-BUILD 3e99d748](../../../ai-continuity/verification-receipts/MB-20261019-V68-NATIVE-BUILD_3e99d748a3644b618ad7735a2c5a322a.json) | PASS | 0.327 |
| [MAKER-BUILD a345b260](../../../ai-continuity/verification-receipts/MB-20261019-V68-MAKER-BUILD_a345b260b3cd4c04a32012f53d69760a.json) | PASS | 2.218 |
| [MAKER-BUILD-HELP ae8fdbd8](../../../ai-continuity/verification-receipts/MB-20261019-V68-MAKER-BUILD-HELP_ae8fdbd835b14ae7aae542855d2c2291.json) | PASS | 2.234 |
| [MAKER-SMOKE 880e4c86](../../../ai-continuity/verification-receipts/MB-20261019-V68-MAKER-SMOKE_880e4c86e9014746a0f48ca0da2e37f4.json) | FAIL | 0.39 |
| [HELP a5a5b29e](../../../ai-continuity/verification-receipts/MB-20261019-V68-HELP_a5a5b29e64a240b3836e191567683d4b.json) | PASS | 6.187 |
| [HOST-CATALOG 415c374a](../../../ai-continuity/verification-receipts/MB-20261019-V68-HOST-CATALOG_415c374a858f4272a1286dfdb7704279.json) | PASS | 15.577 |
| [NATIVE-BUILD 4771619b](../../../ai-continuity/verification-receipts/MB-20261019-V68-NATIVE-BUILD_4771619bd5f04139867dfc5bb109d208.json) | PASS | 0.39 |
| [GAME-BUILD a154c5a5](../../../ai-continuity/verification-receipts/MB-20261019-V68-GAME-BUILD_a154c5a558a24d7a83b88e198b5e9787.json) | FAIL | 0.311 |
| [HELP 041766a1](../../../ai-continuity/verification-receipts/MB-20261019-V68-HELP_041766a1546b48948185311f97904b13.json) | FAIL | 35.983 |
| [HOST-TSC bea747f2](../../../ai-continuity/verification-receipts/MB-20261019-V68-HOST-TSC_bea747f2faa445e4b4f5b40caa1051dc.json) | PASS | 22.25 |
| [GAME-BUILD 7788dc8e](../../../ai-continuity/verification-receipts/MB-20261019-V68-GAME-BUILD_7788dc8ed73c4a6983a78398dddb468a.json) | PASS | 0.969 |
| [HELP b3f7dde1](../../../ai-continuity/verification-receipts/MB-20261019-V68-HELP_b3f7dde1310c4b5dab8fdf690eb86bfd.json) | PASS | 6.233 |
| [MAKER-FINAL-BUILD 36e00917](../../../ai-continuity/verification-receipts/MB-20261019-V68-MAKER-FINAL-BUILD_36e00917e54f41139b3432c54bb1a57c.json) | PASS | 2.156 |
| [MAKER-SMOKE b8769b1d](../../../ai-continuity/verification-receipts/MB-20261019-V68-MAKER-SMOKE_b8769b1d34e24cbd8229fb537b742be7.json) | PASS | 2.75 |
| [MAKER f000aa28](../../../ai-continuity/verification-receipts/MB-20261019-V68-MAKER_f000aa28b0234b5ca662f63437b6aef8.json) | FAIL | 35.077 |
| [CADENCE a03366b5](../../../ai-continuity/verification-receipts/MB-20261019-V68-CADENCE_a03366b50a72486fbc238cb5bbb507ec.json) | PASS | 14.718 |
| [MAKER 952a54af](../../../ai-continuity/verification-receipts/MB-20261019-V68-MAKER_952a54af118e498f84ab499281ba1237.json) | FAIL | 5.5 |
| [MAKER 7f04f089](../../../ai-continuity/verification-receipts/MB-20261019-V68-MAKER_7f04f089a9594eb3abf00c0c96b352c4.json) | FAIL | 5.422 |
| [GAME-BROWSER 2529c4f1](../../../ai-continuity/verification-receipts/MB-20261019-V68-GAME-BROWSER_2529c4f15a5e48ae894311a6c4718bb6.json) | PASS | 132.313 |
| [MAKER f54dcd48](../../../ai-continuity/verification-receipts/MB-20261019-V68-MAKER_f54dcd48b4cb4e6ea99196a605711dc1.json) | FAIL | 5.186 |
| [MAKER e1fadaea](../../../ai-continuity/verification-receipts/MB-20261019-V68-MAKER_e1fadaea46554e2a9850870f440cae80.json) | PASS | 16.702 |
| [GAME-BROWSER-FINAL ce1ac8d6](../../../ai-continuity/verification-receipts/MB-20261019-V68-GAME-BROWSER-FINAL_ce1ac8d639ba4dc6849baf30c941aebe.json) | PASS | 130.672 |
| [PACKAGE a604d160](../../../ai-continuity/verification-receipts/MB-20261019-V68-PACKAGE_a604d16067c845578bb139df46b9463d.json) | FAIL | 1.842 |
| [MAKER-METADATA c78c0176](../../../ai-continuity/verification-receipts/MB-20261019-V68-MAKER-METADATA_c78c017654524697ab76e7aefe30abe6.json) | PASS | 2.141 |
| [PACKAGE-FINAL c3535676](../../../ai-continuity/verification-receipts/MB-20261019-V68-PACKAGE-FINAL_c35356768d3e44d7ba7dd6497148bdd9.json) | PASS | 8.469 |
| [STAGING 168e30a8](../../../ai-continuity/verification-receipts/MB-20261019-V68-STAGING_168e30a88a5846038426a956c7735a4d.json) | PASS | 4.139 |
| [PUBLICATION a9cceddf](../../../ai-continuity/verification-receipts/MB-20261019-V68-PUBLICATION_a9cceddfe84449148d10aad73af6632a.json) | PASS | 66.672 |

[公開raw照合](publication.json)は製品コミットのremote／PR headと全16ファイルの実byteを確認した。記録のみの後続コミットでは製品HTMLを変更しない。
