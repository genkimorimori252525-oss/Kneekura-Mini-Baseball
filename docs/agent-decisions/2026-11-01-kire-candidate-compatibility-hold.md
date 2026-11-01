# キレ候補の誤適用と保存互換の保留

2026-11-01 JST。人間の要求は「キレ○」「キレ◎」「驚異の切れ味」の選択で元の球種を保ちながら変化の時期と終盤への集中を物理的に扱うこと。V180の判断は低回転／gyro置換の普遍採用を撤回し、旧保存の黙った読み替えを禁じている。

最新Maker候補 `work/maker-contact-name-v257-candidate-02/maker.html`（SHA-256 `996407dbdbf193e22369f01466fe1750493df524df20158fbf20460b9e2145cf`）の静的配線では選択を保存後、Workbench自動試投のprofileがV177 requestへ変換される。通常r6候補にも同じ実行経路がある。適用条件を満たす球では旧recipeがspinを.04/.02/.1倍、gyroを30度に置換する。現候補で3選択を改めてBrowser実行した証拠ではなく、既存Sourceと埋込コードの静的照合である。`src/integration/browser/LiveTraitRuntimeV77.ts:111`、`src/integration/browser/PitcherWorkbenchV77.ts:30`、`src/integration/browser/LiveBaseballMatchV1.ts:235`、`src/integration/browser/LivePitchV1.ts:298`、`src/integration/browser/LivePitchQualityRecipeV177.ts:60`。catalogの実行可能・元球種維持という表現も整合しない。

判断: 旧候補を保持し、キレを含む完成配送の採用を保留する。profile変換だけ止めると同じ旧保存設定を読み込んで異なる続きを生成し得るほか、明示V177 requestからも旧処理に到達する。新実行契約、明示request、旧sessionの互換判定、catalogとUI表示を一体で設計し、旧保存・旧build・旧FAILと研究結果を保持する。Astra独立静的reviewもこの境界の決定前に候補を上書きしない判断。新規選択の保存だけで物理達成とせず、正しい3段階の実装と元Goalの受入・配送は未完。

復旧: 今回は判断記録と機能状態表のみ更新し、runtime・元HTML・保存データは変更しない。原候補と既存decision `2026-10-28-kire-base-preserving-v180.md`を保持。新しい実行境界を作る場合は対象Source固定後、旧保存／明示request／既定球／3選択の各結果とユーザーへの表示を検証する。

## 次の実装単位: 外部試投replayの事前判定

本人のGoal継続と旧保存保全の明示指示に基づき、異build／build不明の旧投手試投を現Coreで再計算する前に拒否する。旧候補・旧保存・同runtimeの継続は保持する。本人が望む最終的なキレ物理の代替や完成判定ではない。

判定には実際の新build identityを用い、入力と比較入力の両方を計算前に検査する。build欠落・不正・不一致は拒否、実効V177 objectは拒否し、明示nullがpitcher内objectを抑止する従来優先順位は維持する。実効invalidも通常球へ黙って変換しない。拒否時はsimulate呼出なし、直前試投／再生／比較状態・元保存を維持する。同buildの通常入力は従来経路へ進める。影響は従来許可していた異build／不明buildの現行Core再計算を停止する点。旧buildからの再生は別途保持し、旧実保存の新build互換は未検証。

Astra静的reviewはこの単位から着手可と判断。各分岐のfocused fixture、後続の統合UI・旧データ検証が必要。新候補を生成せず旧sourceへ戻せば暫定変更を撤回できる。Core profile自動変換、catalog、UI、他の外部restore入口、正しいキレ物理は後続の未完作業。

## 実装時の保全不足と検証範囲

外部投手試投gateを `docs/demos/baseball-maker-pitcher-v92.js` の未追跡WIPに実装したが、編集前bytesのbackup・SHAを取っていない。元bytesの厳密な復元可能性、無関係な差分・改行の不変はUNKNOWN。同一と証明できない旧候補を使って原本を再構築せず、記録を残す。今後の防止としてproject AGENTSに、未追跡またはdirty fileの編集前の完全bytes backup・SHA・所有記録を追加した。変更前AGENTS自体のbytesはarchivesに保全。

限定fixture `e4272596ddf9460c806ac6312baadc7e`、追加境界 `58f14453835d4567a4f95d422680599a`、構文 `45116db454194b568f1faed5e47f6662` PASS。初回fixture `ee66a182e3844370b06e6d31ce105ccb` FAILは保持。Astraは静的reviewでP1/P2なしとしたが、fixtureの正常replayはstubであり、実Core／Browser／実保存の成功、再生状態すべての保全は未証明。Source SHA `930094045d0d7c35a43a4367cde87669ba34c177431015ae3b376100b0499a0d`。当該候補は未配送。
