# 実practice・能力履歴・Manager実行の統合バッチ

元の非デザイン9領域の既存契約を接続した。検証済みcode commitは `2149cbfe34074a46ec35732a43a08a4eca62846a`、src treeは `91499b8fcc7a352e5a680c99c24a5f24a9ca6d32`。UI/design、新arsenal、未承認のdesign32は含めない。

## 接続した動作

- [Standalone practice](2026-10-10-standalone-practice-motion.md)：素振り、守備足運び、走行をprospective commandから実行し、元body/model・episode・明示effortを固定してPRACTICE負荷、学習、Native exposureへ接続。pitch練習との切替でも、負荷後に学習が中断した元操作を先に再試行できる。素振りは元の二つの打撃時計に一致させる。
- [守備・走行能力履歴](2026-10-10-accepted-physical-capability-history.md)：元のCONSOLIDATED exposureと明示assessment/replacementから、fielding、runner decision/motion、defender locomotionを日付付きで更新。元calibrationを保持した観測/判断・batter-exitのrebindingと通常consumerを接続。baseline bytesと過去frame/retryを保持する。
- [発行済みManager判断](2026-10-10-issued-roster-execution-producer.md)：元beliefと候補から既存Core選択を再現して実行requestを作り、既存のNative CAS・medical/control・World書込みへ渡す。accepted-day dispatchは明示opt-inを受け取る。自律的な候補値や日付は作らない。
- [守備ownerの重複認証](../verification/2026-10-10-defensive-owner-read-phases.md)：Plan/Decisionの既存read phase内で同じ物理原本の証明を共有する。callback、書込み、別retryは新しい証明境界を維持。実時間の高速化比較は未取得。
- [National保持再開](2026-10-09-national-retained-binding-entry.md)：commit済みの観測と判断modelを元public readerで再認証し、未実行のplanから継続するfixtureを接続。元37 assertionsとplan以降の処理を保持した。新sourceでの実継続は未実行。

## 一括検証と修正範囲

独立した全体reviewで、練習間切替の学習receiptと素振り時計の二点を修正した。続く有限検証では、一部モデルの直接derive/preflightが不正入力のgetterやSQLより先に拒否できない回帰、およびarchive拒否の診断変更を検出した。五つのmodel storeで元のinert validation順序を戻し、既存テストを変更せず、影響部分だけを再実行した。各修正と最後のfixture差分も独立review済み。

| 選択部分 | 実結果 | 経過秒 |
| --- | --- | ---: |
| 能力履歴・通常consumerの初回13 files | 244 passed / 16 failed。元の失敗reportを保持 | 184.12 |
| 不正入力修正の関連7 files | 171 passed。上記16失敗すべてを含む | 32.94 |
| 実practice・Native履歴・Managerの11 files | 126 passed | 45.43 |
| Plan/Decisionと実WAL/trigger境界の5 files | 18 passed | 179.64 |
| 元実測投球学習＋保持再開guardの2 files | 68 passed | 114.07 |

重複を除いた選択は31 files / 472 cases。各fileと階層付きtest名を完全照合した。最後の全compilerは30.95秒でPASS。全実行でsource/dependency/runtime/controlの固定値は安定し、残留processはゼロ。最終partはcompiler中に一度memory admissionで起動前拒否され、compiler終了後に同じ設定で一度実行した。起動前拒否をtest失敗や実行済みに数えない。

既存の実測NORMAL/QUICK case内で、revision 1の新しい投球を実消費して負荷決済し、全writerを閉じてNative readerで復元した。元の測定Sourceを変えるとその投球の証明も拒否されることを確認した。このcaseは23.08秒で完了し、元revision 0だけの実証と区別する。

保持18対象のうち、`SqliteActualLocomotionStore.ts` のfresh `current` 分岐だけに日付選択の一致確認を追加した。元blob `13a137d57215e6a3abe6f8d677cca80fd06fd8d4` から `425b44ac8c9b8c867dfb62643e206a76dd0b0fe9`。過去derive/read/retryの契約を変えず、同日・過去・未来選択と元receiptを検証した。他17 blobsは一致し、元の保持manifestも変更していない。

## 全体結果と残件

この有限選択の完了は、National/IFNの元シナリオ全体や非デザイン9領域すべての完了を意味しない。

Nationalの別固定source `19e4c160` は観測と判断modelをcommitした後、plan受理中に1200.72秒wall capでfailed。計画行はゼロで、元37 assertionsは未完。原本と成功操作ごとの整合保存点を保持し、次は新sourceの未実行planから再開する。

IFNは別固定source `762ef2bd`（公開checkpoint `b4eeaaf`）を使用する。前回の1200.55秒cap後、保持field-stepからcut13の元calibrationを完了し、捕球確定とp2の支配まで元assertionが通過した。2026-10-10 01:07 UTC時点では送球以降を継続中で、全体PASSではない。

Standaloneの実打球接触/捕球、completed foul原本のrepetition拡張は次のまとまりで進める。能力増分・appraisal等の自律数値、動くnon-third-outの三つのsettlement仕様、Career全体のclock/前進条件、および未定義のvenue exit/award/interference policyは推測で追加しない。[9領域の残件入口](2026-10-09-nonvisual-nine-area-status.md)を参照。
