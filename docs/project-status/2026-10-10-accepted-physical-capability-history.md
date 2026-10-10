# 明示受理した守備・走行能力の履歴と通常consumer

元の非デザイン領域8の、既存accepted Sourceからdurable能力を更新する接続。先行の[打撃能力とNative育成原本](2026-10-10-accepted-batting-capability-history.md)と同じく、能力値・assessment・calibrationは明示入力であり、実practiceから能力増分を算出する式は追加しない。

## 実装範囲

- Fielding、runner decision/motion、defender locomotionにappend-onlyのdevelopment履歴を追加した。元baselineテーブルとSource bytesを保ち、更新は前能力の完全なSource/snapshot、Player/Person、CONSOLIDATEDかつeligibleな元exposure、明示assessment/calibration、明示replacementのhashを固定する。
- 各更新は直前モデルより後の日付を明示し、元consolidation日以前へ遡らない。同日内の二つの能力更新には既存のday契約だけで順番を付けず、拒否する。fresh selectionはその日までの最新受理値、既存frame/retryは元のSourceを読む。後日行のclaimは検査するが、過去frameの証明へ後日モデルを再帰投入しない。
- 受理済みfieldingを通常の観測→判断→locomotionへ使えるよう、observation/decisionの既存calibration値を完全に保持する明示rebindingを追加した。新Sourceと新fielding bindingの受理が必要。batter-run transitionも同じく、元recovery parametersを保持して明示的に新runner modelへ結び直せる。
- fresh observation、defensive decision、locomotion、runner decision、occupied hold、batter-exitで日付に応じた選択を確認する。元body・実行・retryは当時のモデルを保持する。共有body measurementの同一性確認は、後日bodyの能力依存を過去bodyへ持ち込まず、元parameter payloadとcanonicalなclaimを照合する。
- 既存のmeasured NORMAL/QUICK fixtureに、revision 1の投球を実行・負荷settlementし、全writerを閉じてNative readerで復元するassertionを追加した。元measurementの改変でその新投球の証明が拒否されることも同じfixture内で確認する設計である。

## 保持対象の最小変更

`SqliteActualLocomotionStore.ts` の既存 `current` 分岐に、現在選択されるaccepted modelとの一致確認だけを追加した。元blob `13a137d57215e6a3abe6f8d677cca80fd06fd8d4`、新blob `425b44ac8c9b8c867dfb62643e206a76dd0b0fe9`。historical deriveは変えず、同日・過去・未来のselectionと元receipt/retryを比較する回帰caseを付けた。保持manifestは更新せず、他17 blobsは変更しない。

## 検証状態

authorの小選択は外部35秒capで終了した。最初の能力統合caseは新transition selectorのquery-only境界不一致で失敗し、後続consumer fileの結果は未取得。既存Native query-only契約を維持する修正とfixture修正を行い、再実行はしていない。失敗terminal/logを保持しており、この結果をPASSに扱わない。

一括review/compiler/finiteでは新しい `PhysicalCapabilityDevelopment.integration.test.ts`、`PhysicalCapabilityCurrentAdmission.test.ts` と、既存 `ActualPitchTimingLearningFromPractice.test.ts` の「keeps original physical proofs and direct timing reads acyclic after a supplied measured source change and reopen」を対象にする。後者は同じ本来の実測fixtureを拡張しており、別のgenuine fixtureを再生成しない。既存モデル、body、runner/transition、観測/判断/locomotionの関連回帰も一括選択で扱う。

## 残る境界

自律的な能力値・relevance・身体適応の推定/計測producerはこの受理ownerでは生成しない。独立したstandalone drill実行からの原本は共有Native exposure readerの既存dispatchを通る。対応外の動くrunner終端やphysical familyのrepetition証明、長期の成長履歴と実試合全chainのqualificationは別途残る。明示replacement値を保存・選択する機械的接続を、数値モデル未定義の理由で未実装扱いには戻さない。

## 統合後の結果

[統合バッチのreview・compiler・有限選択結果](2026-10-10-practice-capability-roster-batch.md#一括検証と修正範囲)を参照。author時点の途中結果は履歴として残し、最新の資格付けと区別する。
