# v74 実検証と限界

関連Core6files104tests、全体TypeScript、通常HTML/調整室、初期6球の全Source/bat/裁定exact、メーカーPC1200/390と実JSON、3配布HTMLを検証。今回の9回/100試合再監査・経験的SI校正・実機スマホの達成は主張しない。

| task / receipt | 結果 | 秒 |
|---|---|---:|
| [MB-20261020-V74-BUILD-GAME](../../../ai-continuity/verification-receipts/MB-20261020-V74-BUILD-GAME_2331263c7605422f97e5ae1167b85d81.json) | PASS | 0.984 |
| [MB-20261020-V74-BUILD-MAKER-FINAL](../../../ai-continuity/verification-receipts/MB-20261020-V74-BUILD-MAKER-FINAL_a8bb23acd8c343a6a9d62e102e81024a.json) | PASS | 2.625 |
| [MB-20261020-V74-BUILD-MAKER-WIDE](../../../ai-continuity/verification-receipts/MB-20261020-V74-BUILD-MAKER-WIDE_735c8396556348a0a66592d4dd6736a1.json) | PASS | 2.421 |
| [MB-20261020-V74-BUILD-MAKER](../../../ai-continuity/verification-receipts/MB-20261020-V74-BUILD-MAKER_50b58dc4927945e295f553256d574e8a.json) | PASS | 2.453 |
| [MB-20261020-V74-BUILD-NATIVE](../../../ai-continuity/verification-receipts/MB-20261020-V74-BUILD-NATIVE_7940513f7d844fd484c051117ece34e0.json) | PASS | 0.422 |
| [MB-20261020-V74-CORE-TEST](../../../ai-continuity/verification-receipts/MB-20261020-V74-CORE-TEST_6bef2926a7074ec88026afd77153e857.json) | PASS | 6.266 |
| [MB-20261020-V74-DEFAULT-PREFIX-FINAL](../../../ai-continuity/verification-receipts/MB-20261020-V74-DEFAULT-PREFIX-FINAL_8dc6c8ec78204e4691122ccc86456113.json) | PASS | 10.812 |
| [MB-20261020-V74-DEFAULT-PREFIX](../../../ai-continuity/verification-receipts/MB-20261020-V74-DEFAULT-PREFIX_50f11666b7674c6aa492aaa28f4e42da.json) | FAIL | 0.046 |
| [MB-20261020-V74-GAME-BROWSER](../../../ai-continuity/verification-receipts/MB-20261020-V74-GAME-BROWSER_2a3f11b7d4aa4255b77a2ca9a26dcedc.json) | PASS | 13.438 |
| [MB-20261020-V74-MAKER-BROWSER](../../../ai-continuity/verification-receipts/MB-20261020-V74-MAKER-BROWSER_2a429a158ff948559e89fa830e16ef18.json) | PASS | 12.859 |
| [MB-20261020-V74-MAKER-BROWSER](../../../ai-continuity/verification-receipts/MB-20261020-V74-MAKER-BROWSER_98d5c4cf758e48be86fa7c85fb221cd5.json) | FAIL | 4.797 |
| [MB-20261020-V74-MAKER-BROWSER](../../../ai-continuity/verification-receipts/MB-20261020-V74-MAKER-BROWSER_dfab00de04bd4112979e615d2b264458.json) | PASS | 12.984 |
| [MB-20261020-V74-PACKAGE-FINAL](../../../ai-continuity/verification-receipts/MB-20261020-V74-PACKAGE-FINAL_84346e544cd84917866c1b24d18cd48c.json) | PASS | 3.859 |
| [MB-20261020-V74-PACKAGE](../../../ai-continuity/verification-receipts/MB-20261020-V74-PACKAGE_5463ae513b964864a6a0f61048ccfb1e.json) | FAIL | 0.125 |
| [MB-20261020-V74-PRESENTATION](../../../ai-continuity/verification-receipts/MB-20261020-V74-PRESENTATION_a87c47d3d394473c801b68647279dc9d.json) | PASS | 0.750 |
| [MB-20261020-V74-RATINGS-OVERFLOW](../../../ai-continuity/verification-receipts/MB-20261020-V74-RATINGS-OVERFLOW_16bbdc75631247cb819bee21bb9fd469.json) | PASS | 2.922 |
| [MB-20261020-V74-TSC](../../../ai-continuity/verification-receipts/MB-20261020-V74-TSC_63a52c605476401eac3b0e542ce4b82e.json) | PASS | 27.953 |

最終メーカー2a429a15は12.859秒PASS。主/白の1.5/3m共有geometry、2.2kg実入力、公開125、選球眼101拒否、実4case接触/ball+bat層、PC比較1160px/canvas900px/390で366px/318px、tab同期、初期20/元分類/他19不変。rootが最終PC画像を目視。

配布84346e54は3.859秒PASS。122Source入力、3HTMLのSHA、調整室/メーカーの同一通常renderer、初期20人、旧206配布ファイル不変を照合。普通試合Hostは版名/版番号以外exact。能力表/公開投影DOM経路がなく、100超はメーカーに限られる。

初回DEFAULT-PREFIX50f11666は未生成checkerの呼出、初回メーカー98d5c4cfはblur復元を考慮しないQA仮定、初回PACKAGE5463ae51はcheckerに旧版73の期待値が残ったFAIL。原receipt/ログを保持し、それぞれ修正後の実検証と区別する。中間QA dfab00deは用具等PASSだがPC幅277pxが残り全幅化を追加。中間画像/reportはbefore-full-width/、原用具RED観測と最終生ログはequipment-tests/に保持。

原Charter未承認HOLD、既存FAIL/UNKNOWN、元の全計画の未達課題は保持。

| [MB-20261020-V74-STAGING-FINAL](../../../ai-continuity/verification-receipts/MB-20261020-V74-STAGING-FINAL_34364f71644f4ab3b5dd4bbf688af285.json) | PASS | 1.641 |

| [MB-20261020-V74-STAGING](../../../ai-continuity/verification-receipts/MB-20261020-V74-STAGING_ea8b6c22a8a646ccb2b57c95317a3a17.json) | FAIL | 3.093 |

初回STAGING ea8b6c22は新checker空行の末尾空白1文字でFAIL。checkerの空白だけを除き、製品HTML/Source物理は変更せず34364f71 PASS。ユーザーAGENTSを除外し、全staged blobの実bytes/credential pattern/whitespaceを照合。
