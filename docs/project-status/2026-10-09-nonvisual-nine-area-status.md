# 元9領域の非デザイン実装状況

2026-10-14 更新。現在の統合src treeは `9e498c7bce20ae015dfa43f2846c95e236b82aa2`。
元計画の非デザイン接続を対象とし、UI・デザインと新しい球種体系は対象外。
実装済みAPI、実際の経路で得た証拠、未定義の仕様を分ける。確定した作業量の分母がないため、正確な完了率は算出しない。

## 直近の変更と検証

履歴復元の重複を既存の同一接続・同一transaction内で共有する変更をまとめた。書込み・current admission・変更・rollback・独立retryをまたぐ共有は行わず、接続guard、完全参照、frozen結果と失敗時の拒否を維持する。

- 同じ歴史CatchWork readは各版1回で588.335→492.347→388.349→230.227秒。返却全文19,442 bytesが一致し、DBは不変。最終変更の全compilerと関連144件がPASS。
- 別の同じimport deriveEvent readは各版1回で1425.839→221.895秒（84.4%短縮）。全文68,481 bytesとhash、DB/schemaが一致。全compilerと関連86件がPASS。全ownerや全試合の時間改善には外挿しない。
- 実import受理後から元rights以後を続ける厳密な入口を追加。元20 callback assertionsと後半本文、旧入口の契約を保持し、改変Source・重複import・先へ進んだ状態を拒否する。全compiler38.148秒・関連23件7.351秒がPASS。

[実装・測定条件・結果](2026-10-14-live-appeal-proof-read-sharing.md)。

## 残る元LAN経路

元の複合プレーでは、打球接触、守備者の実捕球・保持・持替え・送球、受け手の実受球、明示appeal試行、物理終了境界、裁定journalへのimportまで受理済み。appeal試行自体を走者違反OUTとは扱わず、rightsはpending、Match公式outsは0のままである。

環境中断により残工程の通し検証は未完。新しい保存入力の認証も完了していない。元の残りはrights、結果受理、次play境界、独立再読のjournal4操作とterminal17操作。受理済み入力は保持され、前半を再生成する必要はない。異なるsourceや独立した実行履歴の一部を足して全体PASSとはしない。

## 9領域の実装と残件

1. **物理履歴・archive・store** — 記録、archive、正規原本、retry/reopenの接続は実装済み。元40-pieceのfresh構築・両archive・rollback・不正入力拒否・reopenはPASS。長期の合成試合・人口規模での性能証拠は未完。
2. **取得・保持・持替え・送受球** — actual acquisition/custody、carried continuation、reserved same-PAのtransfer/releaseと自由球を接続済み。元IFNは保存された正規境界から公式記録・決済・release・次打者までの残工程を完了。元LANの送受球も実受理済みで、公式終端との合成が未完。
3. **走塁・接塁・field-rule・appeal** — accepted geometryと実接触・保持を根拠とする判定、missed-base/re-touch/live appealの受理経路は接続済み。元LANのappeal試行後から公式適用までの合成検証が未完。試行とOUT認定は区別する。
4. **球場・legal・裁定** — rolling geometry、物理接触からfoul/fair/catch等の規則解釈と裁定入力へ接続済み。未定義の屋根・壁上端・開口、dead/award、妨害条件は未解決のまま保持する。
5. **プレー終了・公式記録・成績・負荷・決済** — actorの未完指示/反応/動作を処理し、閉鎖前の新情報で再判断する承認済み方針を実装。custody/contact証明は別途維持。公式記録・scoring・個人成績・workload・settlement/releaseは接続済みで、元LANの最終合成が未完。
6. **foul・同打席再開** — foul後のreset、lease、次投球、retry/reopenを接続済み。元FR01のfresh経路は実SWING/contact/foul/resetから後続TAKEまでPASS。完了済み経路の新しい変種は追加しない。
7. **身体・controller・response・recovery** — 既存数式に沿うsubtick controller、accepted poseによるrecovery timing/binding、実動作と観測の接続は実装済み。新たな高精細身体モデルを完成条件に追加しない。長い複合経路の証拠は上記残件に含む。
8. **練習・育成・能力履歴** — 実参加・実repetition、受理appraisal/処方/assessment/policyによる学習、明示再測定から能力履歴への接続は実装済み。外部assessmentの受理を自律生成の証明とは呼ばない。未定義の校正や自律処方は[判断メモ](2026-10-10-nonvisual-policy-decisions.md#因果的な選手育成)に分ける。
9. **Career・competition・roster・economy** — domestic postseason/WBC、completed-game outcome/outbox、採用/契約、calendar市場trigger、staff wages、明示season/dayから試合・roster実行、Manager発行判断から実行requestを接続済み。別seasonの同日番号を混同しない。共通clockと自動前進、CPU判断の未定義policy、実game/season・人口/長期性能の証拠は残る。

元正本との限定コード照合では、新しい通常APIの接続欠落は見つかっていない。これは全9領域の完成認定ではない。合成試合・季節の実証と、正本が要求する未定義producerは未完である。

## 完了済みの主な元ケース

- 元40-piece fresh: `c7928d3c` / src `25eda7eb`、64 original assertions、4578.339秒でPASS。
- 元first-base Positive fresh: 同source、50 original assertions、906.119秒でPASS。
- 元IFN retained suffix: `1835b6f8` / src `8b8f1639`、release・記録/scoring・次打者・retry/readbackが9307.868秒でPASS。旧失敗区間と区別し、最新sourceのfresh全体PASSとはしない。
- 元FR01 freshとNational retained37: `d4a17d49` / src `728b6e36`。前者は7511.742秒、後者は12438.205秒でPASS。
- PL最終retained readback: `838320cb` / src `b96eb4fe`、16表一致を含み137.094秒でPASS。旧上限失敗を成功へ書き換えない。

[元計画の9領域](2026-10-04-nonvisual-implementation-checkpoint.md#5-残る確定済み非デザイン計画)と[source別検証記録](2026-10-10-terminal-proof-recovery.md)を参照する。source帰属の更新だけを目的に完了済み重いケースを繰り返さない。未承認の3群は[判断メモ](2026-10-10-nonvisual-policy-decisions.md)へ分け、提案を既定値として実装しない。
