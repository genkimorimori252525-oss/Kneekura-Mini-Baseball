# v73 検証索引

[実装・操作・限界](../../../reports/2026-10-19-v73-whole-arc-trajectory.md) / [Core tests原出力](../../../ai-continuity/verification-receipts/MB-20261019-V73-CORE-TEST-FINAL_0f7b764ddc514ca78802969054b495a8.log) / [メーカー](maker/maker-check.json) / [新方式の通常試合](game-whole-arc/game-check.json) / [旧条件の9回](game-legacy/game-check.json) / [配布照合](release-check.json)

Coreは6 files・46 tests PASS（67.343秒）、型検査PASS（27.593秒）。左右の目標0度を含む4段階、全673記録×4=2692変種の目標角・バット長・速度ノルム・速度上限の保存、短いclip、始端・中間・終端の固定回転、解析速度と有限差分、incoming/outgoing、旧JSONと旧ゼロ角を確認した。最初の48638f74 FAILは、undefinedを既存cloneInertが先に拒否する際の例外文を試験regexが許していなかったもの。拒否自体は正しく、原結果を残し試験の期待のみ修正した。

メーカーは15.421秒PASS。1200／390幅で元673記録の分類（down7／level49／upper412／strong205）、左右・種類の絞込と選択中の保全、実接触角−10／0／10／20度（誤差1.1e-13度以下）、始端・中間・終端への同一固定回転、主画面／3図／独立samplerの同時刻・姿勢、角度入力の即時反映、新旧JSONの実保存再読込、他19選手と元データの保全、右ドラッグ・移動・拡大を確認した。RootがPCの大画面と編集欄の同時表示、390幅の画像を目視した。

新方式の通常HTML・調整室probeは13.358秒PASS。実投球の基準接触速度で弾道1が−10.000000000000005度、4が19.999999999999996度。新method／model、打球角・spin非上書き、旧省略method保持、未知methodの原子拒否、PC／390幅、55／22msを確認した。旧条件の通常HTMLは145.453秒PASS、既存6球の全Source／bat／裁定がexact。320球・127接触で9回完走し、全field playがcomplete。9回部分は88.688秒。高得点の既存分布を現実への校正済みとは呼ばない。

配布照合では3HTMLと各Source入力のSHA、メーカーに使う通常renderer、調整室に埋め込む同一試合、初期20人、旧197配布ファイルの不変を確認した。球の空力・裁定・AI・カメラhelperは変更していない。新方式は実バット入力の変更であり、衝突結果が従来と同じことは要求しない。

| task / receipt | 結果 | 秒 |
|---|---|---:|
| [BUILD-GAME 707d3916](../../../ai-continuity/verification-receipts/MB-20261019-V73-BUILD-GAME_707d3916122346d09058503586ea2c18.json) | PASS | 0.922 |
| [BUILD-MAKER 2b23b796](../../../ai-continuity/verification-receipts/MB-20261019-V73-BUILD-MAKER_2b23b7960da94527a23f48cb6da51f78.json) | PASS | 2.343 |
| [BUILD-NATIVE 9c6c1c11](../../../ai-continuity/verification-receipts/MB-20261019-V73-BUILD-NATIVE_9c6c1c1188804385ad845f654246cafb.json) | PASS | 0.390 |
| [CORE-TEST-FINAL 0f7b764d](../../../ai-continuity/verification-receipts/MB-20261019-V73-CORE-TEST-FINAL_0f7b764ddc514ca78802969054b495a8.json) | PASS | 67.343 |
| [CORE-TEST 48638f74](../../../ai-continuity/verification-receipts/MB-20261019-V73-CORE-TEST_48638f74fc2a4ea2af687c9eb4570c6e.json) | FAIL | 66.453 |
| [CORE-TSC-FINAL 1cc3bbf9](../../../ai-continuity/verification-receipts/MB-20261019-V73-CORE-TSC-FINAL_1cc3bbf9417843d3ad2cd21991701ee3.json) | PASS | 27.593 |
| [CORE-TSC 2af5655d](../../../ai-continuity/verification-receipts/MB-20261019-V73-CORE-TSC_2af5655d092f4153af010c801fc95da8.json) | PASS | 27.952 |
| [LEGACY-GAME 269485f0](../../../ai-continuity/verification-receipts/MB-20261019-V73-LEGACY-GAME_269485f0782c4029aba2b6ffb69b3f78.json) | PASS | 145.453 |
| [MAKER-BROWSER 6ffe4d6d](../../../ai-continuity/verification-receipts/MB-20261019-V73-MAKER-BROWSER_6ffe4d6debfe445ab581b601dfd38fbe.json) | PASS | 15.421 |
| [PACKAGE 21c9e12d](../../../ai-continuity/verification-receipts/MB-20261019-V73-PACKAGE_21c9e12d38574e87affbb80ed6ca61d2.json) | PASS | 4.500 |
| [WHOLE-ARC-GAME 890aa4af](../../../ai-continuity/verification-receipts/MB-20261019-V73-WHOLE-ARC-GAME_890aa4afbe614795830c6dc125518e1c.json) | PASS | 13.358 |

| 成果物 | SHA256 |
|---|---|
| normalSha256 | `38d1d09cca6471642a22d0d27d87bbfd5c71b7235c338ac572966d1aa8faa04d` |
| workbenchSha256 | `73d27b53d3561908ad57be2c2fa9e1ea5d3c0d1add6ca2db183306bff66a8df7` |
| makerSha256 | `821536e0994345e5b9fe50b8b7bae00b3e3b77fcb915507b597c6fbffd3c57d4` |

元全計画の未達、全FAIL／UNKNOWN、Charter HOLDを保持する。100試合の分布監査・全身モーション・実機スマートフォンでの校正を今回の受入へ含めたとは主張しない。

[継続監査の原出力](continuity-audit.txt)は終了値1。既存の独立Charter承認不足HOLDと旧handoff警告を保持し、今回の実装PASSへ変換しない。

[公開照合](publication.json)は製品コミット `3df8aeb69a69f02b86eb8326abc84ffc5483bfd8` のremote／既存Open Draft PR #380 headを確認した。3つの大容量HTMLはGitHub公開treeのblob SHA1・sizeとローカル実bytesが一致し、SHA256も記録した。公開rawは索引・metadata・source・文書9ファイルのbyte一致を確認。大容量HTMLのraw再ダウンロードを行ったとは記録しない。

- [STAGING d403828e](../../../ai-continuity/verification-receipts/MB-20261019-V73-STAGING_d403828e464443dd9872870833cdde99.json): PASS3.390秒。最終86 raw staged blobs一致、credential pattern0、whitespace PASS、ユーザーAGENTS除外。
- [PUBLICATION 8515861b](../../../ai-continuity/verification-receipts/MB-20261019-V73-PUBLICATION_8515861bb06b459bbf0ce9fb3884275c.json): PASS6.859秒。
