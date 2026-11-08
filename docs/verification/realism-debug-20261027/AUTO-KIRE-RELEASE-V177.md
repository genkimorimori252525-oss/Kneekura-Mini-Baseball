# V177 キレ3選択の名目release・保存・通常試合接続

Task `MB-20261027-REALISM-DEBUG-PLAN` Task4 Step7。実装/限定受入の進行記録。UIの実操作/同Chrome/球別適用/最終配送はこの時点で未完。

## 実装

`LivePitchQualityRecipeV177.ts` が3状態からV168 planを生成する。元snapshotのspin/qを保持した基準mean逆算→recipe→元の幾何初期値からrecipe mean逆算→既存のspin再現誤差/workload→同じSourceの順。新しいRNG draw、球のseam係数/物性変更、future actual ball、打者/打球結果補正は追加していない。null/省略は従来の1回経路を保持する。

profileはV2の `breaking_ball_quality`、sourceは `{recipeVersion:'kire_release_recipe_v177'}` のみ。3state/表示は本人指定、PITCH_QUALITY editorで倍率入力なし。実行境界の一時返値だけへrequestを加え、元physical/repertoireは書き換えない。既存Host/Workbenchの同じresolver経路へ接続。トップレベルの一球指定が優先し、nullでその一球だけprofileを抑止できる。既存V168明示planとの同時有効指定は拒否する。

元material q欠如/有効seamなし/zero spin/relative air0/横回転基底退化等は理由付きNOT_APPLICABLE。表示identityや任意axisで補わない。この境界は途中段階の不足であり、手入力を利用者へ要求する解決や全scope完成へ読み替えない。左は既鏡映snapshotを保ちlongitudinal gyro符号を対応するが、左actual/全球種の段階順序はまだ未実証。

## 検証と保持した失敗

- 新pure leaf7件 `ea528b48` PASS4922ms。右の旧factory純計算と厳密一致、左の数理鏡映、phase0 raw q/-q、境界/非破壊。旧matrix flight再実行0。RED dc0d8873保持。
- 実release新8件 `b8557f39` PASS3171ms。RED2de98a3dは品質指定が無視される反例。後にprofile override caseを追加。
- 新release/JSON→通常Host/WB/trait＋関連旧7files42件 `ec1d50e5` PASS18016ms。型検査でtest fixtureの部分physical/旧context型/不正source配列型を発見した5f6dc017 FAILを保持。canonical roster adapter/公開workload snapshot/明示invalid arrayへ直し、新3files20件 `5d7d3d32` PASS9467ms。productionの検証条件を緩めていない。
- 現Sourceの全型 `24b49ee0` PASS24750ms。前段型ec04bedd PASS後、表示用の既存net observerを両Coreへexportしたため追加分を含め確認した。
- trait初回RED cf2ee905、test import先誤りbdebcedb FAILを保持。現在の3状態・null復帰・旧V1 catalog7/13・旧V2各倍率範囲・複合trait保持を関連結果に含む。
- 独立読取reviewは具体的な新規反例なし。左actual/全球種の実証には転用しない。

## 最新Coreと候補作成

`4f40eb2d` PASS452msで新Core別build。Native216 inputs、entry `ee2ca43b2629ad7e57c5b79462f67ddb1e10ac5a85ff880731796e35f35b6f14`、WB193 inputs、entry `8fbe382cfcadbcd6bfcb43aecd4c57eaa545cf63bd48d04453ad2e86939ae5b1`。`candidate-quality-release-*-v177-02/manifest.json` を現版に使う。01/19785f7eはnet export追加前の履歴で、現版へ付替えない。

Maker候補生成入口にはoptional `makerSource`/`--maker` を追加し、TS ASTで唯一のMaker本体IIFEだけを差し替える。旧game/PNG/隣接moduleを保持。未指定時の出力は不変。builder10件 `b40cdbff` PASS264ms、旧5＋新5。新機能RED7327a7dcと初回test括弧誤り1db77f99を保持。

## 同Chromeの自動入力・旧版互換

`7ddd82e81cd9452c99b45c7fb9d670cf` PASS27813ms。同Chrome.49の13capture/75record/129check、2Core/Main/実Worker/JSONが厳密一致し、全Source/manifest/code/end pinsも一致した。新自動3状態のSource/旧161点/全641点/netは保存V176の同じ3入力と厳密一致。通常の共通Q/P/D/Lとown P/D/Lがすべて成立した。3明示V168対照/null/profile/label-only対照も確認。

元V170実binaryを同じChromeで実行した同じ省略入力は、新版とfull serial record/function省略path/実sampleが厳密一致した。新exportsを旧版同一と呼ばず、旧Sourceをcurrentとして再検証していない。nullのWB保存input1field差はraw保持。左actual/全球種/知覚・実測/Native習得はこの右prototypeのPASSへ付け替えない。

## メーカー候補とUI受入

