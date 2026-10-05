# 非デザイン残計画: 実装と検証の境界

更新: 2026-10-05 21:33 UTC。[既存の残計画 §5](2026-10-04-nonvisual-implementation-checkpoint.md#5-残る確定済み非デザイン計画)の状況を整理する。新しい機能範囲を追加する資料ではない。**計画全体は未完了**。Draft公開やfocused test数を完成率に換算しない。

このcheckpointの統合コード基準は固定`c68a3dc47196b1aae2cd678470ebaad207992d1a`、src tree `183e367eda89426b32707bb1d5d5e108ddc59455`。4 sliceの409件とcompilerが通過し、[read改善 #322](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/322)、[runner履歴 #323](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/323)、[Manager履歴境界 #324](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/324)と本foul-count差分に分けて公開する。途中stackのsrcと最終統合srcを区別する。Foundation `44b9f5de7b9d87e649f12f1af78c202f2b5ab44d` / Realism `4f0a60a3818926327b6bf5877ab3dec456a76530` は20:47 UTCのremote再確認で不変だった。

| 既存計画の範囲 | 実装の位置・残るコード接続 | 完了証明の位置・残る検証 |
|---|---|---|
| 1. 統合・再生互換 | 実next接続は#321で公開。4 slice統合`c68a3dc`の409件・compilerが通過。各段のsrc identityと互換境界、実artifactの固定Sourceは別に保持 | 最新完了wholeは#277の697 files / 5,159 tests + typecheck。`5054f44`のcompiler・115 Native・1634 Node・56 PythonはSource不変で通過。実artifactの`0b28f1a`結果をこの統合Sourceへ転用しない。21:31 UTCから`c68a3dc`の909 files（通常902・別artifact7 files/9 cases未実行）累積を実行中。まだPASSではなく、40-piece archiveも未完了 |
| 2. Field acquisition / custody / transfer / throw | 元の身体・接触・支配から取得、持替え、release、全10人50部位のmotion adoptionへ接続済み | 登録済みprofileのoriginal pitch→first-base physical endは通過。任意の一般play全体への完了証明ではなく、最新統合Sourceのwhole/archiveは別途必要 |
| 3. 足・塁履歴、first-base race、catch等 | Actual prefixの足/塁/支配履歴とfirst-base解釈を接続済み。広いfoul/retention等の分岐は個別境界を保持 | 第一塁の元接触→判定→physical endの証拠あり。全legal分岐を通した意味ではない |
| 4. Venue / legal / call / review | Untouched settled foulのpolicy・observer・原始countと打撃前の明示intentを#317で公開。Review journalと公式closureの版付きpinを#319で公開。Read-only foul count receiptを本差分で接続。因果stop producerとconsumer、広いsurface/dead/out-of-play/interferenceの接続は残る | Venue統合`5d4d138`の158件+compiler、review統合`40c39fe`の256件+compilerは通過。Review focusedは実SQLiteを使うがphysical readerはmockであり、実物理artifactのreview→closure gateは未実行。別Sourceの普通foul/bunt実物理3件は通過、count17件とcompilerは固定`bdfb7ea`で通過し、統合`c68a3dc`でも物理3件・count17件を通過。詳細は[venue](../verification/2026-10-05-venue-evidence-and-original-intent-current-proof.md)・[review](../verification/2026-10-05-actual-post-play-review-journal-and-closure.md) |
| 5. Causal timeline / official closure / scoring / workload | 元pitchから物理終了、operative call、公式適用、10 controller退役まで接続済み。全10人workload ownerも実装済み。一般play/scoring全体の完了とは区別 | 固定`6eb9dd6`のactual officialは通過。固定`1c95810`の実10人workloadは16:54にterminal PASS。実INSERT rollback、全員適用、retry、全接続close/reopen、別copyのrecoveryを確認。playable artifactは10 MATCH・0 RECOVERY。詳細と固定Sourceは[terminal証拠](../verification/2026-10-05-actual-ten-role-workload-terminal.md) |
| 6. Next pitch / between-play / foul resume | 元physical end→公式適用→全10人workload→次actor/実pitchの段階別接続を実artifactで確認。同一PAのfoul再開と同一gameの次打球には版付きepisode/geometry接続が残る | 固定`416da3`の2回のread-only再認証後、固定`0b28f1a`の実next gateが20:27 UTCにPASS/reap。全30 raw pinを検査し、実actor INSERT rollback、1 actor・1 physical pitch追加、retry・全接続close/reopenを通過。`wholePipelinePassed:false`はnext単段の区分であり、原始receiptを継承した実順次chainの失敗を意味しない。同一Source一括再実行は未主張。[terminal・継承証拠](../verification/2026-10-05-actual-next-pitch-chain-terminal.md)を参照。正本§9の`rule_system`による不連続配置を使い、歩行軌道を要件として追加しない。`physicalWorldRecoveryProven:false`を保持し、日単位recoveryを経過World時間の証明へ転用しない |
| 7. General Player / runner / body / controller | 既にownedな追加runnerを含む11人55部位、retained後続pieceとsensory projectionを#318までで公開。Runner knowledge historyと明示decision/motion modelを#323で公開し、原始intakeのroster検査を保持。General decision→motor、received-call後のcontroller、一般生成・必要接触の接続は残る | Retained runner統合139件+実file Native1+compilerは通過。Legacy8件の180秒gateは中断・未通過。Projectionの最終統合`6971ecb`で54件+実file Native1+compilerを通過（[証拠](../verification/2026-10-05-owned-runner-sensory-projection.md)）。History/modelは110 focused・112既存互換、fixture修正後の2 Native・compilerを通過し、統合`c68a3dc`で全224件を再通過。誤った空PlayEndを置いた旧Native失敗は保持。最終fence検査は明示的な合成admission fixtureで、一般11人PlayEndの証明ではない。任意runnerの自律行動証明ではない |
| 8. 能力・実practice・機会・育成 | 実pitching practiceをdelivery/body/timing/fatigue/workload/episodeへ接続済み。別NORMAL/QUICK probeからaccepted learningへ接続済み。Human World practice order、shared reservation、post-write再検査を#320で公開。Managerのhistorical belief境界を#324で公開。Manager practice選択経路は別候補実装で、261件GREENは未実行 | Practice55件、learning統合87件+compilerは各固定Sourceで通過。Human orderの最終統合`a6a0b41`で200件（order50・既存122・learning28）+compilerを通過（[証拠](../verification/2026-10-05-owned-practice-order-integration.md)）。Manager historical境界は19件と追加2件のRED後に43件・compilerを通過し、統合`c68a3dc`でも再通過。Accepted prescription・測定/標準化結果を自動生成したとは主張しない |
| 9. Club / competition / roster / Manager / Career | 既存Core/Native ownerとactual Match結果→World/Career adapterを保持。一般の試合・season・機会生成と各ownerの自律実行の接続は残る | Adapterのfocused結果は存在するが、一般gameからseason/Career全体が自律的に進む実artifact、長期reopen/replay、必要人口・校正・性能の完了証明はない |

## 次の判定点

1. 完了した実official→全10人workload→実next pitchの原始receiptとSource別再認証を保持する。この実順次chainのPASSを計画全体PASSや同一Sourceのwholeへ読み替えない
2. 完了した実chainを重複構築せず、Source固定のRED/修正/関連回帰を直列に実行し、実review、因果foul、Manager practice、runner判断の接続を進める
3. 同一PAのfoul再開・次打球と残る一般行動/Careerを継続する。Read-only countや候補modelの実装を、因果適用や自律行動の完了へ読み替えない
4. 固定`c68a3dc`で実行中の累積wholeをterminalまで追い、別archive互換を完了する。過去Sourceの成功を後続Sourceへ転用しない

Received callには未接続の境界がある。実通信と知覚receiptは存在するが、Native defensive ownerは通信付き初回判断とissued後の再判断をまだ受理しない。UmpireのOUT/SAFE payloadも既存runner coach-action / defender cover-baseと同じ意味ではない。現PlayEndはreceived/due callを`received_call_controller_consumption_pending`で止める。将来配信の予約を「選手が受信して反応した」証拠にしない。

明示的なaccepted policy、身体parameter、effort評価、標準化測定などの入力境界は残す。入力がない場合のpendingと、入力から先へ進めるコード自体の欠落を区別し、未確定の係数や校正値を推測して埋めない。

詳細なSource別結果と公開履歴は[継続checkpoint](2026-10-04-nonvisual-continuation-checkpoint.md)を参照。この資料はコード・テスト・workflowを変更せず、上記の実行済み固定Sourceに限定して結果を記録する。

現在の4 slice統合と累積実行の正確な範囲は[統合証拠](../verification/2026-10-05-original-foul-count-and-current-integration.md)、個別ownerの証拠は[read改善](../verification/2026-10-05-guarded-child-read-promotion.md)・[runner履歴](../verification/2026-10-05-runner-history-and-explicit-model.md)・[Manager履歴](../verification/2026-10-05-historical-manager-belief-boundary.md)を参照。
