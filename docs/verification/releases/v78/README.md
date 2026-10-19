# v78 実検証索引

15球種分類・オリジナル球の保管庫・回転再現性・共有縫い目空力・俯瞰仮想高度を対象とする。原FAILを残し、修正前候補と最終HTMLの検証を分ける。

## 最終成果物の確認

- Core：b23f36bf、13ファイル115テスト。逆算順序の最終bc1df778、5ファイル20テスト。物理の最終930d9425、13ファイル83テスト。集合が重なるので合算しない。24設定例×左右は計48投球ケース。
- 全体TypeScript：23b5977c PASS。最終SourceからNative122入力／Maker89入力をbuild。
- [メーカー](pitcher-maker/pitcher-maker-check.json)：55b95a26 PASS28.328秒。PC1200／390幅、実試投14球、実JSON保存・file再読込・端末復元、ID／名前／履歴独立、人間／AI共通validator、不正入力の原子拒否、未保存下書きの保護。
- [俯瞰](height/height-check.json)：987a813f PASS18.186秒。通常／調整室×2幅で84投影行。「2m×2＝4m×1」「10m×2＝20m×1」、接地・他視点・保持非表示・Source履歴不変。旧保存は旧方式のまま読み、明示変更で新方式へ。
- [独立17得能](traits/traits-check.json)：72b98e4c PASS7.858秒。基礎SIと公開能力の分離を維持。
- [相談用データ](consultation-check.json)：deab3301 PASS。実bundleから15分類／24設定例／17得能とAPI・版・単位・Source hashを生成。
- [通常試合・調整室](game/game-check.json)：4c113518 PASS258.359秒。新物理有効262球、105打球・105守備全完了、9回、fallbackなし、全所持ID、基礎roster不変。v77初期6球は全履歴exact。lab1200／390幅、設定JSON、同一loaded rosterのsession再生が一致。
- [配布照合](release-check.json)：26cbcaa1 PASS3.297秒。Native122／Maker89、Source union129、3HTMLと埋込Core・helper・pins一致、旧242凍結物不変、初期20人と673実測記録を維持。

## 原失敗と修正

- HEIGHT-REDは旧helperが直径を掛け算していた問題を再現。新方式はサイズ計算時だけ仮想高度を投影する。
- PITCH-AUTHORING／EXECUTION／INERTのREDは新API実装前と厳密入力の回帰。TSC初回は検査結果unknownのtest型絞り込みで修正し、最終全体検査へ接続。
- PRESETS／SEAM-GROUNDは地面接触で材質姿勢が落ちる問題。自由区間とバウンド後も位相を引き継ぐ。MATERIAL-FORECAST-THROWはfixtureのexplicit undefinedをvalidatorが拒否したため、正しい省略入力に修正。
- PRESET-HANDEDNESSは新設定例の左右のmirrorを検証。既適用snapshot／保管庫copy／旧7球の移行はworld vectorを変更しない。
- SEAM-STEPは旧5msセルで高回転の姿勢が飛ぶ問題。縫い目有効時だけ共通ownerで1step0.25rad以下へ細分する。
- SEAM-PLANは名目solverが実材質偏向を予知補償していた問題。平均空力で計画してから実spin・縫い目力を作用させる。
- 最終レビューで配球マークの非接触観測も絶対材質姿勢へ統一し、保管庫の未保存編集が切替で消える問題を修正。最終HTMLは修正後のhashへ固定した。
- メーカー初回552b91eaは390幅の旧7球にV78 fieldを仮定したchecker。旧球にも共通resolverを使う検査へ修正。製品を変更しない。修正前PASSはbefore-final-review-fixesへ分けて保存。
- 通常試合初回9effe800はcheckerが存在しないplayers.teamを参照したため、試合halfから操作側を決定。0668bde7は閉じたdetails内の保存ボタンを押してtimeout。どちらも検証器を修正し、原ログを保全した。

## 実行receipt

