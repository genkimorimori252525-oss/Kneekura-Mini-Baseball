# 公開能力を主に編集するメーカー

人間の指摘どおり、v40は内部SI設定を前面に出していた。承認された「公開能力の主編集＋内部個性維持＋詳細の折畳み＋リーグ参考表示」に変更した。既存の2タブ・色・実測バット研究・20選手・JSON保存を維持する。以前のHTMLは上書きしない。

公開編集版は「選手作成」から開き、バット研究用のプレビュー列を非表示にして編集欄を全幅にする。「バット軌道」へ切り替えると研究画面が戻る。野手は共通＋打撃の9項目、投手は共通＋投球の7項目を主欄にし、副能力は閉じた「野手の投球能力」「投手の打撃能力」から編集できる。全11項目は保持する。

## 操作と反映

公開能力はミート、パワー、選球眼、悪球への技術、走力、肩力、守備力、捕球、送球精度、球速、制球の11項目。投手／打者／共通に分ける。公開編集の結果は関連する内部SIへ反映し、その現在値から毎回公開能力を表示し直す。公開値だけを別に保存しないため、詳細編集や旧JSON読込後の二重管理を避けられる。

「試合用能力JSON」を保存してv41試合へ読み込み、新しい試合を開始すると反映する。メーカー全体の保存JSONからの読込も可能。今プレーしている試合の途中で能力を変更しない。入力が不正なら編集全体を拒否し、他の設定と他19人の能力を保持する。

元の細かな項目は閉じた「内部能力の詳細設定」へ移した。コース判断の誤差を1項目追加したため40項目。球種、スタミナ、バント等の未接続項目を、機能する編集欄として追加していない。

## 能力と内部動作の対応

| 公開編集 | 変更する内部設定 |
|---|---|
| ミート | 狙い位置・タイミングの誤差 |
| パワー | 芯の目標速度・最大速度 |
| 選球眼 | コース判断に使う位置推定の誤差 |
| 悪球への技術 | 窮屈な体勢での制御 |
| 走力 | 走行最高速度・加速度 |
| 肩力 | 送球初速 |
| 守備力 | 初動遅延・判断遅延・持ち替え時間 |
| 捕球 | グラブ移動速度・衝撃の吸収と保持 |
| 送球精度 | リリース方向の誤差 |
| 球速 | 最高初速・基準初速（比率を維持） |
| 制球 | 投球の狙い位置誤差 |

グループ編集は、個人の明示SI基準を保ったlog品質差100点／自然対数単位という**作成用の暫定対応**を使う。誤差・遅延では明示offsetを持つ逆向きの品質、速度・吸収量では正向きの品質を使い、同グループを同じ品質倍率で動かす。選手固有の配分、他グループ、体格・用具寸法・打法・角度を一律値へ上書きしない。球速はkm/h、悪球技術はSI比率×100という直接表現である。

これは公式のリーグ相対評価から真能力を逆算する仕様ではない。元ロスターの仮公開表示と個別SIを結んだ編集用基準であり、実測された絶対能力の校正でもない。前提は `docs/game-design/04-defense-ratings.md:23` の「公開値は内部能力の完全な逆算表にはしない」。同じ公開値だけで選手の全性質が一致するとは扱わない。

## 選球眼の接続

積極性やボール球を追う余裕を単に下げる操作を「選球眼」とは呼ばない。optional `zoneJudgmentStdMeters` を追加し、独立したSeedRootの `zone-judgment-v1` streamからのx/y誤差を、コース判断の推定位置だけへ入力する。実際の投球、既存の打撃位置／時刻の乱数、狙う実motor点は変更しない。AUTOの判断に消費され、監督のtakeや既存TAKE／SWING指定の優先順位を維持する。

新しい初期名簿では全20選手に暫定の0.025mを登録した。旧名簿で省略した場合と明示0の場合は、以前の局所モデルの誤差なし推定を厳密に維持する。そのため旧名簿や極端な詳細設定から公開編集の目安0〜100を超える表示が生じても、読込時にSIを勝手に丸めない。表示と保存を許可し、完全一致のno-opも保持する。

## リーグ参考表示

MLB／NLBは現在登録されているLAD／TBD各10人の実SIサンプルを使う。打撃比較から投手を除き、投手比較は投手だけにする。各指標について50＋20zの記述的比較を表示する。NPB／KBO／CUSTOMに母集団がなければ未算出、標準偏差0または2人未満でも未算出。全リーグ人口を代表する査定とは表示しない。切替だけでSIや試合結果を変更しない。

## 検証と証拠

- 公開対応13 tests PASS：`4a0ac4b1af694cdc9979a96d4e28962b`。全20人×11の初期照合、完全no-op、複数SIの連動・配分保持・逆操作の丸め範囲、他19人保持、旧JSON、無効入力、リーグ参照の無変異、選手名／リーグ名の無関係を確認。
- コース判断の実消費など38 tests PASS：`00e881a3fb02458ea4706c36f66c14fa`。adapter→Host→実投球、専用stream、0／省略の互換、実投球・既存乱数の不変、入力不変を確認。
- 全体 `tsc --noEmit` PASS：`2fd0c0ba95ce4f50aad193d12c0be2ea`。最終の公開no-op／タグ処理変更後の対象strictもPASS：`0a0943d713df4e17961c75e1f4be9e6e`。
- 新v41通常HTMLは**511球で9回表終了、159.359s PASS**：`1bb612298c2448f3add16ce019e7afd7`。ホームリードのため9回裏なし。103入力SHA、全投球の0.025m判断誤差・推定・判断scoreへの消費、PC／390pxの同8球hash、正常／不正能力JSON、新試合適用を確認。Source例外・旧結果fallback・外部通信なし。全compact記録を workspace `outputs/verification-v41-game-v1/normal-game-records.json` に保存。同じ9回履歴を使い、配球記号・捕手カメラ・保持球非表示・投手視点のCore bat非表示も確認した。
- 公開メーカーの初回／最終（空注記の余白修正）で、各幅20人×11の表示、11項目全ての実編集、詳細→公開再計算、公開↔詳細の12回交互編集によるsourceId増殖なし、旧JSON、不正入力保持、全リーグ参照の無変異、JSON往復を確認。編集した保存JSONを実v41へ読み込み、両幅で各1球の実行も確認。最終UI・版別配置の証拠は末尾追記を参照。
- 既存のflag無しSI編集モードも別の一時出力で39項目の互換QA PASS：`0ade706039fe4a149230a85e9c8c4fdd`。元の配布HTMLは上書きしていない。

