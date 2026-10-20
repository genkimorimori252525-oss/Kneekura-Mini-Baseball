# v81 検証索引

各reportのartifact SHAと[配布hash](../../../demos/releases/v81/SHA256.json)を照合する。数値の正本はreportと`docs/ai-continuity/verification-receipts/MB-20261020-V81-*.json/.log`である。

|対象|正本|結果|
|---|---|---|
|通常144場面、RGBA/名前/Core一致|[scenes-final](scenes-final/report.json)|PASS|
|調整室60場面、A/B同期・再読|[lab-final](lab-final/report.json)|PASS|
|メーカー64場面、実試打・試投|[maker-final](maker-final/report.json)|PASS|
|9回320球＋別seed82球・全JSONhistory一致|[全履歴比較](full-history-v81-comparison/report.json)、[旧版基準](full-history-v79-baseline-r2/report.json)|PASS|
|球のみ独立更新を廃止、RAF提出測定|[RAF](raf-cadence/report.json)|PASS|
|同条件の描画時間の再比較|[基準](fair-base/report.json)、[新版](fair-final/report.json)、[集計](performance-summary.json)|PASS|
|24候補・左右・dirty/JSON・矢印|[球種UI](pitch-menu-corrected/report.json)|PASS|
|多方向投球図/Source不変|[投球図](pitch-views-final/pitch-views-check.json)|PASS|
|独立17得能・公開基礎不変|[得能](traits-final/traits-check.json)|PASS|
|63コース・成績・練習/締め・JSON|[コース](course-final/report.json)|PASS|
|134 Source入力と3成果物の一致|[配布](release-check.json)|PASS|

通常のVitest入口で4suite27件PASS（1af3ab2a）。初回node:test登録がVitestに検出されsuiteなしで失敗したため、Vitestへ統一して修正。原REDは保持。局所試験はrenderer6、UI5、cadence8、adapter8、clipcache関連14（既存9回を含む）、実673軌道検証、型検査。検証範囲は各receiptのcommand/logを参照する。旧lv76のPASSをv81へ付け替えていない。

原失敗も保存する。初回存在しないfielderボタンは`PERFORMANCE-BASELINE`、cache初回未実装は`CLIP-CACHE-RED`系、CSSOM補正は`UI-PERF`系、混在改行は`CADENCE`系、存在しない1回optionは`FULL-HISTORY`初回、旧Core hash guardは`PITCH-MENU`初回。修正後の証拠と混同しない。

全てChromeの仮想1200/390pxであり、実機/熱/電力/オンラインはUNKNOWN。Native認証、全100試合、成績/係数の実測校正、元の全機能の完成証拠ではない。Charter独立承認HOLDと原FAIL/BLOCKED/UNKNOWNは保持する。

CCG auditは`CHARTER_UNAPPROVED`によりFAIL（a818f43e）。元の独立承認不足と旧handoff警告を保持し、今回の人間の実装承認で自動昇格しない。最初のstaging検査は既存65入力のGit改行差を検出したためFAIL（9a3e4521）。検証後のSourceを変更せず、Gitへ同じraw bytesを格納して修正する。
