# メーカーv71 検証索引

[実装・操作・限界](../../../reports/2026-10-19-v71-bat-preview-orbit.md) / [実ブラウザー](maker/maker-check.json) / [配布照合](release-check.json)

1200／390幅で22.108秒PASS。旧v70の初期描画exact、実右ドラッグ、黒画面の左移動／ホイール／リセット、白3図の全5軌道共通投影、SourceFrame／物理／revision／20選手／JSON不変を確認した。例外・外部通信・横あふれ0。v70の打者比較UI／CSS／adapterは同じSHAを維持する。Rootが狭幅画像を目視した。

配布照合でMaker82／Native115入力、旧191配布ファイル、100MB未満、最終Source／HTMLのSHAを確認した。新しいTypeScript・通常試合9回・実機スマートフォン検証の報告ではない。元全計画・未達・全FAIL／UNKNOWN／Charter HOLDを保持する。

| task / receipt | 結果 | 秒 |
|---|---|---:|
| [BUILD 18cd7de3](../../../ai-continuity/verification-receipts/MB-20261019-V71-BUILD_18cd7de3e61c4379a5307e614cb5d7ec.json) | PASS | 2.406 |
| [FINAL-BUILD e665ef3d](../../../ai-continuity/verification-receipts/MB-20261019-V71-FINAL-BUILD_e665ef3d0a16434c833c6c47b74ed1ba.json) | PASS | 2.343 |
| [MAKER-BROWSER 04e257e1](../../../ai-continuity/verification-receipts/MB-20261019-V71-MAKER-BROWSER_04e257e177ec4127930beeb6906d3795.json) | PASS | 22.108 |
| [PACKAGE 46fa483e](../../../ai-continuity/verification-receipts/MB-20261019-V71-PACKAGE_46fa483e2e4a4d6e9cc54a3be742bdf9.json) | PASS | 1.561 |

[公開照合](publication.json)で製品コミット `ed97accec441593aad325e4de045478791c7e948` のremote／既存Draft PR #380 headと公開raw9ファイルのbyte一致を確認した。記録だけの後続コミットでHTMLを変更しない。

- [MB-20261019-V71-STAGING 15ce16b6](../../../ai-continuity/verification-receipts/MB-20261019-V71-STAGING_15ce16b64b9f484cbd10d952d8dd6993.json): PASS 1.343秒。
- [MB-20261019-V71-PUBLICATION 5ecc14b0](../../../ai-continuity/verification-receipts/MB-20261019-V71-PUBLICATION_5ecc14b090d14419848e397fbb1a30f9.json): PASS 51.436秒。
