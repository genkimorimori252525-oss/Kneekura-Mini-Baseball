# キレ候補の誤適用と保存互換の保留

2026-11-01 JST。人間の要求は「キレ○」「キレ◎」「驚異の切れ味」の選択で元の球種を保ちながら変化の時期と終盤への集中を物理的に扱うこと。V180の判断は低回転／gyro置換の普遍採用を撤回し、旧保存の黙った読み替えを禁じている。

最新Maker候補 `work/maker-contact-name-v257-candidate-02/maker.html`（SHA-256 `996407dbdbf193e22369f01466fe1750493df524df20158fbf20460b9e2145cf`）の静的配線では選択を保存後、Workbench自動試投のprofileがV177 requestへ変換される。通常r6候補にも同じ実行経路がある。適用条件を満たす球では旧recipeがspinを.04/.02/.1倍、gyroを30度に置換する。現候補で3選択を改めてBrowser実行した証拠ではなく、既存Sourceと埋込コードの静的照合である。`src/integration/browser/LiveTraitRuntimeV77.ts:111`、`src/integration/browser/PitcherWorkbenchV77.ts:30`、`src/integration/browser/LiveBaseballMatchV1.ts:235`、`src/integration/browser/LivePitchV1.ts:298`、`src/integration/browser/LivePitchQualityRecipeV177.ts:60`。catalogの実行可能・元球種維持という表現も整合しない。

判断: 旧候補を保持し、キレを含む完成配送の採用を保留する。profile変換だけ止めると同じ旧保存設定を読み込んで異なる続きを生成し得るほか、明示V177 requestからも旧処理に到達する。新実行契約、明示request、旧sessionの互換判定、catalogとUI表示を一体で設計し、旧保存・旧build・旧FAILと研究結果を保持する。Astra独立静的reviewもこの境界の決定前に候補を上書きしない判断。新規選択の保存だけで物理達成とせず、正しい3段階の実装と元Goalの受入・配送は未完。

復旧: 今回は判断記録と機能状態表のみ更新し、runtime・元HTML・保存データは変更しない。原候補と既存decision `2026-10-28-kire-base-preserving-v180.md`を保持。新しい実行境界を作る場合は対象Source固定後、旧保存／明示request／既定球／3選択の各結果とユーザーへの表示を検証する。