投手UIは3選択→即保存/自動試投、元の球と選択後の実samplerを重ね、netの10%時刻/変化区間/終盤比と量・到達時間を表示する差分を実装。元球はAPPLIED時だけ同inputのtop nullで1回計算し、通常/N/Aは追加0。ground実履歴が不足/接地なら指標は未分類。一般trait UIにも同じ3状態/通常復帰、数値倍率欄なし。投手UI構文f95e592b PASS47ms。

`b3d0ff4e` PASS2483msで `candidate-maker-auto-kire-v177-01/maker.html` を別生成。現在Core02とMaker本体/投手UIを同梱し、元V161/共有dist/PNGは保持。PC/390pxの実操作/保存/表示受入は準備中。

Sourceは未commit/push。旧候補/共有dist/本人原本は変更しない。全SPIN/SIGN今回基盤/旧V122/V148/Native・法/性能B/9回/同版3HTML配送/最終設計GitHub本文照合は未完のまま。

## UI受入と最新表示訂正

UI run05 `fbca7815633242d6bd35b13af1d71a3c` PASS24734ms、同Chrome.49、PC1200/390の85check。3選択即保存/自動試投/APPLIED/元physical不変、灰緑曲線/表=実保持sampler/倍率欄なし、通常Sourceと17sample復帰、実JSONdownload→再読のstate/Source/比較表一致、旧候補/本人原本/endpins保持を確認。Rootも比較画像1200/390を実見した。

初回3fc1c583は実77MB候補に入力64MiB上限でbrowser前FAIL、上限128MiBへ根拠付き修正。0410d199/1ab9ce61は旧非表示preset操作、3e43c012は選手往復で別球が選ばれた比較のharness誤りでFAILを保持。実UIの方向別カード/同curveへ戻す操作へ修正。run05でPC完了分も再試投した点は報告し、以後同じ85checkは繰り返さない。getInput.pitchId明示保存は不足し、既存inspect/diag.plan/保存JSONから照合できる範囲に限定。

本人の最新訂正で表示をキレ○/キレ◎（blue）/驚異の切れ味（gold）へ更新、最高に◎を付けない。内部ID/recipe/物理は維持。catalog限定99dfc2a7 PASS1875ms。Core03/0738cc67 PASS797msは、Core02との両全bundleがこの表示literal1個だけの差であることをexact証明（物理試投0）。Native216 `9904009b29a0828defcceef3c320ff65f3440dd7774c06abe6cbf7dc15575c57`、WB193 `784b6eaae366d7b6f095a8ac40d04ef4ccc2180ef15add77e42ef9f173212262`。

新candidate-maker-auto-kire-v177-02は8291d50f PASS2609msで別生成。投手選択肢/選択中/比較表にもblue/blue/goldを指定。変更分のDOM名/色だけを追加確認し、旧物理/85受入を繰り返さない。V178で他球種の品質不成立を実証したため、UI操作成功を全球種品質や全goal完成へ昇格しない。

## 名称・色の追加DOM受入

`fd298bb4c09045b4a6cbef154db7a8f5` PASS10469ms、Chrome156.0.8078.49。新候補02の実DOMで、キレ○/キレ◎は青 `#2166a5`、驚異の切れ味は金 `#805700`。投手の選択肢/選択中色とmain traitsの選択肢が一致し、最高段階の末尾◎と旧「脅威」表記がないことを確認した。

3状態のauthoring同期は投手試投0。追加は最高段階の実DOM選択1回＋UI内の元球比較1回に限定した。PC1200から同じpageを390pxへresizeし追加試投0で、比較表header「驚異の切れ味」の金色、横overflow0、page errors0、HTML/UI/旧候補のendpins一致を確認。inspect/getInput/planのpitchIdは同じ `preset-curve`。

内部ID `THREATENING_DOUBLE_CIRCLE` とrecipe版を維持。物理不変は上記Core03のliteral-only同値証拠を再利用し、この表示確認で再証明した扱いにしない。既存85項目/旧Source検証は再実行せず、原FAILも変更していない。

記録と小さいselector/comparison画像は `kire-label-colors-v177-01/report.json` と同folder。PC/390pxの表示受入であり、他球種の品質・段階順序や全goal完成へは昇格しない。

## 後続の採用判断

V179は固定scale/gyro/phase8で両球種候補0。さらにV177の2–10%低回転化/gyro30置換が元の球種を保持する品質操作ではないため、普遍recipeとしての採用を撤回した。V180では元通常PV/全spinを保持した16材料姿勢×2/通常を含む4段階を検証したが、fbe53dd7のruntime整合PASS/16922msに対し品質候補は両球種0。詳細 `KIRE-PHASE-DOMAIN-V179.md` / `KIRE-BASE-PRESERVING-V180.md`。旧Source/保存/局所PASS/UI受入は研究履歴として保持する。現在の候補を完成版として配送せず、旧保存の物理を黙って新しい方式へ変更しない。追加gridを停止し、モデル/入力不足をTask4のUNKNOWNに保持する。
