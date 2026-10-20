# v68 メーカー実ブラウザー検証

検証対象HTML SHA256: `ed10241a66c31b90a177adc17b7a59150b7c92a60150594b6dddc7cb934ab949`。
checker: `tools/browser-bridge/check-maker-v68.mjs`。開始・終了でHTML、Core入力、UI／追加UI／help／CSS／実測library／decoderのSHAを照合した。製品コードをテスト都合で変更していない。

最終 **PASS 16.702秒**、receipt `MB-20261019-V68-MAKER_e1fadaea46554e2a9850870f440cae80.json`。起動確認は **PASS 2.750秒**、`MB-20261019-V68-MAKER-SMOKE_b8769b1d34e24cbd8229fb537b742be7.json`。

## 確認した範囲

- Chrome1200px／390pxで、初期20選手の全SI・得能・Sourceをv62ロスターと完全照合。全選手を閲覧しても不変。右495本／左178本の全候補を本人の左右に従って表示する。
- 追加661本から左右各1本を実UIで選択し、元軌道＋弾道1〜4、7時刻、4段階選択を独立したNodeの共通Core計算と比較。合計560標本が一致。局所区間外は元軌道と完全一致、打点pivotは不変。独自角度17度も一致。
- 不正31度は受理済み17度へ戻り、packet／Source revisionは不変。未知clip・反対側clip・不明設定キー・段階5・元データ外の窓を通常JSON／全体JSONから原子拒否。
- G〜Sの全境界、数値範囲外／未算出を確認。選球眼90=SがMLB／NLB／NPB／KBO／CUSTOMの切替で不変。
- helpは600msで非表示、計1100ms後に表示。クリックと390pxの実tapは即表示、Escapeで閉じ、説明文は選択肢全件を取り込まず画面内に収まる。
- 3方向canvasの実バット／軌道色pixelを確認。実JSONダウンロード、file input再読、ページreload後の初期値、全体設定の再読込を検証。横overflowなし、page error／外部通信0。
- desktopと390pxの画像を目視し、明るい配色、説明と入力の対応、3方向のバット／軌跡を確認。390pxは実スマートフォンの証明ではない。通常試合／9回完走の証拠は別工程。

## 原FAILの分類と保存

| receipt末尾 | 原因 | 修正／証拠 |
| --- | --- | --- |
| `880e4c86e9014746a0f48ca0da2e37f4` | Core編集中のため、HTMLの入力pinと現在Sourceが不一致。ブラウザー未開始 | pinを緩めず、Core凍結後の再buildを待った。原本`maker-v68-failure-1792407056961.json` |
| `f000aa28b0234b5ca662f63437b6aef8` | checkerが閉じたリーグ比較detailsのselectを操作 | checkerでdetailsを開く実操作を追加。原本`maker-v68-failure-1792407319129.json` |
| `952a54af118e498f84ab499281ba1237`／`7f04f089a9594eb3abf00c0c96b352c4`／`f54dcd48b4cb4e6ea99196a605711dc1` | angle inputへsynthetic changeを送り、後のfocus移動でnative changeが再発火するテスト操作のrace。選球眼の対象DOMが差替わり、fillが受理されなかった | Core直接編集は90、input handlerあり、正常statusだがinput event採取は0。checkerを実ユーザーと同様の`fill→Tab`へ修正し解消。製品は不変。原本`maker-v68-failure-1792407359906.json`／`1792407407945.json`／`1792407466808.json`を保持 |

## 主なproof files

`maker-check.json`は最終全結果、`smoke-check.json`は起動結果。`edited-roster-1200.json`／`edited-roster-390.json`は実保存した編集例。`maker-swing-1200.png`／`maker-swing-390.png`は比較欄、`maker-v68-1200.png`／`maker-v68-390.png`は実画面。原receipt／実行logは`docs/ai-continuity/verification-receipts/`に保全する。

最終レビューでは、この試験範囲に出荷を妨げる未解決項目は見つからなかった。実測libraryの全673本の原資料照合・Core全段階試験・通常試合との接続は、それぞれ専用の証拠に依存する。
