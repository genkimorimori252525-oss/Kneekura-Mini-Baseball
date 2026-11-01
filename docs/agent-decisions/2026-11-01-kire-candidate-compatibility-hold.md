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

## 暫定runtime抑止

`LiveTraitRuntimeV77.ts` のselectionは保存・検証を保ち、profileから旧V177 requestを自動生成しない。`LivePitchV1.ts` は従来のinput優先で実効requestを選び、非nullを物理profile／乱数の前に明示拒否する。input nullはpitcher側objectを抑止。V168・他traitは別扱い。両sourceの事前bytes/SHAを `work/kire-contract-v261-01/*.before-runtime-v261-01` に保全し、変更後もCRLFを維持。

実Core局所3件とV168回帰5件 `db2f7d70764049cabff2068bd195840f`、対象source型 `f5e176dd2b5d4e6a82d34a48eef86672` PASS。全体tsc `a91ab284ced949b9bea55c3108190272` FAILは他テストの未使用import・型不一致として保持。旧V177成功を期待するtestは新仕様と衝突し未更新・未実行。Astra静的review P1/P2なし、ただしphysical内旧requestの保持・拒否、Match continuation／workload不変、旧runtimeとの通常物理比較、Workbench/practice/Workerは追加検証が必要。fixtureのnull比較は変更後同士であり旧版互換の証明ではない。これは未配送の暫定抑止であり、元球種を保つキレ物理3段階は未完成。

## 暫定catalog／表示の契約

新runtimeだけで `breaking_ball_quality` のavailabilityを `UNAVAILABLE`（物理効果未対応）とし、選択・保存可能とは分ける。3 state／null／editor／保存のrecipeVersion IDを維持し、旧recipeが実行される・元球種を保つというcatalogの誤記を除く。両UIでは「選択保存、物理効果未対応、通常球で実行」と明示する。ほかの得能を変更せず、新しい物理3段階の完成とはしない。Astra独立静的reviewは既存 `EXECUTABLE` を残すより本契約を推奨。

影響: catalog metadataに新enumを追加する。確認済みMaker選択setterはavailabilityで保存可否を判定しないが、外部consumer全域の対応はUNKNOWNであり無条件の互換成功を主張しない。旧候補・旧rosterデータは保持、新candidate側でbuild identityを更新する。局所fixtureでcatalog／projection、3 stateとnullの保存、他family不変、両UIの表示・選択を確認し、実候補のMain/Worker・Browser・幅390などは別途検証。復旧は新candidateを採用せず事前backupから対象sourceを復元する（編集前bytesが不明な既存UI WIPの旧原本復元は引き続きUNKNOWN）。

## 暫定表示と再開境界の進捗

catalog／共通UI／投手UIを更新し、選択は保存するがキレの物理効果を適用せず実行することを示す。availability `UNAVAILABLE` の外部consumer互換はUNKNOWN。catalog／projectionと保存往復などの局所fixture `kire-catalog-ui-v261_342ba844e6284675af48f9c852d3e842` PASS、文言 `kire-wording-v261_58379f93963346169735093be8b996d7` PASS。全体型 `kire-catalog-typecheck-v261_25d38b206cae4cd59c49c55ab232e318` FAILは担当外test診断を保持、変更前同条件比較はない。

選択保存後の試投失敗では、旧trialを旧条件と明示し保持し、現在rosterと旧resultを混ぜるexportを拒否。旧result単体の保存形式は変更しない。再生後のstale解除と描画失敗後のexportボタン復元の各レビュー指摘を修正し、fixture `kire-quality-replay-v261_b6d33fcb2b214863a7d309d71abb32b4`、`kire-quality-rollback-v261_0f489e1f8d1a46d99179d731c54c572d` PASS、初回fixture失敗 `kire-quality-trial-v261_4fdb7bfe31cd42d18fe3cdac080657e1` を保持。Astra再reviewは現差分P1/P2なし。旧trialなしの場合の描画失敗、renderer復旧失敗、実UI／Browserは未検証。

practice外部restoreは保存buildと現buildを判定後にWorkerを開始し、異build／不明を拒否。busy中の挙動は従来どおり入力を処理しない。fixture `a299a526802544f09d14e772051a3439`、busy追加 `c5a56b40ecc64e0f9f76e6ce00955a36` PASS。codec・Workerはstubで実same-build保存の復元は未証明。旧候補／保存は改変しない。

新candidate生成では、現LivePitch全体には未採用V251が共存するため、そのままoverlayせず、固定r6 snapshotへ必要なキレ差分だけを適用する。UIの本文と各UI hash・Native/WB bytesを新たに固定し、旧builderのWorkbench hashのみ更新する手順を無条件流用しない。物理3段階、変更後candidateの統合検証・完成配送は未完。
