# 最新の再開入口 — 2026-10-20

最新のローカル成果物は **通常試合v78／調整室v78／メーカーv78**。球種・保管庫・縫い目空力・俯瞰投影を実装し、Core／物理／型検査と最終HTMLのメーカー・表示・得能回帰はPASS。**新球種を含む最終HTMLは262球／105打球・守備処理で9回完走。GitHub保存の最終照合は準備中。** 公開済み基準はv77製品`c9371bd`／PUBLICATION `c2733f14`。既存branch `jolly/tbd-lad-native-browser-core-2026-10-14`、[Draft PR #380](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/380)で継続し、mainへマージしない。

- [他AIへの設計相談入口](../design-consultation/README.md)
- [v78 HTMLと操作](../demos/releases/v78/README.md)
- [v78の変更・原因・検証・限界](../reports/2026-10-20-v78-pitch-library-and-seam-physics.md)
- [v78検証索引・原FAIL](../verification/releases/v78/README.md)
- [縫い目空力の一次資料と作者近似](../research/2026-10-20-seam-force-v78.md)
- [歴史とH52](../history/INCIDENTS.md)
- [元の全要求・計画](2026-10-15-mini-baseball/00-START-HERE.md)

15分類＋9派生の24設定例を左右で生成・検証する。世界の全呼称を固定網羅したとは扱わない。新設定例だけを投げる腕に応じて生成し、既適用snapshot・オリジナル球copy・旧7球移行のworld vectorは勝手に反転しない。保管庫は版履歴、選手は選んだ版の完全な数値コピーを持つ。後日の保管庫編集は適用済み選手へ波及しない。

投手詳細の`minimumSpinRatio`は80%なら基準1000rpmの800〜1000、98%なら980〜1000、100%／省略なら固定。名目spinと平均空力で投げ出しを計画してから実回転と縫い目力をSourceへ渡し、同じ投球の失敗を予知補償しない。新しい公開能力は増やさず、初期20人と独立17得能を維持する。

共通の縫い目形状と絶対材質姿勢を自由球の各境界へ通し、同じCore／通常rendererで観測する。力の角度関数は実験へfitしていない作者近似で、実測成績の校正ではない。俯瞰は直径の掛け算ではなくサイズ計算時の仮想高度を投影し、2m×設定2＝4m×設定1。実画面位置・物理・他視点・接地球は維持する。旧保存方式を黙って新しい意味へ読み替えない。

メーカーは人間／AIの同じvalidatorを使い、全体JSON・保管庫JSONの実download／file再読込、明示端末復元、不正入力の原子拒否を検証済み。未保存の編集は保存または明示取消まで切替・読込で破棄しない。通常HTMLへの選手設定は新しい試合から適用する。

主要receipt：Core `b23f36bf`（13files115tests）、逆算順序 `bc1df778`（5files20tests）、物理 `930d9425`（13files83tests）、TSC `23b5977c`、最終メーカー `55b95a26`（28.328秒）、俯瞰 `987a813f`（18.186秒）、17得能 `72b98e4c`（7.858秒）。Maker89／Native122入力の開始・終了hashと終端pinを確認。具体SHA、原FAIL、修正前候補の証拠は上記報告と索引から読む。v77の9回結果をv78の実行済み証拠として流用しない。

通常／調整室の最終4c113518 PASS258.359秒。全守備complete、fallbackなし、所持球限定、基礎不変。Sourceと成果物hash開始終了一致。同一loaded rosterでのsession再生を確認。配布26cbcaa1 PASS：Source union129、旧242凍結物不変。次はGitHub公開照合。100試合分布・実機・実測校正・Native認証連続world、残る技術・牽制／盗塁・心理／疲労等は元の全計画から継続する。新外部依存・設定・lockfile・secretを追加変更せず、ユーザー編集`AGENTS.md`、原Charter HOLD、旧FAIL／UNKNOWNを保持する。

[持球野手の自力踏塁の確認](../verification/2026-10-20-held-base-control/README.md)はv73／v76の既存機能を実証した記録。通常設定での選択頻度の妥当性まで確認したものではない。