最初のunit FAIL `a16dd0d…` は3000Wの往復値へ絶対小数12桁を要求していたため。差1.8e-12を、単位の異なる量に対する相対32eps以内の比較へ修正した。物理値を丸めて修正していない。最初のTSC FAIL `7d6bf7b…` はテストの `Record<string,number>` castに文字列basisが含まれたため、Recordunknownからの読取りへ修正した。レビューで検出した範囲外完全no-opの拒否も修正し、旧名簿で回帰試験を追加した。原ログ・原receiptは全て保持する。

## 変更ファイルと固定版

- 新規 `src/integration/browser/LivePublicAbilitiesV1.ts`／`.test.ts`、`index.ts`／`workbench-index.ts` exports。
- `LivePhysicalRosterV1.ts`、`LiveBaseballMatchV1.ts`、`LivePitchV1.ts` と関連testsへ判断誤差を追加。
- 新規 `docs/demos/live-game-roster-v2.json`、`live-game-roster-catalog-v2.json`、`live-public-ability-reference-v1.json`。v1データを保持。
- `docs/demos/baseball-maker.html`／`baseball-maker-ui.mjs`、`tools/browser-bridge/build-maker.mjs` の `--public-abilities` 分岐、新規公開UI browser check。
- 新規 `build-v41.mjs`／`v41-live-presentation.mjs`／`check-v41-game.mjs`。v40統合・表示は継承。

| 対象 | SHA-256 |
|---|---|
| v41 HTML | `98c67b1c2a578e1b316bddc5212291091b8c4f362e19f17cb21508ab8b1b9863` |
| Core bundle（103入力） | `15a13c1f650c893008dc57b2f9c4a259847e75c5127df5265a4fcb3f5dae98af` |
| Core input manifest | `3e822d7f500a6641e7a0ade47bbbffe93047c6bd5deb94fd502f496e306a459b` |
| v2 SI名簿 | `a2fdb7835bada8dddcd2599e72f0034e540bebb360febb8cd25279f2ba1e6ccd` |
| v2 catalog | `df910ce1aa0c6e358160ca028afd00649a9744e3763cb8eb587abd5fb9741dc7` |
| 公開編集reference | `b448f82f81620085b1f4923609cec23f69db4c639da76b6b1f877abb22622e4e` |

実際の103入力・bundle・各JSON・未変更の実測OBPを workspace `work/v41-public-core-v1/` に保存してSHAを再照合した。公開referenceは作成者用で、Native認証を付与するものではない。

今回1試合は51対57であり、成績分布を現実へ校正した結果ではない。全身Native・一部ルール・公式H/E・残り得能・新100試合監査・実機スマートフォンは以前の未完を保持する。幅390pxはデスクトップChromiumでの確認。依存関係、設定、lockfile、secret、DBは変更していない。push／merge／resetなし。Charter HOLDと旧原証拠を保持し、全体計画の完了とは扱わない。

## 最終の公開編集画面

最終メーカーSHA：`60c942a779198aa164d61c702aec97b7c8ff5c7159c3301542503b1a6e2d12fe`。build receipt `e22a4f170bf4459e8ee5f59ae6c93b84`、UI receipt `16e91672061e4ee0bd420bb482eb1858`、9.703s PASS。workspace `outputs/verification-maker-public-focus-v2/public-maker-check.json`（SHA `1cad1f852cf6d95f7ff9f6d20604e1813007cad4d04b724f8aeec38e1b371542`）と両幅PNGに記録した。

1200／390px両方で初期選手タブ・研究プレビュー非表示・全幅編集を確認し、最初の能力入力の上端は476／512px。全20選手の役割別主欄と閉じた副欄、バットタブへの復帰、全11能力の編集、40詳細、旧JSON、リーグ参照、公開↔詳細の交互編集、JSON保存を確認。編集済み設定をv41へ読み込み、両幅で実1球と実際の `players[].physical` の一致を確認した。エラー・外部通信・ページ横はみ出しなし。Rootも最終画像を目視確認した。

配置修正後の最初のUI検査 `8140134f…` は、副能力details追加で検査器のleague summary selectorが2件一致したFAIL。検査器の対象を直下のleague detailsへ限定し、製品を変更せずに再検証した。元ログを保持した。

再生成は `node tools/browser-bridge/build-maker.mjs <output.html> --public-abilities`、対応する試合は `node tools/browser-bridge/build-v41.mjs <output.html>`。その前に現在Sourceで `node tools/browser-bridge/build-native.mjs` を実行する。型検査と対象変更の `git diff --check` はPASS。旧成果物と原FAIL／UNKNOWNは保持した。
