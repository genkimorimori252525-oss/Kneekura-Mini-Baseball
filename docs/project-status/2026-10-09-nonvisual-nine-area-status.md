# 元の非デザイン9領域：現在の残件入口（2026-10-11）

範囲は[PR340保存時の正本 §5](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/blob/6509e61f2474cc6bcfadda129f4b3c9621855c2c/docs/project-status/2026-10-04-nonvisual-implementation-checkpoint.md#5-残る確定済み非デザイン計画)を維持する。UI/design、新arsenal、未承認の数値モデルは含めない。以下は現在のコード・実証・仕様判断の入口であり、[従来の詳細な実行履歴](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/blob/91cd3035f8d8309eaafae34f44f312fd2e86759a/docs/project-status/2026-10-09-nonvisual-nine-area-status.md)を置き換えて成功へ読み替えるものではない。

現在の統合src treeは `3a3fd7e273694796e4db7e3971ceb021215533f7`。打者走行の欠落原本確認が別ownerの送球planReferenceを誤認する3分岐を修正し、参照内のownerとsourceIdを同時に照合する。実受理済みexit-stateを保持するIFN cp10入口と合わせ、独立review CLEAR、修正後の全compiler31.202秒と関連45件／7 files8.167秒がPASS。初回compilerの型不整合は保持し、元32経路の明示検査を加えて修正した。[修正・失敗履歴・検証](2026-10-10-terminal-proof-recovery.md#typed-batter-plan-claims-and-exact-ifn-cp10-batch)。

前回の統合src treeは `3dcc76c69323fdd3461d4af7ec7f61bafe646e2a`。新しいenrollmentの受理前・参加者の途中書込みでも、完成済み履歴を要求していたclaim確認を修正した。新対象はimmutable rootのscopeで照合し、既存ownerは従来どおり完全な原本・member・slotを認証する。PLの受理済みbaselineからの続行とLANの保存済みactor/modelからの続行を同じ27ファイルのバッチへ統合し、独立review CLEAR、全compiler32.590秒、関連24件／7 files64.617秒がPASS。元の失敗履歴とsource帰属は保持し、完了済み前半は繰り返さない。[修正と検証](2026-10-10-terminal-proof-recovery.md#fresh-enrollment-claims-and-exact-pllan-continuation-batch)。

以前の通常claim修正srcは `e5f3ed76710da25007774d59ba7ce661614f39b1`。通常のworkload予約確認でも既存の1確認内のimmutable読み取りを再利用し、同じenrollmentの完了release原本を共有する最小修正を接続した。一括review CLEAR、全compiler31.794秒、関連71件／6 files183.415秒がPASS。4個の独立assertionとcallback・書込み・retryごとの再認証を保持する。復元回数の減少は時間性能の証明とは扱わない。[通常claim修正と実証境界](2026-10-10-terminal-proof-recovery.md#ordinary-workload-reservation-release-proof-scope)。

元FR01のfresh caseは全体PASS。Nationalは保存済み裁定境界から元37 assertionの保持続行がPASSし、旧fresh failedは別に保持する。修正版IFNは固定 `e6de9bb3` でcatch-response7、cut32一式、走者/recovery modelとexit-stateまで実commit後、次のplan store openで3,022.982秒の機能failed。cp10からplan受理以降だけを続ける修正版入口が検証済みで、実行は待機中。PLは固定 `4d452cea` で元11人enrollmentとoccupied prefixがcommitし、TOTAL以降を実行中。LANも同じ固定sourceで新打者baselineがcommitし、enrollment以降を実行中。旧失敗と各保存点は保持する。[正確なsource帰属と実結果](2026-10-10-terminal-proof-recovery.md)を参照し、異なるsourceや部分結果を足して全体PASSとはしない。

1. **統合・archive互換** — 各owner、保存履歴、practice/能力/Manager、実接触/foul、同一PAと終端・成績の接続は一括review・compiler・関連検証済み。残るのはcurrent whole/archiveと元full Positiveの完了証拠。旧TODOだけを根拠に接続済みAPIを再実装しない。[統合記録](2026-10-10-native-continuation-batch.md#consolidated-verification)

2. **Field取得・支配・持替え・送球** — actual acquisition/custody/carried continuation、reserved same-PAのtransfer/release/中断/自由球は接続済み。過去の保持IFRでは実捕球・支配・送受球・動作の部分assertionが通過したが、上限や保守中断で全体未完。元IFN freshは固定 `35c05066` で14,400.211秒の上限failed。catch-response:6とcut31 prefix/TOTALを保存した。その後の固定e6続行でresponse7、cut32一式と打者exit-stateまで実受理され、次のplan openの誤拒否が今回修正された。残るのはplan/motorからterminal/scoring/次打者までを含む元シナリオ全体の実証。[接続範囲](2026-10-09-reserved-field-foul-batch.md)

3. **足・塁・race・catch/foul/retention/juggle** — actual足/塁/支配履歴、first-base判定、occupied runnerの直線移動・tag-up/retouch・home-touch、受信holdと停止、対応範囲の合法最終塁/得点は接続済み。Nationalの元first-base/call履歴から公式結果までの保持継続は完了した。移動occupied等の残るgenuine合成とlegal分岐の実証は残る。曖昧な権利・対応外順序・欠落原本はpendingを保持する。[exact履歴と消費境界](2026-10-09-occupied-runner-motion-connection.md)

4. **Venue/legal/call/review** — playable-wall、review journal、base/body/live-throw appeal、Play継続、通常release/守備者退出による期限、実appealの明示official受理からclosure/Matchへの接続は実装・関連検証済み。LANの元positive Native全体は未完。rollingから停止までの既存legal coverageも接続済み。屋根・壁上端・開口・dead/award/interferenceの未定義条件はユーザー仕様判断であり、新規ownerだけでは閉じない。[legal接続](2026-10-09-initial-play-and-appeal-window-continuity.md)・[残る判断](2026-10-10-nonvisual-policy-decisions.md#球場特則)

5. **因果timeline・closure・scoring・workload** — pitchから公式結果、TOTAL workload、既存8種類の打者/投手集計、AB/RBI/投球out数/長打種別、明示記録員判断、継承走者の投手責任は接続済み。未受理の判断はunknownを保持する。承認済みactor終了policy、他actor/通信/身体/custody/contact/ruleの独立証拠、occupied停止から公式適用も接続済み。National保持37 assertionとPLの実10人決済は返却済み。残るのはIFN/LAN/occupiedなど元genuine終端合成の完了証拠。[統計範囲](2026-10-09-official-player-outcome-statistics.md)・[終了policy](../implementation/2026-10-10-actor-producer-completion-policy.md)

6. **次pitch・between-play・foul reset** — 正規reset、controller退役、新launch/次actor、terminal foul、accepted bunt bindingは接続済み。元FR01は実swing/contact→foul停止→公式適用→reset→第4投TAKE→retry/reopenまでfresh全体PASS。BPNは旧sourceの回収可能な元21 assertionの保持続行がPASSし、fresh全体とは区別する。残るのはoccupied PL01とfull-owner half/final/次play合成の完了証拠。resetへ追加歩行や新bunt物理モデルを要件化しない。[継続範囲](2026-10-09-terminal-and-season-continuation.md)

7. **身体・locomotion・perception・controller** — owned body/model、受信判断/hold、有限直線5部位motion、exact sub-tick braking、既存固定offsetによる非zero swing recovery、絶対発行/反応時刻は接続・一括検証済み。actor終了policyは明示opt-inで、既発義務と閉鎖前の新情報を保持する。動いたoccupied runnerのroute/body/calibrationから実停止する接続も存在する。残るのは元same-PA ancestryを含むgenuine合成の実証。[recovery境界](../implementation/2026-10-09-owned-batter-run-binding.md#bounded-continuation-follow-up)

8. **能力生成・育成・実practice/機会** — 実practice、学習、Manager機会、実repetition、accepted assessmentとWorld CAS、能力履歴と通常consumer、National exposureは接続済み。元Nationalの公式結果・個人成績・両exposure・close/reopenの保持37 assertionは同一固定sourceでPASS。残る自律処方/appraisal、swingScore、測定/適応式・係数は、既存accepted入力で動く範囲と未定義producer/calibrationを区別する。参加だけの加点やneutral既定式を補わない。追加drill網羅を完成条件へ増やさない。[能力履歴](2026-10-10-accepted-physical-capability-history.md)・[残る判断](2026-10-10-nonvisual-policy-decisions.md#因果的な選手育成)

9. **自律Career・competition・roster・economy** — completed-game outcome/outbox retry、各domestic postseasonとWBC再開、採用/契約、calendar市場trigger、staff wages、明示season/dayから試合/roster実行、Manager発行判断から実行requestは接続済み。同日番号の別seasonを混同しない。残るのは実game/seasonと長期reopen/replay/人口・性能の証拠、およびCareer開始日/共通clock・自動前進の停止義務、CPU候補/応答/観測予測等の未定義政策。毎回人がCPUの結論を供給する運用を自律完成とは呼ばない。[accepted day](2026-10-09-accepted-domestic-calendar-day.md)・[残る判断](2026-10-10-nonvisual-policy-decisions.md#自律career)

次は既存の未完genuine経路を閉じ、必要な修正だけをまとまりで実装・review・関連検証する。終了したFR01/Nationalを最新headへの帰属更新だけのために再実行しない。未承認の3群は[短い判断メモ](2026-10-10-nonvisual-policy-decisions.md)にまとめ、提案を実装済み既定値として扱わない。
