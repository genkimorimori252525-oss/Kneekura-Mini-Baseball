# 最新の再開入口 — 2026-10-21

最新v87：[3つのHTMLと操作](../demos/releases/v87/README.md)、[設計・直接承認](../design/2026-10-21-v87-course-display-perception-proposal.md)、[実装計画](../superpowers/plans/2026-10-21-v87-course-display-perception.md)、[検証・原FAIL・限界](../verification/releases/v87/README.md)。公開状態は同検証フォルダーのpublication.jsonを確認する。以下の旧「最新」は当時の履歴。

人間用の打率は中央9＋周囲4区画、内部認識は元画像の形の63区画。打率と認識を独立schemaにし、旧JSON/成績を保持する。入力preview・保存取消・方向の割合・MLB2025比較・3役認識と監査ログを接続。通常9回343球/123守備＋別seed54球/23守備の全field完走、保存往復を確認。メーカー/通常/labの新Coreを一致させ、673軌道・20選手・v86入力復帰・v84描画設計を維持する。

2025MLBは公式H/ABの比較用で、選手設定を上書きしない。未知10H/63ABは別枠。13↔63は面積加重近似で原63を保持し、独立の認識データに転用しない。実機/100試合/Native認証/空力校正/実FPS残件と元Charter HOLDを引き継ぐ。既存branch/Draft PR380へ保存し、mainへmergeしない。

v81保存・公開照合完了：製品`1f2155fd4c7241ca627dca53d288f28478c94654`、PUBLICATION `98f88599` PASS（134 Source Git blobs/raw9ファイル/size）。指定設計branchは文書のみ`a71c017d085bb6213a1facfc6eee6aba17723d78`、AI-INDEX/PLAN-REGISTER/原性能計画から標準規約へ到達可能。既存Draft PR #380で継続、main未merge。以下の「公開前」「ローカルのみ」は当時の履歴。

最新v81：[3つのHTMLと操作](../demos/releases/v81/README.md)、[恒久性能標準](../performance/PERFORMANCE-STANDARD.md)、[最新計測と採否](../performance/2026-10-20-v81-lossless-results.md)、[検証](../verification/releases/v81/README.md)。通常/調整室/メーカーの同時刻画素、9回320球＋別seed82球の全記録一致を確認。全673軌道、PNG/4px、v80方向UIを維持。次版はv81 builder/共通moduleを継承する。初回起動コスト増・実機未検証は明記。公開commitは後続の公開照合へ追記。以下の各時点の記録は履歴として保持。

最新ローカル追加：[v80 球種の方向別メニュー](../demos/releases/v80/README.md)。所持球常設、15分類24候補を一塁側/三塁側等で選択、矢印維持。PC390×左右と既存シーズン回帰PASS。v80はローカルのみ、GitHub公開済み基準は下記v79。

製品 `6b7e1eff4281784847bff1e457f0cd302e7dd911` を既存Draft PR #380へpush済み。PUBLICATION `b77b9377` PASS：remote/PR head、3HTMLのGit blob/size、raw9ファイルを製品commitで照合。後続の公開記録commitは製品Sourceを変更しない。

最新追加は [v79 — 63コース・シーズン成績・方向配分](../demos/releases/v79/README.md)。[相談用仕様](../design-consultation/course-season-v79.md) と [検証索引](../verification/releases/v79/README.md) を参照。人間が公開9=zone内、シーズン選択/試合蓄積/練習/締め保存まで承認。V78.1の4方向投球図も継承。ローカル記録とNative公式認証は別で、判定不足はpendingのまま保存する。以下は各時点の履歴として保持。

ローカルのメーカー追加版：[v78.1 投球の多方向比較](../demos/releases/v78.1/README.md)。投手真後ろ／捕手正面／左右打者を追加。物理・元UIはv78のまま、PC390pxと同じSourceの不変を確認。v78.1単体の当時の状態はローカルのみ。63コースの確認待ちは解消し、v79へ実装。

最新のローカル成果物は **通常試合v78／調整室v78／メーカーv78**。球種・保管庫・縫い目空力・俯瞰投影を実装し、Core／物理／型検査と最終HTMLのメーカー・表示・得能回帰はPASS。**新球種を含む最終HTMLは262球／105打球・守備処理で9回完走。GitHub公開照合2e0f0832 PASS、製品`8b4bc90905dc5708f3181959dd8657552e344b75`を保存済み。** 公開済み基準はv77製品`c9371bd`／PUBLICATION `c2733f14`。既存branch `jolly/tbd-lad-native-browser-core-2026-10-14`、[Draft PR #380](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/380)で継続し、mainへマージしない。

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

通常／調整室の最終4c113518 PASS258.359秒。全守備complete、fallbackなし、所持球限定、基礎不変。Sourceと成果物hash開始終了一致。同一loaded rosterでのsession再生を確認。配布26cbcaa1 PASS：Source union129、旧242凍結物不変。3HTMLのGit blob／sizeとraw9ファイルが公開commitと一致。以後のcommitは公開記録のみ。100試合分布・実機・実測校正・Native認証連続world、残る技術・牽制／盗塁・心理／疲労等は元の全計画から継続する。新外部依存・設定・lockfile・secretを追加変更せず、ユーザー編集`AGENTS.md`、原Charter HOLD、旧FAIL／UNKNOWNを保持する。

[持球野手の自力踏塁の確認](../verification/2026-10-20-held-base-control/README.md)はv73／v76の既存機能を実証した記録。通常設定での選択頻度の妥当性まで確認したものではない。
