# v75 メーカー実ブラウザ検証

最終実行は [21936d38 receipt](../../../../ai-continuity/verification-receipts/MB-20261020-V75-MAKER-BROWSER_21936d382c3a4f928c071255cba745a9.json) の PASS（35.359秒）。対象HTMLのSHA256は `453490f4038ca76b16d7b2630650ee810f35c8bc5b6585490581853dd7cb959a`、Coreは `008d2b361e3b592d10e3eee52b6c787464ff6dfad86472c0c847c1601dfe9b09`。読込前後に全Source pinとHTML SHAを照合した。

[checker](../../../../../tools/browser-bridge/check-maker-v75.mjs) はChromeの1200px・390pxで、旧7系統APIの維持、新13系統の表示、初期20選手の不変、技術6系統の全段階（走塁8段階）と効果0/1/2の編集・再読込、段階と倍率の相互保持を確認した。空・2.1の入力はaccepted rosterを変更せず、全JSON・通常試合用JSONの実ダウンロードと比較計算を拒否し、再入力で復帰した。

OFFと0倍のruntime sourceが存在しないこと、全20選手のphysicalが元値と一致することを確認した。これは通常試合の全イベント列が一致する検証とは別で、通常Hostの検証はこのcheckerの対象に含まない。

比較ではバント技術1.5・低め制球技術1.25が実Core入力へ渡り、4段階を計算できた。全JSON・通常試合用JSONを実際にダウンロードし、両ファイル入力から復元した。選択2選手以外の18entryと元測定データも一致した。既存v74の全幅比較・タブ同期を維持し、PC比較1160px／canvas900px、390幅で366px／318pxを確認した。ページ例外・外部通信・横はみ出しは0件。スマートフォン実機や経験的な技術効果の校正は検証していない。

[maker-check.json](maker-check.json) に観測値、`authored-1200.json`・`authored-390.json` に実保存値、`traits-*.png`・`comparison-*.png` に画面を保管する。390幅の得能画面は目視でも確認した。

独立レビュー後、公開resolverの入力を既存のstrict profile parserへ通す修正に合わせて再実行した。unknown family・非対応version・sourceの余計なkeyは両viewportで拒否され、入力も変更されなかった。旧 [77b9454c receipt](../../../../ai-continuity/verification-receipts/MB-20261020-V75-MAKER-BROWSER_77b9454c4af044cab90b5878cdcd548d.json) の成功report・実保存値・画像・当時のREADMEは [before-strict-resolver/](before-strict-resolver/) に保持している。

初回 [21a506d5 receipt](../../../../ai-continuity/verification-receipts/MB-20261020-V75-MAKER-BROWSER_21a506d5678b4b9f878d6b5fdc9944aa.json) は、従来から検証しないsnapshot getter `getState()` がpending時にthrowするというQAの誤った期待によるFAIL。`maker-v75-failure-*.json` と原receipt/logを保持した。製品変更は行わず、accepted snapshotの維持と実export handlerによる保存拒否を確認するようcheckerだけを修正した。
