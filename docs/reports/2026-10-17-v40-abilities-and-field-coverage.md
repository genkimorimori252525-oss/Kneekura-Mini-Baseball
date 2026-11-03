# v40 個人能力・守備カバー・メーカー統合

通常試合 v40、全20選手を編集できるメーカー、初期能力の一覧を作成した。前のUI・操作・投球／打者画像・カメラ・保持球非表示を維持し、確定したファウルの待機、個人SIの入力経路、汎用守備の担当割当を変更した。原計画全体の完了を意味しない。

## 配布物と使い方

workspace の `outputs/` に以下を保存した。

1. `ばせぼーるlv40_TBD_vs_LAD_個人能力と守備カバー接続版.html`
2. `にーくら野球メーカー_試合用20選手能力版.html`
3. `にーくら野球_20選手の初期能力一覧.html`
4. `にーくら野球_20選手の初期能力.json`

メーカーの選手作成タブで試合用選手を選び、共通／打者／投手の値を編集する。「試合用能力JSON」またはメーカー全体のJSONを保存し、試合画面の個人能力設定から読み込む。読み込みは次の新しい試合から反映する。試合途中の能力は変更しない。不正な値・重複ID・対象外選手・不完全な20人名簿は全体を拒否し、以前の設定を維持する。

既存の単体スイング実験・リーグ比較と、今回の通常試合用のSI名簿を区別した。旧保存JSONに新しい名簿がない場合は、メーカー内の現在の名簿を保持する。

## 実装

- `foul_dead_ball` という実際のプレー終了を確認したときだけ、終了後1500msで次球へ進める。単にファウル方向へ飛んだだけでは停止しない。捕球できるファウルフライは通常の捕球・裁定へ進む。
- `LivePhysicalRosterV1` が、個人SIと既存WorkbenchPlayerの対応項目を検証してHostへ渡す。未対応項目は監査に残す。リーグ名・選手名・相対能力値を結果の倍率にしない。
- 最大／目標の芯速度、運動開始遅延、狙い時刻・位置の誤差、上向き／引張り角、芯位置、窮屈な体勢での制御、打撃積極性を実際のバット運動・判断へ接続した。参照区間の変更後も、描画は実際の `referenceContactTick` を使う。
- 守備の判断遅延、移動・グラブ・持替・送球の値を実動作へ接続した。送球方向誤差はリリース初速を回転させ、続く飛行と接触で結果が生じる。成功率やアウトを後から変更しない。明示された世界座標のスピンは勝手に変更しない。
- 守備は守るべき塁と送球レーンを全体で割り当てる。同一塁への二重割当、送球担当を奪った後の空白、全員が球の周辺へ集まるbackupを改善した。現在速度・加速制約による到達時間、走者の脅威、担当を継続する費用を使う。担当点への瞬間移動は行わない。
- 投球記号6%、捕手の打球追尾1〜2秒→俯瞰→次球で捕手、具体的なアウト理由、プレー表示後の「チェンジ（3アウト）」はv38から継続した。公式H/E採点がないプレーを勝手に安打にしない。

## 数値の出典と意味

全20選手の個別SIは、人間が選択した暫定設定である。ティカオの最高151km/hは以前のユーザー設定を維持した。その他の数値は実在選手の実測値とは表示しない。ちんすけ等の強打者には目標芯速度・最大速度などで個性を設定したが、本塁打や安打の結果は保証しない。全39項目を一覧とメーカーに登録した。

