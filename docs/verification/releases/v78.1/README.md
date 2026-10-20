# v78.1 投球図の実検証

- 73351062 RED：新しい投影helperがまだ存在しないことを確認。
- 772a1995 FAIL：testの.15m完全一致が浮動小数の0.14999999999999858を拒否。誤差許容1e-8へ修正し、物理値は変更しない。
- 73743c5e PASS46ms：投手後方と捕手の左右、左右打者の目の位置、近接面の線分切断、比較球自身の本塁通過時刻、同じ入力の再現性、入力非変更。
- bd0a66f8 BUILD PASS2.421秒。新しい--pitch-viewsだけを追加するopt-in。旧flagの意味を保持。
- 2192438d BROWSER PASS11.218秒：PC1200／390幅×直球／カーブの4ケース。全4図に実球と比較球が描画、左右の図が異なる、拡大切替でSourceとroster不変、球変更で旧図を消去、overflow／例外／外部通信0。画像views-1200.pngとviews-390.pngも目視確認。

[機械結果](pitch-views-check.json)。Maker SHA256 `b4819d2617d1bd46e211ebc1726ae77570a26d6b80384db05aea1a3ea8edb66f`。Core `c38ebb1ceaf4af48b91e053d7f9d80bab5c4287b9907fbd2f20bc30037438a5f`／89 Source入力、元の投手UI・CSS・通常renderer・初期roster・実測clipはv78 metadataと一致。TypeScript／試合物理を変更していないため、今回の検証は図と統合境界へ限定し、新しい9回試合の実行とは呼ばない。

固定視点での軌道比較。Native認証、63コース、シーズン成績の実装を追加した記録ではない。原Charter HOLD、元の未完と原FAILを保持。ローカル成果物のみ。

CCG audit4a0b7da3 FAIL328msは、原Charterの独立承認receipt不足CHARTER_UNAPPROVEDの1件。旧handoff警告を保持。製品の図の検証とは別の記録で、AIによるCharter自動承認は行わない。
