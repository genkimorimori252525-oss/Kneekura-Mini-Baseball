# キレ3選択の実装状態と表示の整合

2026-10-29 / `MB-20261027-REALISM-DEBUG-PLAN`。

## 作業を重複させない状態訂正

キレの3選択、選択直後の保存・自動試投、JSON export / 再読はV177の局所受入済みだった。`baseball-maker-pitcher-v92.js` の選択処理から `setLiveTraitProfileV77`、LiveTraitProfiles / Runtime、LivePitchV1、`kire_release_recipe_v177` への経路も現Sourceに存在する。青の「キレ○ / キレ◎」、金の「驚異の切れ味」（◎なし）も保持されている。

未完なのはUIの全面実装ではない。`AUTO-KIRE-RELEASE-V177.md:64` とV180で、元の球種を保持せず低spin / gyro置換を行うrecipeの普遍採用を撤回した。既存UI・旧保存・局所PASSは研究履歴として保持し、現在の候補を完成版として配送しない。追加gridも停止済み。元球種を保持した3段階の物理Source / モデル不足は未解決。

この区別をplanと再開用CURRENTに反映した。既に実装済みの選択・保存を作り直さず、物理recipeの採用・現行表示・同版配送を残作業として扱う。

## 説明文だけの修正

`docs/demos/baseball-maker-ui-v94.mjs:450`、`baseball-maker-pitcher-v92.js:33` とAPPLIED後の可視statusの計3 literalを修正した。「選択は保存される」「現在の試験設定では元球種が変わるためキレの3段階としては未採用」「通常で元へ戻せる」を利用者向けに明示する。内部のSource名をUIへ表示しない。

選択肢、色、内部ID、保存、試投、recipe、runtime、物理の変更は0。両全文を変更前に読み、private baselineを保存した。3 literalを逆変換すると変更前の全bytesに一致することと、両fileの `node --check` を `bce838a486a64109b836c371cd2bd66b` PASS202msで確認した。V214 / V216のpin集合にUI2pathsが無いことも変更前に照合し、両manifestの不変を確認した。

| local Source | bytes | SHA-256 |
| --- | ---: | --- |
| `baseball-maker-ui-v94.mjs` | 167981 | `6a6d815a9dac933236abc321d683f50428029505edf44a6ab14895f514656c45` |
| `baseball-maker-pitcher-v92.js` | 106202 | `b5aa65e27321efbbc2c95c236d9bf38c426ad5bbff71a0eedccf832537fd7801` |

共有UIには先行する未配送変更もあるため、この修正を理由に全fileをstage / 公開していない。local Sourceとprivate baselineを保持し、最終Source同期・3HTML配送に含める。Chrome / Native / DB実行は0。この文章の修正を、元球種を保つキレの本適用や最終配送の完了証拠にしない。
