# 非デザイン残計画: 実装と検証の境界

更新: 2026-10-05 14:32 UTC。[既存の残計画 §5](2026-10-04-nonvisual-implementation-checkpoint.md#5-残る確定済み非デザイン計画)の状況を整理する。新しい機能範囲を追加する資料ではない。**計画全体は未完了**。Draft公開やfocused test数を完成率に換算しない。

公開コードの基準は [Draft #314](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/314)、remote `10b7fc35df20a90aa44eb4341c7e59dc2510ab00`、src tree `bbef31471318e5bf179c8709c324bc3030490f8b`。Foundation `44b9f5de7b9d87e649f12f1af78c202f2b5ab44d` / Realism `4f0a60a3818926327b6bf5877ab3dec456a76530` は13:46 UTCのremote再確認で不変だった。

| 既存計画の範囲 | 実装の位置・残るコード接続 | 完了証明の位置・残る検証 |
|---|---|---|
| 1. 統合・再生互換 | 公開stackは#314まで。各段のsrc identityと互換境界を保持 | 最新完了wholeは#277の697 files / 5,159 tests + typecheck。#314のcombined compiler・1497 Node・42 Python・95 Nativeは準備済み未実行。最新累積wholeと40-piece archiveは未完了 |
| 2. Field acquisition / custody / transfer / throw | 元の身体・接触・支配から取得、持替え、release、全10人50部位のmotion adoptionへ接続済み | 登録済みprofileのoriginal pitch→first-base physical endは通過。任意の一般play全体への完了証明ではなく、最新統合Sourceのwhole/archiveは別途必要 |
| 3. 足・塁履歴、first-base race、catch等 | Actual prefixの足/塁/支配履歴とfirst-base解釈を接続済み。広いfoul/retention等の分岐は個別境界を保持 | 第一塁の元接触→判定→physical endの証拠あり。全legal分岐を通した意味ではない |
| 4. Venue / legal / call / review | Untouched settled foulのpolicy・原始count/observer候補あり。Reviewは純粋契約とofficial requestの候補まで。Native review journal、広いsurface/dead/out-of-play/interferenceの接続は残る | Venue候補のCore55、policy44、observer/count25、physical1は各固定Sourceで通過。現在stackとの統合gateは未実行。Review候補39件は通過したが、その後の型修正combined gateとNative15件REDは未実行 |
| 5. Causal timeline / official closure / scoring / workload | 元pitchから物理終了、operative call、公式適用、10 controller退役まで接続済み。全10人workload ownerも実装済み。一般play/scoring全体の完了とは区別 | 固定`6eb9dd6`のactual officialは通過。固定`1c95810`の実10人workloadは実行中。14:32のread-only観測はassessment10、frozen settlement1、committed MATCH activity6。全員完了・retry・full close/reopen・recoveryのterminal一式は未確定 |
| 6. Next pitch / between-play / foul resume | Canonical setupと次actor/pitch ownerは存在。同一PAのfoul再開と同一gameの次打球には版付きepisode/geometry接続が残る | 実official→全員workload→実next pitchはまだ通過していない。正本§9の`rule_system`による不連続配置を使い、歩行軌道を要件として追加しない。`physicalWorldRecoveryProven:false`を保持し、日単位recoveryを経過World時間の証明へ転用しない |
| 7. General Player / runner / body / controller | 既にownedな追加runnerを含む11人55部位、retained後続pieceまで公開済み。Runner sensory projection候補は未実装。General knowledge/decision、received-call後のcontroller、一般生成・必要接触の接続は残る | Retained runner統合139件+実file Native1+compilerは通過。Legacy8件の180秒gateは中断・未通過。Runner projection41件REDは未実行。任意runnerの自律行動証明ではない |
| 8. 能力・実practice・機会・育成 | 実pitching practiceをdelivery/body/timing/fatigue/workload/episodeへ接続済み。別NORMAL/QUICK probeからaccepted learningへ接続済み。Human World practice order候補はreview修正前、Manager経路は残る | Practice55件、learning統合87件+compilerは各固定Sourceで通過。Order候補はcoherent substitution、legacy Source互換、Source/attempt reservation競合の修正と検証が必要。Accepted prescription・測定/標準化結果を自動生成したとは主張しない |
| 9. Club / competition / roster / Manager / Career | 既存Core/Native ownerとactual Match結果→World/Career adapterを保持。一般の試合・season・機会生成と各ownerの自律実行の接続は残る | Adapterのfocused結果は存在するが、一般gameからseason/Career全体が自律的に進む実artifact、長期reopen/replay、必要人口・校正・性能の完了証明はない |

## 次の判定点

1. 現在の実10人workloadを元の有限予算内で終端まで観測する。途中のcommitやfault witnessを全体PASSへ読み替えない
2. Source固定の短いRED/修正/関連回帰を順次実行し、現在stackのcombined gate、venue/review、practice order、runnerの接続を進める
3. 実next pitchを原始入力から検証し、同一PAのfoul再開・次打球と残る一般行動/Careerを継続する
4. Coherentな統合Sourceで累積whole・archive互換を完了する。過去Sourceの成功を後続Sourceへ転用しない

Received callには未接続の境界がある。実通信と知覚receiptは存在するが、Native defensive ownerは通信付き初回判断とissued後の再判断をまだ受理しない。UmpireのOUT/SAFE payloadも既存runner coach-action / defender cover-baseと同じ意味ではない。現PlayEndはreceived/due callを`received_call_controller_consumption_pending`で止める。将来配信の予約を「選手が受信して反応した」証拠にしない。

明示的なaccepted policy、身体parameter、effort評価、標準化測定などの入力境界は残す。入力がない場合のpendingと、入力から先へ進めるコード自体の欠落を区別し、未確定の係数や校正値を推測して埋めない。

詳細なSource別結果と公開履歴は[継続checkpoint](2026-10-04-nonvisual-continuation-checkpoint.md)を参照。この資料はコード・テスト・workflowを変更せず、新たなruntime成功を宣言しない。
