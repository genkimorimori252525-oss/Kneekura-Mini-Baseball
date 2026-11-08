# v51 — 野手間の回避と間隔

野手の交差経路を共通の減速・回避へ接続し、確定したSourceで通常HTMLの規定9回まで検証した。[通常HTMLとメーカー](../demos/releases/v51/README.md)。元の全計画はIN_PROGRESS。

## 観測と原因

v49の守備責任と目的地の分離は残っていたが、身体の移動を各選手が独立計画していた。目的地が離れていても、途中の経路は交差する。

旧Sourceの正式9位置・20局面×3能力段階で、身体の代理直径0.48m未満を3件確認した。

| 能力段階・局面 | 対象 | 観測した最小中心間距離 |
|---|---|---:|
| low / slow_roller_3B | 投手backup・一塁cover | 0.329154m |
| default / 1B_routine | 一塁保持・二塁cover | 0.397668m |
| default / fast_grounder_CF_wall | 左翼tag・二塁cover | 0.473866m |

旧通常試合の保存最終frameにも、HR後のLF/RF中心間距離0.062294mがあった。旧14分類0は野手間非貫通の証明ではなかった。60局面内では「3人が互いに2m以内」の密集は観測されず、合法な近い受渡しと身体の重なりを区別する。

## 共通処理の変更

全野手の同時刻の位置・速度から、既存の目的地へ向かう希望加速度を先に作る。次に全員の身体指令を調整し、その確定後にグラブを計画する。捕球／保持、実送球の受け手、処理担当、tag、cover、中継、backupの順に仕事の優先度を使う。

個人の加速度・最高速度・反応条件と既存の球場制約を守り、減速・横回避の有限候補を比較する。位置押し出しや速度の即時変更は行わない。脅威のない希望指令は完全に保存する。公開11能力・詳細44項目と既存の戦術値を維持し、専用の能力項目やリーグ名による補正は追加しない。

身体は既存の半径0.24mの平面代理モデル。硬い表面間余裕0.02mと、柔らかい余裕0.35m／費用係数2は制御器の暫定値であり、実選手の校正値ではない。相対的な二次軌道の距離極値を連続区間で検査し、最大加速度による制動停止までの余地も調べる。描画55msを衝突判定の刻みにしない。

`FIELDER_BODY_OVERLAP`は実frameで宣言された身体直径未満を検出する。最悪距離・相手・時刻・両役割を残す。計画診断と実frameの観測を分け、回避指令の遷移と各選手のpreferred/brake/yield回数を試合JSONへ保存する。

## 検証と開発中の訂正

旧Sourceの3実入力をfixtureに保存した。非貫通だけでなく、速度・加速度上限、位置の連続性、プレー完了も同時に検査する。既存の最小アウト数・能力段階の単調性、走者・裁定の因果性を維持する。

先行候補の60局面PASS後、soft余裕の扱いを変更したSourceでは、最終273テスト中7件が失敗した。通常HTMLも5球目で停止した。実stepはまだ安全でも、次の計画で停止余地を回復できない例だった。独立した制動軌道の細分追跡で、静止に近い選手の1e-17秒程度の制動時間が区間終端への加算で丸められ、分割境界から消えることを特定した。sample側だけが微小な制動相の加速度を返し、次の長い区間へ延長して、存在しない退避を安全証明へ混ぜていた。絶対の停止境界を判定する修正と微小残留速度の回帰を追加する。候補版のPASSを最終版へ移し替えず、原FAILと入力を保持する。

最終Sourceで31ファイル・280テストPASS、正式9位置・60局面の15分類すべて0。既存の最小アウト数と能力段階の単調性は変更せず、アウト数13/18/20。全体TypeScript型検査PASS。メーカーは20選手／公開11／詳細44、旧JSONと最新HTMLへの取込を1200px／390pxでPASS。

