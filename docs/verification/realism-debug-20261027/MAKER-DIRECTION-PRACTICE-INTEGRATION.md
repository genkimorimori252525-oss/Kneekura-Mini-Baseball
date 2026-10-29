# 手動方向・おまかせ・連続打席の最新Maker検証版

2026-10-30 JST。既存の利用機能を最新Core / UIへ統合し、新しい組合せの境界を受け入れた。**この単一Maker検証版では手動3方向＋おまかせ、連続打席、保存再開後の次球、打球記録の明示読込を利用できる。完成版3HTMLの配送とは別。**

[Maker検証HTML](candidate-maker-direction-practice-current-01/maker.html) / HTML SHA-256 `36cc176a94e15f61f677a9aa62288bce8da87561b036c1a90f7f8b5b15a41ea1`。

## 統合したもの

試験reportが事前注入されていないV161受入済みMakerをbaseに、現在のNative / Workbench Coreと4 UIを統合した。2つの内包ゲームは保持する。方向UI・連続UIは既存成功Sourceと同じで、Maker / 投手UIには未採用キレの説明3 literal、Coreにはpole witness追加という既存受入後の差分があるため、新しい組合せだけを検証した。

builderの変更は固定title1 literalだけ。既存UIや4選択を作り直していない。未追跡だったbuilderを公開する場合、title1 literalの変更証拠は工程直前baselineとの比較であり、Git親からの全差分ではない。

| Source | SHA-256 |
| --- | --- |
| Native bundle（217 inputs） | `ff706285c0d48f2d2a7de8c7d86bd62bea521ce1b1da85a44f9e8997db18b7ce` |
| Workbench bundle（199 inputs） | `2b954cb4d974957954331ba8c4378c593cf45a09ace32ca0c0147b7dd7675dc2` |
| Maker UI | `6a6d815a9dac933236abc321d683f50428029505edf44a6ab14895f514656c45` |
| 投手UI | `b5aa65e27321efbbc2c95c236d9bf38c426ad5bbff71a0eedccf832537fd7801` |
| 方向UI | `832ee7718b20dc62b3e22d01754ef4e2102290da27ffdc507a0b2ac4f6cf164d` |
| 連続打席UI | `f5f634e9403ba156434f8cf4d72e0a61b21919ad738693debd9df7ce83bb0115` |

## 新たに確認したこと

実Chrome156.0.8078.49のONE統合QAは `4ff9502360504dac845f4b89cfb43864` **PASS56437ms**。

- 1200px：手動3方向＋AUTO、本人方針への復帰、roster保存値不変、実Worker。TAKE後の次球・preview非消費・カウント / 観測記憶・JSON再開後の次球を、同じ新Native Coreの通常Hostと全recordのlossless codecで厳密比較した。
- 390px：4選択への到達、練習開始、初期state、実Worker、表示範囲、rosterを確認。同じ全Core比較を繰り返していない。
- 記録欄は初期未評価 / 未読込。起動後の明示file importで参考判定を表示し、`physicsEffects:NONE`とroster不変を保持した。分類を回転操作へ流していない。
- キレは「選択は保存」「元球種を変える試験設定のため物理3段階として未採用」の説明文言を確認した。新たな保存／物理採用の受入とはしていない。
- HTML内の実2 Native / 1 Workbench codeを各bundle全文へ直接照合。2 renderer scriptとbaseの一致、673 clips / 92201 frames、全inputs / Core / UI / 旧V133 / harness・生成helperの開始終了pinsを確認した。errors / requestsは0。

新QA1fileの最終SHAは `6b111e603a45d0acd30daab1bc6e99f047db7d339cbb2c1fd05169e5679b0761`。Solの独立reviewでhelper pinsと実埋込Core照合の不足2点を実行前に補完した。旧方向matrix・2048seed・全旧Chrome成功harnessの再演は0。

生成receiptはtitle逆変換 / nodecheck `a4ee5070`、Native build `ab934d5d`、Workbench build `6b2da2c8`、統合build `1cf040b1`。workspace外上位package.jsonのtype値警告を保存し、終了0・bundle / input pinsの成功と区別した。

## 目視と残ること

受入ケースを再実行せず、同じHTMLを通常表示したscreenshot-onlyの1200 / 390px、操作欄と記録欄各1枚を主担当Solが目視した。単列表示、操作欄、未評価記録欄に重大な表示破綻は認めなかった。撮影前後HTML SHAは一致する。画像はprivate `work/maker-integration-screenshot-only-01/`へ保存した。

心理・配球の未分類経験からの推定、ニッチロー初球以降の一般的受入、元球種保持のキレ3段階、SPIN4の不足対照、production分類校正、全試合batch / 9回 / 性能、通常HTML・調整室を含む完成3HTML配送と最新設計GitHub全文照合は未完。`performancePass:false`と全Goal未完を保持する。
