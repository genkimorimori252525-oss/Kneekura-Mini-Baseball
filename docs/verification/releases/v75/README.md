# v75 実検証索引

各receiptは実command/log SHAを保持。19files193回帰の後、公開resolverの境界を厳密化して最終Source5files39/TypeScript/メーカー/通常9回を実行。主担当がPC/390得能画像を目視。個別技術効果はunitと実動作、9回完走はゲーム継続を検証し、成績の現実校正とは分ける。

| task / receipt | 結果 | 秒 |
|---|---|---:|
| [MB-20261020-V75-BUILD-GAME-FINAL](../../../ai-continuity/verification-receipts/MB-20261020-V75-BUILD-GAME-FINAL_9b7af5508f3a4705b4032817361e38ea.json) | PASS | 0.702 |
| [MB-20261020-V75-BUILD-GAME](../../../ai-continuity/verification-receipts/MB-20261020-V75-BUILD-GAME_74fb0626bb534beea556a6c6154fb740.json) | PASS | 0.796 |
| [MB-20261020-V75-BUILD-MAKER-FINAL](../../../ai-continuity/verification-receipts/MB-20261020-V75-BUILD-MAKER-FINAL_5efcfe458b1343418230856efe003e36.json) | PASS | 2.405 |
| [MB-20261020-V75-BUILD-MAKER](../../../ai-continuity/verification-receipts/MB-20261020-V75-BUILD-MAKER_000d25a4ce32410e82d66c6dd48dde8e.json) | PASS | 2.437 |
| [MB-20261020-V75-BUILD-NATIVE-FINAL](../../../ai-continuity/verification-receipts/MB-20261020-V75-BUILD-NATIVE-FINAL_45bc6ca71d5541468d7b42a292da0b3a.json) | PASS | 0.375 |
| [MB-20261020-V75-BUILD-NATIVE](../../../ai-continuity/verification-receipts/MB-20261020-V75-BUILD-NATIVE_d9d446d24b2a4cd69bd07dea159c3594.json) | PASS | 0.453 |
| [MB-20261020-V75-CORE-REGRESSION](../../../ai-continuity/verification-receipts/MB-20261020-V75-CORE-REGRESSION_226d9e2fc664434f9278c9f130d184ec.json) | PASS | 71.375 |
| [MB-20261020-V75-FINAL-SOURCE-REGRESSION](../../../ai-continuity/verification-receipts/MB-20261020-V75-FINAL-SOURCE-REGRESSION_d1a7dfe87f15466cb08f46ee0a0b9b4d.json) | PASS | 8.092 |
| [MB-20261020-V75-GAME-BROWSER](../../../ai-continuity/verification-receipts/MB-20261020-V75-GAME-BROWSER_d28bd08c013a4adfac84a4c19081bf97.json) | FAIL | 48.938 |
| [MB-20261020-V75-GAME-BROWSER](../../../ai-continuity/verification-receipts/MB-20261020-V75-GAME-BROWSER_f049c2a763ac4173a72a8a8abc015a1f.json) | PASS | 88.047 |
| [MB-20261020-V75-MAKER-BROWSER](../../../ai-continuity/verification-receipts/MB-20261020-V75-MAKER-BROWSER_21936d382c3a4f928c071255cba745a9.json) | PASS | 35.359 |
| [MB-20261020-V75-MAKER-BROWSER](../../../ai-continuity/verification-receipts/MB-20261020-V75-MAKER-BROWSER_21a506d5678b4b9f878d6b5fdc9944aa.json) | FAIL | 11.140 |
| [MB-20261020-V75-MAKER-BROWSER](../../../ai-continuity/verification-receipts/MB-20261020-V75-MAKER-BROWSER_77b9454c4af044cab90b5878cdcd548d.json) | PASS | 33.655 |
| [MB-20261020-V75-PACKAGE](../../../ai-continuity/verification-receipts/MB-20261020-V75-PACKAGE_12db6c548cf641b1b4eed0fedf24f4f0.json) | PASS | 28.389 |
| [MB-20261020-V75-PITCH-TECHNIQUES-FINAL](../../../ai-continuity/verification-receipts/MB-20261020-V75-PITCH-TECHNIQUES-FINAL_19f9389d7eda4312a70b95fe9c849a3f.json) | PASS | 19.686 |
| [MB-20261020-V75-PITCH-TECHNIQUES-INITIAL](../../../ai-continuity/verification-receipts/MB-20261020-V75-PITCH-TECHNIQUES-INITIAL_0d3cbb91dc1a45cabb0b1e348f6db16e.json) | FAIL | 6.047 |
| [MB-20261020-V75-PROFILE-FINAL](../../../ai-continuity/verification-receipts/MB-20261020-V75-PROFILE-FINAL_95a8fbef8e734b73a5abe5791142fe3b.json) | PASS | 1.670 |
| [MB-20261020-V75-PROFILE](../../../ai-continuity/verification-receipts/MB-20261020-V75-PROFILE_a6d6f1a4ac744989a8cfd973943dc7c4.json) | PASS | 1.468 |
| [MB-20261020-V75-TSC-FINAL](../../../ai-continuity/verification-receipts/MB-20261020-V75-TSC-FINAL_0d997b47587541c2b27bc136beda3669.json) | PASS | 21.467 |
| [MB-20261020-V75-TSC](../../../ai-continuity/verification-receipts/MB-20261020-V75-TSC_54f87fb114d843babf9186236b2784e6.json) | PASS | 47.015 |

原FAILは修正後PASSと区別。field-tests/は担当者の原実行・EOL証拠。maker/before-strict-resolver/は公開API境界修正前の成功証拠。中間game停止は9回開始前、PASS扱いしない。原Charter未承認HOLDと累積計画の未達を保持する。

STAGING [MB-20261020-V75-STAGING](../../../ai-continuity/verification-receipts/MB-20261020-V75-STAGING_f7b9273948b14aef91c5d994ea612106.json) PASS 3.360秒。全staged blobのraw bytes・credential0・whitespace0、ユーザーAGENTS除外を照合。

PUBLICATION [MB-20261020-V75-PUBLICATION](../../../ai-continuity/verification-receipts/MB-20261020-V75-PUBLICATION_aa8a9f6a769e46a084968ea086f7b80d.json) PASS 10.000秒。製品commit944bd1fのremote/PRhead、公開3HTML Git blobs/size、raw9小ファイルのbytes一致を確認。後続commitはこの検証記録のみを保存し製品Source/HTMLを変更しない。
