# 受理済み打球の記録と参考分類

2026-10-30 JST。実Workerの受理recordから、現在sessionの選手別打球件数・打出角・明示基準の参考件数／割合を表示・保存する経路を追加した。**career集計・Native trait成立・全producer・通常HTMLへの配送は未完成。**

## 記録・分類・表示

打出し速度は`play.outgoingBallMoment.ball.velocity`を使う。入射側contactMomentの速度、field後の速度、animation frameを打球として数えない。contactMomentは接触時刻だけを使い、実Ownerの`beforeMatch.playId`を文字列として保持する。

角度・半開区間・割合判定を小さな共通helperへ抽出した。旧`MeasuredTraitStatistics`も同helperを使用し、atan2／hypotとIEEE演算順、lower<=angle<upper、fraction>=minimumFractionを保持する。Nativeのcareer日／最小日数／episode validationは変更しない。

Local DTOはsession／config／buildのローカル識別ラベル、player、pitchOrdinal、playId、contact tick、実exit velocityを保持。ラベルは内容hashやOwner認証ではない。同player＋ordinalを一意とし、同payloadは増分0、playId／tick／速度差はCONFLICTで元reportを保持する。no-contactは打球数にしない。

メーカーは受理済みtrial／通常recordのadopt後だけ通知し、preview／対照／prefetch／HOLD／animationを計上しない。別playerは別report。保存読込はLOCAL_SAVED_DEBUGへ変換し、その後の新sessionと分離する。

分類基準JSONは明示4フィールド`reference/lowerAngleDeg/upperAngleDeg/minimumFraction`またはnull。読込・再集計・解除を実装し、不正な型／欠落／余分fieldは共通入口で拒否、失敗時は既存reportを原子的不変にする。基準未指定はUNASSESSED。

全reportは`physicsEffects:NONE`、`modelCalibration:UNCONFIRMED`、career日数条件未評価。参考角度帯の一致をline_drive能力の成立や回転制御へ転用しない。旧V191／V229 Native envelope／表示は別枠のまま保持した。

## Source検証と不足の扱い

Sol独立レビューで、playIdを変える同ordinal二重計上と、saved ruleの数値reference／false等を通すP2を発見し修正した。RootはSourceと開始全文への機械的逆patchの全bytes一致を確認した。既存statistics開始worktreeとGit親は異なり、両方を保存している。

担当は最初の22局所tests、修正後の限定tests／strict／stub UIを直接toolで実行しPASSと報告したが、task付きreceipt／永続logを作成していなかった。**正式receipt未確認の不足を保持し、それを埋めるための同command再実行や旧結果包装は行っていない。** これは実行がなかったという意味ではなく、正式完了証拠として不足するという区別である。

今後の分業はproject絶対path・完全task ID・共通evidence_runner入口を最初の依頼へ含めるよう共通CCG Skillへ追記した。新Skillの挿入以外の全bytes、backup／復旧を確認し、151c9924572a4d59ade018828d27d383でquick_validate PASS125ms。Core／Hooks／TeamChat／Charter／全projectを変更・初期化していない。共通記録はローカル保存で、全active agentにhot reload済みとは主張しない。

## 新入力の実browser検証

V239の本人JSON／実Worker新入力から、受理contactのみ1件ずつ追加されることを確認した。TOP／HOOKの各ケースは保存・正常replay後に明示reference ruleを適用した。基準は実行前固定の`TEST_ONLY_FIXED_V240`、[0,45)度／minimumFraction0.5であり、製品default・普遍的line_drive定義・Native modelではない。

| 実ケース | 実打出角 | 参考件数／割合 |
| --- | --- | --- |
| TOPSPIN seed20261031 | 38.6973212821189度 | 1件／1、一致 |
| HOOK seed20261102 | -33.90103884478321度 | 0件／0、不一致 |

両reportはLOCAL_SAVED_DEBUG、career条件UNASSESSED、physicsNONE、校正未確認のまま。見送りだけのBACK／SLICEはcontact件数0で、そこでのempty rule検査を実打球分類の証明とは扱わない。

receiptはTOP `49386100b5924215b3ceb5ea12b19549`、HOOK `904092ccb40644edaa16d29b7fee7479`。Rootはtask／PASS／exit／log SHA、元run内artifact hash、原JSON／正常roster／Source／HTML／Native／Workbenchの終了pinsを照合した。BACK pilotのa730ではJSON読込／不正原子保持／解除、close後通常練習／保存再開を確認し、Rootは1200／390px画像を目視した。

## 残作業

通常試合のvisible採用後通知、producer全人口、同PA複数の統合受入、正規career時計と日数条件、productionの分類model、旧データ互換の最終統合、完成3HTML／配送が残る。Local参考表示の成功を、これらやSPINの物理制御の完成へ拡大しない。
