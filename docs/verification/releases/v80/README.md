# v80 球種メニューの検証

- [最終ブラウザ結果](base-side-final/report.json)／[receipt](../../../ai-continuity/verification-receipts/MB-20261020-V80-BASESIDE-FINAL-BROWSER_b3c6d71858954283b3dbc7b15af45423.json)：22.733秒、1200/390px×右/左投げ。24候補が重複・欠損なく分類され、タブ中も所持球7球を維持。全24例追加後31球、同種追加後32球が個別IDで残る。全例の保存値・SVGを共有spinと照合。閲覧時のroster不変、追加時は選手レパートリーだけ変更、dirty拒否と入力保持、JSON往復、試投と4図、Enter/Space/矢印キーとfocus保持を確認。例外/外部通信/横overflowなし。
- [v79コース・シーズン回帰](course-regression/report.json)／[receipt](../../../ai-continuity/verification-receipts/MB-20261020-V80-COURSE-REGRESSION-BROWSER_97aa7bee52af400a8ec2d9a9b7497e56.json)：17.250秒、現HTMLのPC390、実320球の再読、H/AB/HR/pending/色、dirty/JSON、同条件試打等を確認。
- [配布照合](release-check.json)／[receipt](../../../ai-continuity/verification-receipts/MB-20261020-V80-PITCH-MENU-PACKAGE_490b2ac8091a4bfdba6695af3c41f435.json)：Core93pins、元UI/renderer/能力/資料のhashをv79と照合。v79凍結配布物は不変。今回TypeScript/Coreは変更せず、実行した検査はブラウザJSと配布照合。

最初のブラウザFAIL afa30aa3は、左投げの数値-0をJSON保存の0とstrict比較した検査側の問題。JSONの正本として比較する修正後に通過。中間NAMES-BUILD349b/NAMES-BROWSER2ab8は編集script失敗前の旧名称artifactに対応し、一塁側/三塁側の証拠として使わない。最新の名称とfocus修正はBASESIDE-FINALのartifact hashに対応する。原receipt/reportは保持する。

現在の15分類・24設定例が対象で、世界の全呼称・独立した物理モデルを網羅する意味ではない。物理・能力校正・100試合分布・実機・Native公式認証と元計画の残件は今回変更していない。GitHub公開はこの追加依頼へ推定せず未実行。
