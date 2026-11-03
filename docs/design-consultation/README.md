# 他のAIとの設計相談の入口

最初に[現仕様と責任分担](CURRENT-SPEC.md)を読む。実装の再開位置・公開版は[最新ハンドオフ](../handoffs/LATEST.md)、個別の不具合と解決理由は[開発史](../history/INCIDENTS.md)を参照する。設計案を実装済みと読み替えない。

相談に必要な資料は次の順で絞る。

1. ゲームの全体像・物理と描画・保存・既知の限界：CURRENT-SPEC.md。
2. [球種と設定例](../demos/live-pitch-catalog-v78.json)・[AI/APIの機械用一覧](runtime-contract-v78.json)：同じCoreから書き出す。名前と実際の物理設定は別の情報として扱う。
3. コース・シーズン・方向配分は [v79仕様](course-season-v79.md)、[承認設計](../plans/2026-10-20-v79-course63-and-spray-review.md)。球種の追加仕様：[v78設計](../plans/2026-10-20-v78-pitches-spin-and-overhead-review.md)。基礎能力と得能は[v77設計](../plans/2026-10-20-v77-traits-and-pitcher-lab-review.md)。
4. 動作の証拠：各配布版の検証索引・Source入力hash・原失敗。旧版のPASSは新HTMLの検証へ流用しない。

具体的な問題を相談する場合は、HTMLの版、試合seed、投球番号またはpitchId、作成選手・球種のJSON、カメラ設定、期待した動作と実際の動作を添える。現在の仕様と実測事実を分け、再現できない点はUNKNOWNのまま記録する。

将来の改善案は、まず「物理の力」「選手の意図と誤差」「守備走塁の判断」「裁定」「読み取り専用の描画」のどこへ作用するかを示す。公開能力へ得能を直接書き込む、画面だけで球を曲げる、守備結果を先に指定する提案は現方針と整合しない。

性能改善の相談は[恒久標準](../performance/PERFORMANCE-STANDARD.md)と[v81採否・実測](../performance/2026-10-20-v81-lossless-results.md)から始める。同時刻の画素/正史一致、起動と再利用の別計測、cache所有・失効契約を先に確認する。旧lv76実験を最新版で実証済みと扱わない。