| task / receipt | 結果 | 実行秒 |
|---|---|---:|
| [BUILD-GAME-REVIEW / d760577b](../../../ai-continuity/verification-receipts/MB-20261020-V78-BUILD-GAME-REVIEW_d760577b227f4c35bec17019c07bc851.json) | PASS | 0.921 |
| [BUILD-GAME / 03a59778](../../../ai-continuity/verification-receipts/MB-20261020-V78-BUILD-GAME_03a597781d544a04ba0ced4ada15a1b0.json) | PASS | 1.172 |
| [BUILD-MAKER-REVIEW / 6fe983ef](../../../ai-continuity/verification-receipts/MB-20261020-V78-BUILD-MAKER-REVIEW_6fe983ef2f8c4ee2857a5573bb2fce9e.json) | PASS | 2.328 |
| [BUILD-MAKER / de7886a5](../../../ai-continuity/verification-receipts/MB-20261020-V78-BUILD-MAKER_de7886a5ba5c4c76b72d2ee8fb0bb9c2.json) | PASS | 2.391 |
| [BUILD-NATIVE-REVIEW / 78485594](../../../ai-continuity/verification-receipts/MB-20261020-V78-BUILD-NATIVE-REVIEW_784855943c994e449a581a1f06287fa6.json) | PASS | 0.406 |
| [BUILD-NATIVE / 5ac61885](../../../ai-continuity/verification-receipts/MB-20261020-V78-BUILD-NATIVE_5ac61885b9684fb59aaf6ff8a8ea923b.json) | PASS | 0.360 |
| [CONSULTATION / deab3301](../../../ai-continuity/verification-receipts/MB-20261020-V78-CONSULTATION_deab330183ac47eeb66d6ecb02d1256b.json) | PASS | 0.093 |
| [CONTINUITY-AUDIT / e2ba9776](../../../ai-continuity/verification-receipts/MB-20261020-V78-CONTINUITY-AUDIT_e2ba9776b18e4eb8bd5ff7b0d9ef0d6d.json) | FAIL | 0.359 |
| [GAME-INITIAL / 9effe800](../../../ai-continuity/verification-receipts/MB-20261020-V78-GAME-INITIAL_9effe800b8b5497488742d4f5e1b936c.json) | FAIL | 11.343 |
| [GAME-REBUILT-VISIBLE-EXPORT / 4c113518](../../../ai-continuity/verification-receipts/MB-20261020-V78-GAME-REBUILT-VISIBLE-EXPORT_4c1135187f2c44b1927f6438641a7f9b.json) | PASS | 258.359 |
| [GAME-REBUILT / 0668bde7](../../../ai-continuity/verification-receipts/MB-20261020-V78-GAME-REBUILT_0668bde7ab7d4dd6afb72aa3e1fe3b1d.json) | FAIL | 134.764 |
| [HEIGHT-BROWSER-FINAL / 987a813f](../../../ai-continuity/verification-receipts/MB-20261020-V78-HEIGHT-BROWSER-FINAL_987a813f13584f75804123c736724fb2.json) | PASS | 18.186 |
| [HEIGHT-BROWSER / a8463acd](../../../ai-continuity/verification-receipts/MB-20261020-V78-HEIGHT-BROWSER_a8463acdf7384165b68aeea7d3bdc578.json) | PASS | 16.750 |
| [HEIGHT-FROZEN / 87f323ba](../../../ai-continuity/verification-receipts/MB-20261020-V78-HEIGHT-FROZEN_87f323ba6c624054bc67eb315259c2ba.json) | PASS | 0.046 |
| [HEIGHT-RED / 4e4584df](../../../ai-continuity/verification-receipts/MB-20261020-V78-HEIGHT-RED_4e4584dfc7154958b593e7fef73f0c12.json) | FAIL | 0.046 |
| [HEIGHT / cf084d20](../../../ai-continuity/verification-receipts/MB-20261020-V78-HEIGHT_cf084d206c714bd995cac4dc1032ea05.json) | PASS | 0.062 |
| [MATERIAL-FORECAST-THROW-RECHECK / 19d7fc7a](../../../ai-continuity/verification-receipts/MB-20261020-V78-MATERIAL-FORECAST-THROW-RECHECK_19d7fc7af13c469b981ad33a102d1cba.json) | PASS | 3.469 |
| [MATERIAL-FORECAST-THROW / 155ae958](../../../ai-continuity/verification-receipts/MB-20261020-V78-MATERIAL-FORECAST-THROW_155ae958ce2d4737a98749e49d35278f.json) | FAIL | 3.609 |
| [PACKAGE / 26cbcaa1](../../../ai-continuity/verification-receipts/MB-20261020-V78-PACKAGE_26cbcaa142e84e6992eb4b92ae333449.json) | PASS | 3.297 |
| [PACKAGE / 9daa9776](../../../ai-continuity/verification-receipts/MB-20261020-V78-PACKAGE_9daa9776258c4ccf9e82c998a740f34d.json) | FAIL | 0.875 |
| [PITCH-AUTHORING-RED / 292c53b5](../../../ai-continuity/verification-receipts/MB-20261020-V78-PITCH-AUTHORING-RED_292c53b5afdc48dd944303ef7f85cb44.json) | FAIL | 0.936 |
| [PITCH-CORE-CANDIDATE / f02e4b46](../../../ai-continuity/verification-receipts/MB-20261020-V78-PITCH-CORE-CANDIDATE_f02e4b467baf422aba7aa1af73e2243c.json) | PASS | 3.062 |
| [PITCH-CORE-FINAL / b23f36bf](../../../ai-continuity/verification-receipts/MB-20261020-V78-PITCH-CORE-FINAL_b23f36bf102d4eb88b3f1ef4248b2642.json) | PASS | 18.703 |
| [PITCH-EXECUTION-RED / b4408114](../../../ai-continuity/verification-receipts/MB-20261020-V78-PITCH-EXECUTION-RED_b4408114d16f48809c46cc553bbc92b7.json) | FAIL | 2.406 |
| [PITCH-EXECUTION-TYPED-FINAL / 67cd2624](../../../ai-continuity/verification-receipts/MB-20261020-V78-PITCH-EXECUTION-TYPED-FINAL_67cd262483304d558730b6660c78fab6.json) | PASS | 18.360 |
| [PITCH-INERT-RED / 80bb6084](../../../ai-continuity/verification-receipts/MB-20261020-V78-PITCH-INERT-RED_80bb6084414b46e48df2e9c579e43e0a.json) | FAIL | 1.468 |
| [PITCH-INTEGRATION-CANDIDATE / 053a665c](../../../ai-continuity/verification-receipts/MB-20261020-V78-PITCH-INTEGRATION-CANDIDATE_053a665c52f946019ade8af023f6c5fd.json) | PASS | 17.609 |
| [PITCH-MEAN-PLAN-FINAL / bc1df778](../../../ai-continuity/verification-receipts/MB-20261020-V78-PITCH-MEAN-PLAN-FINAL_bc1df7786b0e46fe8b9dbfa9bc456166.json) | PASS | 16.139 |
| [PITCH-PRESETS-CANDIDATE / 7eeb068f](../../../ai-continuity/verification-receipts/MB-20261020-V78-PITCH-PRESETS-CANDIDATE_7eeb068fe3a747b7b5de5f458e8c96a5.json) | FAIL | 1.953 |
| [PITCH-PRESETS-RECHECK / 04847d61](../../../ai-continuity/verification-receipts/MB-20261020-V78-PITCH-PRESETS-RECHECK_04847d6105f64746ad2992d593363c14.json) | FAIL | 12.688 |
| [PITCH-REGRESSION-CANDIDATE / 5c271c01](../../../ai-continuity/verification-receipts/MB-20261020-V78-PITCH-REGRESSION-CANDIDATE_5c271c017f994cd6802e9d922bfb558a.json) | PASS | 18.796 |
| [PITCHER-MAKER-BROWSER / 552b91ea](../../../ai-continuity/verification-receipts/MB-20261020-V78-PITCHER-MAKER-BROWSER_552b91ea712d4497baa419cb73cb436c.json) | FAIL | 21.125 |
| [PITCHER-MAKER-BROWSER / 55b95a26](../../../ai-continuity/verification-receipts/MB-20261020-V78-PITCHER-MAKER-BROWSER_55b95a26a81141c2ac8689f2a59b02b1.json) | PASS | 28.328 |
| [PITCHER-MAKER-BROWSER / f92625d3](../../../ai-continuity/verification-receipts/MB-20261020-V78-PITCHER-MAKER-BROWSER_f92625d318c1460884a7db284c76ae97.json) | PASS | 26.593 |
| [PRESET-HANDEDNESS-GREEN / a6be1c4a](../../../ai-continuity/verification-receipts/MB-20261020-V78-PRESET-HANDEDNESS-GREEN_a6be1c4a253841d79d9b3b01b3da8b8d.json) | PASS | 1.609 |
| [PRESET-HANDEDNESS-RED / eb234f34](../../../ai-continuity/verification-receipts/MB-20261020-V78-PRESET-HANDEDNESS-RED_eb234f34a547418a8cd6924bbe41f20b.json) | FAIL | 2.891 |
| [SEAM-CONTINUATION-RED / 881b0b58](../../../ai-continuity/verification-receipts/MB-20261020-V78-SEAM-CONTINUATION-RED_881b0b581edf48e08632afa77ff804a8.json) | FAIL | 1.250 |
| [SEAM-CONTINUATION / 490f94e1](../../../ai-continuity/verification-receipts/MB-20261020-V78-SEAM-CONTINUATION_490f94e1892448efbec176132a66971a.json) | PASS | 3.000 |
| [SEAM-CONTINUATION / d2f7afe5](../../../ai-continuity/verification-receipts/MB-20261020-V78-SEAM-CONTINUATION_d2f7afe5ec424795a6a992401be40b91.json) | PASS | 2.516 |
| [SEAM-GROUND-RED / 49c4c365](../../../ai-continuity/verification-receipts/MB-20261020-V78-SEAM-GROUND-RED_49c4c365902a4ed88adedef1a5dd56e6.json) | FAIL | 1.139 |
| [SEAM-PHYSICS-FINAL / 3401385a](../../../ai-continuity/verification-receipts/MB-20261020-V78-SEAM-PHYSICS-FINAL_3401385afdd84b4fbb596e468372177c.json) | PASS | 2.640 |
| [SEAM-PHYSICS-FINAL / 3d30e2fe](../../../ai-continuity/verification-receipts/MB-20261020-V78-SEAM-PHYSICS-FINAL_3d30e2fef6d74ad89b4dad47ef4e634c.json) | PASS | 2.656 |
| [SEAM-PHYSICS-FINAL / 55f4e4f2](../../../ai-continuity/verification-receipts/MB-20261020-V78-SEAM-PHYSICS-FINAL_55f4e4f23cd848c89412fb2b084330a7.json) | PASS | 2.764 |
| [SEAM-PHYSICS-FROZEN / 930d9425](../../../ai-continuity/verification-receipts/MB-20261020-V78-SEAM-PHYSICS-FROZEN_930d942523bb411e885997ba27540b62.json) | PASS | 3.266 |
| [SEAM-PHYSICS / af29500d](../../../ai-continuity/verification-receipts/MB-20261020-V78-SEAM-PHYSICS_af29500dbc0c4d22b6dbae4a6a959470.json) | PASS | 1.390 |
| [SEAM-PHYSICS / b7833c8f](../../../ai-continuity/verification-receipts/MB-20261020-V78-SEAM-PHYSICS_b7833c8fa3d2497b96b8a07a849b800b.json) | FAIL | 1.469 |
| [SEAM-PLAN-RED / d3fb1ac5](../../../ai-continuity/verification-receipts/MB-20261020-V78-SEAM-PLAN-RED_d3fb1ac560364cc2931c114773968d84.json) | FAIL | 2.875 |
| [SEAM-STEP-RED / bc3c07fd](../../../ai-continuity/verification-receipts/MB-20261020-V78-SEAM-STEP-RED_bc3c07fd66e54221adb23bfbe755f43f.json) | FAIL | 1.171 |
| [THROW-SEAM-REGRESSION / 3ee9a4d9](../../../ai-continuity/verification-receipts/MB-20261020-V78-THROW-SEAM-REGRESSION_3ee9a4d9d85b4751881f481b772776bf.json) | PASS | 4.359 |
| [TRAITS-PRESERVED / 72b98e4c](../../../ai-continuity/verification-receipts/MB-20261020-V78-TRAITS-PRESERVED_72b98e4c2a134015a27519cf1a3e4e2c.json) | PASS | 7.858 |
| [TSC-FINAL / a7fab995](../../../ai-continuity/verification-receipts/MB-20261020-V78-TSC-FINAL_a7fab9957ebf45d59f9fc392e905efa0.json) | PASS | 21.796 |
| [TSC-REVIEW-FINAL / 23b5977c](../../../ai-continuity/verification-receipts/MB-20261020-V78-TSC-REVIEW-FINAL_23b5977cb2c74f0ab325c44861456784.json) | PASS | 22.593 |
| [TSC / d94cf78d](../../../ai-continuity/verification-receipts/MB-20261020-V78-TSC_d94cf78dcecf49f0b23806f8f13d9c02.json) | FAIL | 22.391 |

## 限界と継続項目

縫い目モデルは一次研究を参考にした作者近似。実験曲線へのfit、個別選手の実測校正、全世界の呼称の網羅、CFD、100試合の分布監査は達成に含めない。今回の通常HTML接続をNative認証連続worldの完成とは呼ばない。実機スマホ、残る走塁守備・技術・牽制／盗塁・心理／疲労等は元の全計画へ残す。原Charter HOLD、旧FAIL／BLOCKED／UNKNOWNを保持する。

PACKAGE初回9daa9776 FAILは、検証器が新reportのhashesAtStartを旧キーnormalSha256で参照したKeyError。新schemaの開始終了hashも照合するよう修正し、製品を変えず26cbcaa1で通過。

CCG audit e2ba9776はFAIL（0.359秒）。原Charterの独立承認receipt不足CHARTER_UNAPPROVED 1件と旧commitのhandoff警告を原ログに保持。製品検証のPASSと区別し、CharterをAIで自動承認しない。

STAGING81a7721f PASS3.264秒：明示allowlist、全Gitblobのraw bytes一致、credential pattern0、whitespace0、ユーザーAGENTS除外。最終文書とこのreceiptの追加後も同じ検査器で照合する。
