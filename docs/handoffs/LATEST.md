# 最新の再開入口 — 2026-10-20

現在は **通常試合v76／調整室v76／メーカーv76**。既存branch `jolly/tbd-lad-native-browser-core-2026-10-14`、[Draft PR #380](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/380)で継続、main未マージ。

- [HTMLと表示倍率の説明](../demos/releases/v76/README.md)
- [今回の原因と修正](../reports/2026-10-20-v76-air-ground-display.md)
- [検証索引・原FAIL](../verification/releases/v76/README.md)
- [v75技術得能の実装と未完](../reports/2026-10-20-v75-technical-traits.md)
- [元の全要求・計画](2026-10-15-mini-baseball/00-START-HERE.md)

空中倍率がゴロの浅い跳ねにも作用したv67helperを修正。球底0.5mまで元サイズ、0.5〜1.5m補間、高空倍率2以上は旧表示exact。1〜2も最小表示点の不連続を解消。全体俯瞰倍率は従来通り全自由球へ作用。初期1/1/2、旧設定JSON、グローブ内非表示を維持。

v75の技術13系統と効果0〜2、能力100超のメーカー編集、673実測フォーム、カメラ、試合進行は継承。Native117/Maker84/union124入力とbundlebytesは不変。1200/390の3renderer・低球1/2/8サイズ/RGBA・高空旧表示・設定/session・実6球Source/camera/field/bat一致を検証。今回新9回・TS・実機は再走せず、v75の実検証を保持する。

残る技術・心理・故障・盗塁・身体ブロック/こぼれ球・100試合分布・実機・Native連続world等はCURRENT/原全計画から継続。ユーザーAGENTS編集を除外、原CharterHOLD/旧FAILUNKNOWNを維持。全計画の完了とは扱わない。
