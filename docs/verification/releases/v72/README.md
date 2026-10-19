# メーカーv72 検証索引

[実装・操作・限界](../../../reports/2026-10-19-v72-player-swing-preview.md) / [実ブラウザー](maker/maker-check.json) / [配布照合](release-check.json)

最終ブラウザー検証は11.844秒PASS。1200／390幅で、弾道1〜4と17度入力の即時反映、大画面・白3図・独立に構成した共有サンプラーの姿勢と原時刻exact、共通再生／scrub／速度、右ドラッグ／リセット、実JSONの保存・再読込、他19選手と元clipの保全、旧JSON・旧研究への復帰を確認した。初期20選手は編集前に原JSONと一致する。空欄入力中は未保存、blurでは拒否されても保存済みの姿勢・データを保つ。例外・外部通信・横あふれ0。Rootが大画面と編集欄の同時表示、狭幅画像を目視した。

配布照合はMaker82入力・Native115入力・旧194配布ファイルの不変を確認。v70打者比較UI／CSS／adapterと通常v68 rendererも同じSHA。最終HTMLは `3c24444ffa61b00f429ae0aaaf4fa26bc0f8ce35bfd7cc34e3b63d18db18b8ea`、35,688,209bytes。

原FAILは削除しない。初回c8b119b6は任意の選手・clipの組合せが既存motor ceilingを超えた試験条件で、比較のinvalidateは既知成功する初期条件から確認するよう変更した。a9899311は390幅のgrid itemの暗黙最小幅により横へ拡張した製品不具合で、[実測before／after](maker/overflow-css-probe.json)と新配置限定CSSで解消した。1a627818は追加した空欄拒否テストの意図したエラーを正常ケースと同じnull条件で判定したQAの誤り。拒否後もaccepted poseを照合し、通常ケースのエラー0判定は維持した。

| task / receipt | 結果 | 秒 |
|---|---|---:|
| [BROWSER 1a627818](../../../ai-continuity/verification-receipts/MB-20261019-V72-BROWSER_1a627818f1f648a499d13a0cfe88a02f.json) | FAIL | 4.952 |
| [BROWSER 2ea199cb](../../../ai-continuity/verification-receipts/MB-20261019-V72-BROWSER_2ea199cba4694b8f95d442cf840ff19d.json) | PASS | 11.561 |
| [BROWSER a9899311](../../../ai-continuity/verification-receipts/MB-20261019-V72-BROWSER_a98993116c2347a781a76c34bd00594b.json) | FAIL | 20.905 |
| [BROWSER c8b119b6](../../../ai-continuity/verification-receipts/MB-20261019-V72-BROWSER_c8b119b6bbc14e6cac3b32866dff4198.json) | FAIL | 5.484 |
| [BUILD 81ae9cd3](../../../ai-continuity/verification-receipts/MB-20261019-V72-BUILD_81ae9cd32e6e4a358163523b72c8e945.json) | PASS | 2.438 |
| [BYTE-BUILD 5cdc8f3d](../../../ai-continuity/verification-receipts/MB-20261019-V72-BYTE-BUILD_5cdc8f3da73141eaa991d5fa80a2ef93.json) | PASS | 2.500 |
| [FINAL-BROWSER 615ffebc](../../../ai-continuity/verification-receipts/MB-20261019-V72-FINAL-BROWSER_615ffebca1e541949b1e75e8fca6b43d.json) | PASS | 11.844 |
| [FINAL-BROWSER dffaebaa](../../../ai-continuity/verification-receipts/MB-20261019-V72-FINAL-BROWSER_dffaebaa101b4b1a8153792bcfcf5384.json) | FAIL | 6.218 |
| [FINAL-BUILD ff05c271](../../../ai-continuity/verification-receipts/MB-20261019-V72-FINAL-BUILD_ff05c2713e38490a8932bdb4c8d7749f.json) | PASS | 2.452 |
| [FINAL-PACKAGE e90b83e3](../../../ai-continuity/verification-receipts/MB-20261019-V72-FINAL-PACKAGE_e90b83e341ec499580d0ce85d7617ef8.json) | PASS | 1.639 |
| [LAYOUT-BUILD 0e4b28bd](../../../ai-continuity/verification-receipts/MB-20261019-V72-LAYOUT-BUILD_0e4b28bd5f144bb994f5a1ef91f09be1.json) | PASS | 2.327 |
| [PACKAGE 32381392](../../../ai-continuity/verification-receipts/MB-20261019-V72-PACKAGE_323813925bc14537bfdc1eec15c482da.json) | PASS | 1.593 |
| [REVIEW-BUILD 68c8e2f1](../../../ai-continuity/verification-receipts/MB-20261019-V72-REVIEW-BUILD_68c8e2f194cb45278ecf983e8e8220d6.json) | PASS | 2.421 |
| [STAGING c75fa816](../../../ai-continuity/verification-receipts/MB-20261019-V72-STAGING_c75fa816a72d494094e3c5ccb8070f92.json) | PASS | 1.406 |

通常試合／調整室はv68、物理・裁定の追加変更はない。新しいTypeScript型検査・9回完走・実機スマートフォン・全フォームの全能力組合せの成功を主張しない。元全計画の未達と全FAIL／UNKNOWN／Charter HOLDを保持する。

[継続監査の原出力](continuity-audit.txt)は終了値1。独立したCharter承認がない既存HOLDを保持し、今回の表示接続のPASSへ変換しない。旧handoffの参照commit警告も原記録のまま保持する。

最終stagingで比較UIとCSSの不要なCRLF変換を検出し、元のLFへ戻して再ビルド・再検証した。動作コードの変更はない。再実行dffaebaaはnative detailsの非同期toggle完了前を判定したQAの競合。open／close後の期待状態を待つようにし、同じ厳密条件とtimeoutを維持した。最終FINAL-BROWSER615ffebcは11.844秒PASS。原FAILを保持する。

[公開照合](publication.json)は製品コミット `81d8a388fae22bd59714d1424cc69ebae2d9f3f4` のremote／既存Open Draft PR #380 headと公開raw9ファイルのbyte一致を確認した。

- [PUBLICATION f9612140](../../../ai-continuity/verification-receipts/MB-20261019-V72-PUBLICATION_f961214008844b4e9a1355d015df2b5f.json): PASS 51.313秒。
- 最終stagingは69 raw blobs一致、credential pattern0、whitespace PASS。ユーザーのAGENTS.mdを除外。後続は検証記録だけを保存し、HTMLを変更しない。