参考にした[Baseball Savantの指標定義](https://baseballsavant.mlb.com/statcast-metrics-context)では、競技的スイングの平均速度や短区間の走速度が扱われる。これらを個人のモーター最大値・一定走速度と同一視しない。[CSV仕様](https://baseballsavant.mlb.com/csv-docs)の2次元スピン軸だけでは3次元角速度を確定できないため、今回は明示的な暫定3成分を入力した。fastballの基準回転は、現在の飛行方向に対してバックスピンになる正のX成分を持たせた。他球種は現在のCoreの球種別軸を使う。

バット参照は[OpenBiomechanics](https://github.com/drivelineresearch/openbiomechanics/tree/main/baseball_hitting)の実測研究データを継続使用した。匿名の研究軌道を、実在選手本人の測定フォームとは扱わない。元JSONのSHAは `72b615a28cd99b4a91c6e52cb02ee35f4ff97850c3bfe71ca73d0e609ba480ef` のまま。MMDへ戻していない。

守備の調査では、Sam Piraroの[ABCA Cutoff and Relay System](https://www.abca.org/magazine/magazine/2020-4-July_August/The_Hot_Corner_Execution_of_the_Cutoff_and_Relay_System.aspx)、[USA Baseball Covering First](https://www.usabaseball.com/video/monday-manager-covering-first-x1874)、[Baseball Positiveの守備責任](https://baseballpositive.com/defensive-responsibilities/)を確認した。走者・送球レーン・受け手・後方カバーの考え方を参考にした。動画全編を観察したとは主張せず、小学生向けの状況表をそのまま分岐にしていない。外部コードはコピーしていない。

## 検証

- 個人能力・参照軌道・既存投球・記録回帰：5ファイル59 tests PASS（receipt `979148571ac4485ba8fe645f57e2a09b`）。対象strict型検査もPASS（`e1b07e0386874a259a6158d9e2a7db35`）。
- 守備担当・実送球・既存2アウト連続プレー：5ファイル42 tests PASS（`ce17d5c79a234c13bc7a0ba320b54cf2`）。初期の到達予測変更で既存ゴロがsafeになった回帰は、予測変更自体を戻して修正した。元の期待値や失敗ログは保持した。
- リポジトリ全体 `tsc --noEmit` PASS、50.280s（`44f8b6c92e8d4faea4779180081a6a12`）。
- 通常HTMLの新Sourceで443球、9回表で試合終了、141.405s（`5d7b0c3b176e42b793f451225df668de`）。ホームがリードしていたため9回裏なし。17半イニングの3アウト表示、実ファウル終了＋1500ms、20人のSI、左投手の実リリース、ティカオの151km/h上限、1200／390px同じ8球の記録ハッシュ、正常／不正JSONの状態保持と新試合反映を確認した。全443球のcompact記録は `outputs/verification-v40-game-v1/normal-game-records.json`（workspace outputs）に保存した。Source例外0、旧計算fallbackなし。
- メーカーは1200／390pxの両方で全20人×39項目を照合。編集／JSON往復／入力拒否／他19人保持／単体スイング実験の分離を確認した。最終の接触半径ラベル版は5.358s PASS（`f8969b75c0f042aa9e7574e484ef17df`）。これはデスクトップChromiumの幅変更であり実機スマートフォン検証ではない。
- 初期能力一覧も780値、選手検索、JSON保存、ページ横はみ出しなしを1200／390pxで確認した。JSONはメーカー・通常試合の初期データと同一。

最初の9回検証後に、catalogの表示名を「捕球ポケット半径」から「グラブの接触半径」へ訂正した。実際の接触半径と、別の保持pocket半径を区別するための表示だけの変更である。Core102入力・能力JSONは変更していない。最終ビルドreceiptは `0c2fda9ac54b480d88fea1080a6fa1f3`。

最終HTMLの限定UI検証は16.108s PASS（`5d50ae541733485f850e61ec2489c838`）。1200／390pxそれぞれ実9球を計算し、最初の8球が9回検証時の保存ハッシュと一致した。映像／配球図の記号alphaは1→.06→.06→1、ストライクゾーン維持、捕手が実球を1.5154377s追尾して俯瞰へ移り、autoOFF時は捕手を維持し次球も捕手へ戻ることを確認した。5視点で保持球0、moundのretro／pointで画像bat表示・Core bat overlay0・立っている打者の名前0、エラー／外部リクエスト0。`outputs/verification-v40-final-prefix-v1/game-check.json` に保存した。

最終能力一覧は `outputs/verification-v40-roster-list/check-final.json` に、最終HTMLのSHA、780値・新ラベル・検索・保存JSONの両幅での確認を保存した（direct browser execution、runner receiptなし）。対象変更の `git diff --check` もPASS。

## 固定した成果物

| 対象 | SHA-256 |
|---|---|
| 最終v40 HTML | `f2799db8b2d0109ebc4be79882a850a0801dbd5859b6cc1c241866b9b7b5223d` |
| 最終メーカー HTML | `eb9dd309ef5ce812588d688bd1b439947a45131fa0aef714614b04c22ec1a63a` |
| 初期能力一覧 HTML | `7e83a7a2a7022f4a742c25ed07abcc2f11d9e4c2b1494ed1c778a8073730d83f` |
| 初期能力JSON | `998effb128bce728e957c660da1ea4d6cac450a88d8937ef3cb13e530ffcefb3` |
| catalog JSON | `043802be7414b7e58a84e827d2b99458f5ff2f79a88a6fabbbde7352e0639de9` |
| Core browser bundle | `88a6fad8ff969c3d6cb382772453f40af00db5d281d3a9b9f78eab164c8164c7` |
| 102入力manifest | `f9ba05052e3df4e460086185fa0bd276badef06a5cf61668e2ca557b3c1ee1e7` |

実際の102入力・bundle・能力JSON・catalog・元実測JSONを workspace `work/v40-individual-core-v1/` にコピーし、全SHAを再照合した。以前の97入力は `work/v39-before-abilities-core/` に残した。古いSourceの100試合結果を今回の新Sourceの検証とは扱わない。

## 主な変更ファイル

- Core: `src/core/sim/contact/ReferenceBatKinematicsV1.ts`、`src/core/sim/fielding/LiveFieldPlayV1.ts`、新規 `LiveFieldRoleAssignmentV1.ts`／`LiveThrowDirectionV1.ts` と関連tests。
- Host: `src/integration/browser/LivePhysicalRosterV1.ts` とtests、`LiveBaseballMatchV1.ts`、`LivePitchV1.ts`、`LivePitchAbilitiesV1.test.ts`、`index.ts`／`workbench-index.ts`。
- データ／メーカー: `docs/demos/live-game-roster-v1.json`、`live-game-roster-catalog-v1.json`、`baseball-maker.html`／`baseball-maker-ui.mjs`。
- HTML統合: `tools/browser-bridge/v39-live-*`、`v40-live-*`、`build-v39.mjs`／`build-v40.mjs`、`build-maker.mjs`、`build-live-roster-list.mjs`、関連browser checks。v38表示改善のファイルは別のv38報告を参照。

## 残る範囲

今回の39項目は「現在のローカルHostが受け取る個人SI数値」である。全ゲームの全得能の完全接続ではない。旧 `traitLabels`／`traits.labels`／`legacyRelativeRatings` は未接続として監査する。悪球への制御SIは接続したが、旧「悪球打ち98」という名前・数値そのものを成功率へ変換していない。体重・全身のload／finish角・handTravel、clipId選択の通常試合メーカー接続、固定のpocket半径／失敗材質／送球backspin等は未完。身長による打撃ゾーンは変化するが、投手リリース高や全身体形状を身長で完全に再構成する実装ではない。

守備の衝突応答・受け手の捕球姿勢・常に成功する中継は保証しない。全身のNative認証された連続世界、投球間の返球と整列、バット反動／落下、公式H/E採点、infield-fly／appeal／HBPなど一部裁定、今回の新Sourceでの100試合記録監査、実機スマートフォンは未完。能力／AIを直した後の成績分布校正は次工程である。今回1試合は35対52、HR15、BB25であり、現実の成績分布を再現できた証拠ではない。

依存関係・設定・lockfile・secret・DBを変更せず、reset／push／main mergeはしていない。既存CharterのHOLDと全FAIL／UNKNOWNは保持した。