- [最終関連試験のreceipt](../ai-continuity/verification-receipts/MB-20261018-V51-AI-FINAL_1116ab2d588c44048b6f8b02a6f2c237.json)（78.733秒）
- [最終型検査のreceipt](../ai-continuity/verification-receipts/MB-20261018-V51-TSC-FINAL_50e1326e399e49a3a5452af4beafb0eb.json)（39.608秒）
- [微小制動の先行RED](../ai-continuity/verification-receipts/MB-20261018-V51-SUBULP-BRAKE-RED_272184c0eb2e4f669bb10a0ea6e62a74.json)／[23単体試験GREEN](../ai-continuity/verification-receipts/MB-20261018-V51-SUBULP-BRAKE-GREEN_706fa2ba0d064e2e92607e2f737287f6.json)
- [最終メーカーのreceipt](../ai-continuity/verification-receipts/MB-20261018-V51-MAKER-FINAL_956af8c03c8b44589c69300ff5360f7d.json)／[実行結果](../verification/releases/v51/maker/public-maker-check.json)
- [旧Sourceの測定](../verification/releases/v51/baseline/spacing-audit.md)／[最初の通常HTML停止の原入力・診断](../verification/releases/v51/initial-normal9-failure/failure-raw.json)

## 最終HTMLと通常試合

新しいCore108入力を再buildし、通常HTMLを実行。320球、9回表3アウト・ホームリードで規定終了（home46 / away10）、例外なし・旧結果fallbackなし。130守備プレー・17,820実frameで身体重なり0件、中心間最小0.500113299m。2m内の3人密集という観測指標も0。全指令の計画区間／終端制動で最小表面隙間0.020022583m。旧HR index82の最終LF/RF距離は0.062294mから0.500895mになった。これらは今回の試験範囲での証拠であり、全試合の最適性や成績分布の校正ではない。

実320球のJSON保存が、Sourceのfacts・裁定・診断・最終frameと一致することを検査。配球・ストライクゾーン・所持球非表示・5視点・ファウル復帰・プレー内容→チェンジ・能力取込を1200px／390pxで維持した。

カメラはv50の表示層に今回と同じCoreだけを埋め込んだ参照HTMLと比較する。実12球のSource／バット一致、6見逃しの停止、左右スイング終端+699/700msと495ms混合、他4視点24時点・巻戻しを確認。旧v50の異なるCoreとの一致を主張しない。PC・390pxの画像も視認した。

- [最終build receipt](../ai-continuity/verification-receipts/MB-20261018-V51-BUILD-FINAL_dfdb3465144c42ccaaef8a5e8ae993be.json)
- [最終通常9回 receipt](../ai-continuity/verification-receipts/MB-20261018-V51-NORMAL9-FINAL_a489b35521024a89b68f63d063ade30c.json)／[試合検証](../verification/releases/v51/game/game-check.json)／[実打席記録](../verification/releases/v51/game/normal-game-records.json)
- [最終カメラ receipt](../ai-continuity/verification-receipts/MB-20261018-V51-CAMERA-FINAL_4985820646e14a219a04e60dc8da30b6.json)／[比較と境界の実測](../verification/releases/v51/cameras/v51-batter-view-check.json)
- [配布包装 receipt](../ai-continuity/verification-receipts/MB-20261018-V51-PACKAGE_a98354ecb2fd4888ab78c30d331eca4a.json)／[108入力＋compiled bundle・manifestの110エントリZIP](../demos/releases/v51/tested-core-inputs.zip)

HTML SHA `9a2b4761d87b6c908dd51c969d5425a036870caf1f57b474e1113126b409a54e`。Core SHA `01f25940860caff6f9a92a9d8d11d876d87056ed173d8589374226f7c4eccd8f`。全108 raw Source SHA、ZIP全byte／CRC／SHAを検証した。v50カメラhelper `b5282910…`、既存field follower `f987a851…`、v47メーカー `78482281…` を保持。試験後に製品Sourceを改行変換していない。

## 継承と残件

v50のlv27打者カメラ、見逃し固定、実測スイング終端+700ms、既存の打球追尾、OpenBiomechanicsバット、UI・配球・間・アニメ、所持球非表示、4px/55msを維持する。通常HTMLはローカルHost＋共有Coreであり、Native SQLite認証された全体連続世界の完成とは区別する。

有限候補探索の失敗は「物理的に衝突が不可避」という証明ではない。初期から重なった配置を押し出して修復しない。発行区間とその終端からの制動余地を検査するが、任意の途中時刻から即時制動しても安全という一律保証はない。途中イベント後に新しい計画が証明できなければ、未確定として停止する。身体の衝突後の反発・転倒・全身形状や、全AIの大域最適性は未実装。公式H/E・残規則、全得能、共同走塁・中継最適化、返球／再整列／全身とバット反動、実選手SI・成績分布・最新100試合以上・実機スマートフォンも元計画の残件として保持する。Charter外部承認不足のHOLD、過去FAIL/UNKNOWNを保持し、元の全目標はIN_PROGRESS。
