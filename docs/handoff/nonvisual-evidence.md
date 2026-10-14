# 非デザイン9領域：実装・実証・未決仕様の引継ぎ

2026-10-14時点。対象は[元計画の正本 §5（固定commit `6509e61f`）](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/blob/6509e61f2474cc6bcfadda129f4b3c9621855c2c/docs/project-status/2026-10-04-nonvisual-implementation-checkpoint.md#5-残る確定済み非デザイン計画)の9接続である。現在の統合source treeは `b8e99a25cb5aa9afce821f27071687d13893c225`。最新の短い入口は[9領域の実装状況](../project-status/2026-10-09-nonvisual-nine-area-status.md)。この文書は古い進行中表示を現在のTODOに戻さず、後続の確定結果とその限界をまとめる。

**元計画全体は未完了。** 元LANの残工程、未完の複合試合・季節・長期実行の証拠、未承認の政策・校正を区別する。確定した作業量の分母がないため、過去の概算割合を現在の完了率として使わない。UI/design、新しい球種体系、追加drillや高精細身体モデルをこの引継ぎから追加要件にしない。

## 証拠の読み方

- **実装・関連検証済み**は、対象ownerやconsumerの接続と、その固定sourceのcompiler・有限検証を指す。元の長い複合ケースや全Careerの実証を意味しない。
- **fresh全ケースPASS**は、記載した元入力から元caseを最後まで実行した結果。**retained suffix PASS**は、保存された正規境界以後の残工程だけの成功で、前半は元sourceの歴史証拠として残す。別source・別lineageの一部を足してfresh PASSにしない。
- **genuine Native**は実SQLite owner・原本認証・実書込み経路の実行を指す。fixtureが明示した合成body/calibrationを、校正済みproduction数値や自律producerの完成証拠にはしない。
- 失敗、正式wall上限、環境中断による終端不明は別状態。途中のowner返却やcheckpointは、その境界の事実だけを証明する。現在のコードへの統合で、過去の実行source帰属は変わらない。

## 元9領域と現在の境界

番号と範囲は正本に対応する。「接続済み」は領域全体の完成認定ではない。

| 元領域 | 現在ある接続・再利用するもの | 閉じた証拠／残る境界 |
|---|---|---|
| 1. stack検証・統合・archive互換 | 原本保存、履歴再構成、archive、retry/reopen、各owner間の接続とsource別の一括検証 | 元Positive・40-pieceはfresh PASS。過去の結果を現在HEADのwhole／CIへ転用しない。LAN、未完複合経路、長期・人口規模の証拠は別に残る。[統合記録](../project-status/2026-10-10-native-continuation-batch.md#consolidated-verification) |
| 2. field取得・支配・carried continuation・持替え・送球 | actual acquisition/custody、reserved same-PA transfer/release、中断・自由球 | IFNは保持境界から公式記録・決済・release・次打者まで残工程を完了。LANも実捕球・保持・持替え・送受球は受理済みだが、公式終端までの合成は未完。[接続範囲](../project-status/2026-10-09-reserved-field-foul-batch.md) |
| 3. 足・塁履歴、first-base race、catch/foul/retention/juggle | actual接触・支配の履歴、first-base判定、occupied runnerの移動、tag-up/retouch・home-touch、対応範囲の最終塁・得点 | Nationalの元first-base/callから公式結果への保持続行は完了。LANのappeal試行をOUT認定に置換しない。移動occupied等の未完genuine合成、未対応順序や曖昧な権利は残る。[履歴と消費境界](../project-status/2026-10-09-occupied-runner-motion-connection.md) |
| 4. Venue surface/legal/dead/out-of-play/interference、call/review | rolling・playable-wall、review journal、base/body/live-throw appeal、通常release/守備者退出による期限、明示official受理からclosure/Match | playable-wallの限定実証はある。LAN公式合成と、屋根・壁上端・開口・dead/award・妨害の未定義policyを分ける。[legal接続](../project-status/2026-10-09-initial-play-and-appeal-window-continuity.md)、[政策](../project-status/2026-10-10-nonvisual-policy-decisions.md#球場特則) |
| 5. causal timeline、OfficialPlayClosure、scoring、legalMatchState、actual-role workload | pitch→公式結果、TOTAL、既存打者/投手集計・AB/RBI/投球out数/長打種別、明示記録員判断、継承走者責任、actor終了policyと独立した身体/通信/custody/contact/rule証明 | 元Positive fresh、National retained37、IFN/PLの該当残工程は完了。LANなどの未完genuine合成を残す。未受理の記録判断はunknown。[成績範囲](../project-status/2026-10-09-official-player-outcome-statistics.md)、[終了契約](../implementation/2026-10-10-actor-producer-completion-policy.md) |
| 6. next-pitch・between-play・foul reset/再開 | 正規reset、controller退役、新launch/次actor、terminal foul、accepted bunt binding | FR01 fresh、PL最終readback、IFN次actor/retryは完了。BPNは回収可能な元21 assertionのみ保持続行PASS。full-owner half/final等の未完合成は残る。resetに追加歩行や新bunt物理を要求しない。[継続範囲](../project-status/2026-10-09-terminal-and-season-continuation.md) |
| 7. General Player body/capability/generation/locomotion/perception/controllers | owned body/model、受信判断/hold、有限直線5部位motion、exact sub-tick braking、既存offsetのswing recovery、発行/反応時刻、route/body/calibrationから実停止 | 元same-PA ancestryを含む未完genuine合成は残る。actor policyだけで他actor・通信・接触・custodyを完了させない。[recovery境界](../implementation/2026-10-09-owned-batter-run-binding.md#bounded-continuation-follow-up) |
| 8. batter/role能力、生成・育成・実practice/出場機会 | 実repetition、学習、Manager機会、accepted assessment・World CAS、能力履歴とconsumer、National exposure。hidden trajectory/catalyst生成も既存 | National retained37と露出→practiceの限定実証あり。自律処方/appraisal、relevance/swingScore、測定・適応式と係数の未定義部分は残る。外部assessmentの受理を自動生成と呼ばない。[能力履歴](../project-status/2026-10-10-accepted-physical-capability-history.md) |
| 9. Club/competition/roster/scouting/Manager/team関係・mood/trait/popularity/star/developmentの自律Career | 既存Core/Native owner、completed-game outcome/outbox、domestic postseason/WBC、採用/契約、市場trigger、staff wages、明示season/day、発行済みManager選択→実行request | 実game/season、lower-tierを含む必要試合・成績、長期reopen/replay・人口・性能の実証は未完。共通clock/自動前進の停止義務と、候補/相手応答/観測予測の未定義policyも残る。[accepted day](../project-status/2026-10-09-accepted-domestic-calendar-day.md)、[Manager実行](../project-status/2026-10-10-issued-roster-execution-producer.md) |

限定コード照合で新しい通常APIの接続欠落が見つからなかったことは、9領域の完成証明ではない。逆に、古い文書の「未実装」だけを理由に、現在あるownerや接続を作り直さない。

## 元ケースの再利用可能な証拠台帳

時間は原記録のprocess／controlled execution時間を優先する。case時間と区別がある場合はリンク先に双方がある。これは主要な元ケースの完了境界であり、全テストinventoryや最新HEADの検証集計ではない。

| 元ケース | 固定source（GitHub保存commit／src treeの短縮形） | 確認済み結果 | 再利用できる証拠と限界 |
|---|---|---|---|
| [first-base Positive](../project-status/2026-10-11-original-positive-completion.md) | `c7928d3c`／`25eda7eb` | **fresh全ケースPASS**、50元assertions、906.119秒 | construction-only元入力から実OUT、将来通信/動くactor、corrupt-snapshot rollback、physical-end、終了後write拒否、reopen/retry。後期pre-end/ended入力への置換なし |
| [40-piece construction/archive](../project-status/2026-10-11-original-forty-archive-completion.md) | `c7928d3c`／`25eda7eb` | **fresh全ケースPASS**、64元assertions、4,578.339秒 | 元40個をfresh構築。両archiveのpost-INSERT fault/rollback、retry、偽manifest/peer-WAL拒否、close/reopen、4成果物。original32は来歴入力であり実行代替ではない |
| [FR01 foul reset](../project-status/2026-10-10-terminal-proof-recovery.md#fr01-original-fresh-scenario-completed) | `d4a17d49`／`728b6e36` | **fresh全ケースPASS**、7,511.742秒 | 実swing/contact→untouched rolling-stop foul→公式closure→controller退役/reset→第4投TAKE→conservation/retry/reopen。元callback/helper assertionsを保持 |
| [National official/scoring tail](../project-status/2026-10-10-terminal-proof-recovery.md#national-retained-official-and-scoring-progress) | `d4a17d49`／`728b6e36` | **retained37 PASS**、12,438.205秒 | 保存裁定からclosure/公式適用、missing-scoring assertion、成績、両National exposure、retry/reopen。35 owner calls返却。旧fresh 9,184.775秒FAILEDと未再実行のfresh入口3assertionsを保持 |
| [IFN release/next-batter](../project-status/2026-10-11-ifn01-cp13-release-suffix.md#executed-remaining-suffix) | `1835b6f8`／`8b8f1639` | **最終retained suffix PASS**、9,307.868秒 | 以前のsourceで保存したreview・公式scoring・10名決済から、release、same-source retry、記録読戻し、次打者受理/retry、CatchWork読戻しへ完了。元残工程を閉じたが `wholeCasePass: false` |
| [PL occupied readback](../project-status/2026-10-11-pl01-cp11-readback-suffix.md#actual-remaining-suffix-pass) | `838320cb`／`b96eb4fe` | **最終retained suffix PASS**、137.094秒 | genuine `readPhysicalPitch` deep equalityと元16表比較。以前のwriter/reopened retryは歴史証拠。旧14,400.134秒capはFAILEDのまま、`wholeCasePass: false` |
| [BPN accepted bunt binding](../project-status/2026-10-10-moving-runner-appeal-batch.md) | `67be6577`／`b4cd3f17`（tested code `fd3356da`） | **回収可能なretained21 PASS**、590.64秒 | 既存courseで実contact、World CAS、no-write guard、commitment retry、offline replay、12成功checkpoint。以前の一時的なpre-swing workload-head観測は未回収。fresh全ケースや新bunt数値モデルの証明ではない |
| [BI01 complete batting graph](../project-status/2026-10-09-fair-terminal-national-batch.md#later-observed-result-bi01) | `19a2755`／`d28d35c7` | **条件を明記した機能case PASS**、2,061.27秒、exit 0 | observation/delayed delivery、assessment、emotion World CAS、batting、2投目TAKE、callback-free歴史再生。別実行の生成Vitest cache差分を独立照合。元wrapperはFAILEDを保持し、除外は確認済み生成物1件だけ |
| 元LAN live appeal | import受理時と最新入口のsourceは[保存境界資料](../project-status/2026-10-14-live-appeal-proof-read-sharing.md#exact-retained-import-boundary)で区別 | **未完**。実import受理後の残21操作 | 実打球・捕球/支配・送受球・appeal試行・physical seal・review session・importが受理済み。rights pending、Match公式outs 0。最新入口のNative認証未完、journal4＋terminal17は未完 |

補助的なgenuine証拠として、[National exposure→実practice/retry/歴史membership（61.46秒、`19a2755`／`d28d35c7`）とplayable-wall（18.43秒、`aebf40a`／`ccc16d3b`）](../project-status/2026-10-09-fair-terminal-national-batch.md#observed-verification)もある。これらをNational全体や任意Venueの完成証拠に拡張しない。

主要sourceの完全な識別子は以下のとおり。短縮形を使うときも、この組と各原記録を維持する。

- Positive／40-piece: commit `c7928d3c5773604c21bd7b3c35eabb210344d26d`、src `25eda7eba860f766be6c6c3cdd99fa2d57ecc921`。
- FR01／National: commit `d4a17d490cba76cac4e8427503ee9ec726e7b758`、src `728b6e36cee03cc0667904b6ada2ea7661d5b427`。
- IFN最終suffix: commit `1835b6f8b59eefdf0c95e0f73040cf1ae5d6158f`、src `8b8f163940ba6d14c5727e136a3330db90631c3c`。
- PL最終suffix: commit `838320cb792cdae6d7d2023d1d9de75b8079bb4f`、src `b96eb4fe15f2577d0041b5c9389f0c5f10e3e59f`。
- BPN: commit `67be6577cabce8b3b7931f1111fd4fd9ff698b11`、src `b4cd3f17e30eb28598107e3a81dccc7b954c37ec`。
- BI01: 原記録のcommit表記は `19a2755`、[完全src](../project-status/2026-10-09-defined-match-career-consumers.md#verification-and-attribution)は `d28d35c7e92fe37c2accaa3520da8f00ae26661f`。省略されたcommitの残部を推測しない。

## 失敗と修正を取り違えないための地図

| 実際の失敗・不足 | 修正済みの原因／守った境界 | 現在の読み方と根拠 |
|---|---|---|
| Nationalの2playでimmutable roster/model/geometryが不整合 | 必要な19 Player/Personと共通model/calibrationを最初の受理前に宣言。古い受理modelを差替えず、修正lineageはfreshから開始 | 旧182.13秒の失敗と旧foul証拠は元lineageのまま。[宣言修正](../project-status/2026-10-09-national-common-fixture-correction.md) |
| LANのhold読取りがquery-only外、過去enrollment/empty executionをfreshとして要求 | 必要なquery-only transactionと既存historical readerを使用。current workload/cut AFTERの認証は維持 | 前半を再適用せず正規保存境界へ接続。成功前にassertion flagを立てない。[query-only修正](../project-status/2026-10-11-lan01-cp11-initial-play-suffix.md)、[historical修正](../verification/2026-10-11-lan-cut0-membership-retained-boundary.md) |
| LAN第2TAKEでhold期限不足、後続swingに前投posture期限を流用 | 受理前に元holdを有限60秒で宣言し、実timing/fatigueで3投とfield区間を確認。新postureは自身の区間とholdで制限 | 9,045.463秒の機能FAILEDを保持。受理済みholdの延長やproduction guard緩和は行わない。[時間窓の修正](../project-status/2026-10-11-lan01-cp5-pre-hold-suffix.md) |
| LAN実打球の最高中心高さ約0.980 mがglove最低接触高さ1.3234 m未満 | 捕球候補なしの正しい拒否。元swing校正の受理前境界へ戻り、明示fixture入力を整合させ、既存Coreで送受球/appealまで確認 | 8,452.046秒の機能FAILEDは保持。physics・body・取得guard・元期待結果を変えない。[失敗](../verification/2026-10-12-lan-field-calibration-retained-boundary.md)、[受理前校正](../verification/2026-10-12-lan-swing-calibration-cp19.md) |
| IFN batter-plan claimが別ownerのthrow-plan参照を誤認／refresh work IDがtargetを落として衝突 | ownerとsourceIdを同時照合。衝突するobserver/cause群だけにtyped targetを含め、既存singleton ID・archive hashを保持 | 別の2原因。10,064.263秒の重複ID機能FAILEDも、後の14,400.107秒capも残す。残suffix PASSは別source。[claim](../project-status/2026-10-10-terminal-proof-recovery.md#typed-batter-plan-claims-and-exact-ifn-cp10-batch)、[target修正](../project-status/2026-10-11-ifn01-cp35-review-suffix.md#target-identity-correction-and-integrated-qualification) |
| National裁定後に `deriveOfficialPlayResult is not a function` | 実行観測wrapperの循環re-exportをobject spreadが未初期化で固定した。live exportを維持して観測対象だけwrap | production関数欠落ではない。fresh FAILEDを保持し、修正後の同固定source retained37だけをPASSとする。[原因と続行](../project-status/2026-10-10-terminal-proof-recovery.md#national-fresh-failure-and-preserved-adjudication-frontier) |
| playable-wallのunsupported rule profile／fair確定前にwallへ到達 | 既存NPB profileを採用し、独立したfair base-gateの先へwallを宣言、初回field出力前にhorizonを固定 | 2回の失敗を消さず、最終の限定genuine PASSだけを採用。[wall実証](../project-status/2026-10-09-fair-terminal-national-batch.md#observed-verification) |
| collectorのtest名表記差、誤期待件数、生成cache差分 | 元declaration・実report・formatter・入力pinsを独立照合。元wrapper失敗は保持。未選択caseをPASSに加えない | 再集計と機能実行を分け、複数sourceの件数を新しい一括PASSにしない。[集計例](../project-status/2026-10-13-field-rule-pair-read-sharing.md#finite-validation-inventory)、[BI01例](../project-status/2026-10-09-fair-terminal-national-batch.md#later-observed-result-bi01) |
| 正式wall cap／環境の保守・接続中断 | cap receiptがあるものはFAILED。正式terminalがない中断は終端不明。後の環境でprocessが見えないことだけでは旧cleanupを証明しない | 完了済みcheckpoint以降の成功・正常timeout・機能不良を推測しない。最新LANの通し結果と新入口認証は未完。[現在の境界](../project-status/2026-10-09-nonvisual-nine-area-status.md#残る元lan経路) |

IFNの元 `all_offense_terminal` にある微小残速度は、その意図した経路の状態であり、停止・quiescenceの証明ではない。閾値を追加して停止扱いにする修正を再提案しない。

## 最適化A–E：測定した範囲だけを引き継ぐ

すべて既存の接続・transaction/read phase内で完了済みのimmutable証拠を共有する変更。完全参照、current admission、接続guard、private savepoint、失敗時の無効化を維持し、writer/callback/変更/rollback/commit/独立retryをまたいだ共有をしない。

| 変更 | 固定src tree | 完了した資格化・比較 | 測定の限界 |
|---|---|---|---|
| [A: field-rule pair](../project-status/2026-10-13-field-rule-pair-read-sharing.md) | `ab5e2eaf2d26d98b32246d754493a612d9522cc2` | compiler 39.365秒、7files/110件 26.564秒PASS。同cp11 CatchWork read 588.335→492.347秒 | 1版1回。後述Bがmemo hit前のATTACH接続guardも補正 |
| [B: historical hold/TAKE](../project-status/2026-10-13-hold-and-take-read-sharing.md) | `e39ff2b0ab0adacf59550b3c72b95249af11add8` | compiler 41.696秒、10files/134件 27.716秒PASS。同read 492.347→388.349秒 | A含む3readerでwarm ATTACH guardを復帰。hold/TAKE個別の寄与は未測定 |
| [C: original reserved view](../project-status/2026-10-13-original-reserved-view-read-sharing.md) | `abb58d1dea9b3acd2caa6ea5e5b40e181a342bcc` | compiler 42.031秒、12files/144件 212.157秒PASS。同read 388.349→230.227秒 | A–C合計60.9%短縮。一時重複した予備実行は正式検証・性能比較から除外 |
| [D: live-appeal import read proof](../project-status/2026-10-14-live-appeal-proof-read-sharing.md) | `5ca60ca85daafc4f70b2a8bcd6f44491ffa0208a` | compiler 38.259秒、7files/86件 10.981秒PASS。同cp16/accepted Sourceの `deriveEvent(source, null)` は1版1回で1,425.839→221.895秒。CPU 1,430.480→223.130秒 | wall84.4%短縮は既存read transaction内の1read。12 seed callsを5独立proofに保持。writer全体の時間ではない |
| [E: terminal transition/release](../project-status/2026-10-14-terminal-read-phase-sharing.md) | `b8e99a25cb5aa9afce821f27071687d13893c225` | compiler 34.514秒、関連2テストfiles/43件 199.469秒PASS。同一transaction内の祖先復元を共有 | 初回180秒capは未完FAILED、正式case数なし。同内容を360秒枠で再実行。実時間改善・初期認証全体への寄与は未測定 |

A–Cは同じ監査済み入力・Node 26.10.0、各版1回の独立processで返却全文19,442 bytesとraw/canonical hashが一致し、DB bytesが不変。先行成功測定は再実行せず次のbaselineに使用した。Dは別の同一入力の独立コピーを用い、全文68,481 bytesとraw/canonical hash、DB/schema不変を確認した。いずれも設定復帰・入力pins・cleanupを確認したが、並行Native実行と外部競合を同条件に制御した比較ではない。**全owner・全ケース・残り所要時間へ外挿しない。**

実importのentry→returnは以前の固定sourceで6,267.968秒、`committedChange=true`。これはDのread比較とも、初期認証時間とも別の測定である。Eの43.794秒/149.509秒は各test fileの実行時間であり、before/after benchmarkではない。

## 承認済み契約と未承認の3群

[actor producer終了policy](../implementation/2026-10-10-actor-producer-completion-policy.md)は承認・実装済み。`consume_issued_work_reconsider_information_v1` は明示opt-inで、既発指示/反応/動作を実消費し、閉鎖前の新情報を再判断する。身体・通信・ball/contact/custody・rule・他actorの証拠を独立に要求する。静止、horizon、queueが空であることだけをphysical PlayEndや公式結果にしない。

以下は[政策・校正判断メモ](../project-status/2026-10-10-nonvisual-policy-decisions.md)の未承認部分。メモの「初期案」は既定仕様ではない。

1. **球場特則**：最初に扱うVenue/RuleProfile、屋根・壁上端・開口、打球/送球のdead・award条件と基準時刻、妨害者の適格性・意図・結果、geometry/material。未記載事象をfair/liveと仮定しない。
2. **自律Career**：開始日/season対応、共通clock、自動前進を止める未完義務、候補生成・順位/打診/見送り/再交渉、相手応答、判断起動・観測/予測生成。既存の[Manager選択](../../src/core/world/manager/ManagerControlledDecision.ts)はadmitted候補と保持beliefから既に選べ、[発行済み選択から実行](../project-status/2026-10-10-issued-roster-execution-producer.md)もある。「CPU選択がすべて未実装」と記述しない。一方、毎回人が結論を与えるだけの運用を自律完成にしない。
3. **因果的育成**：自律処方/本人appraisal、relevance/swingScore、身体・能力の測定/適応式、係数・閾値・確率・cooldownの校正。[Person priors生成](../../src/core/world/development/PlayerPersonPriors.ts)は既存の[trajectory](../../src/core/world/development/DevelopmentTrajectory.ts)と[catalyst](../../src/core/world/development/DevelopmentCatalyst.ts)を明示policy/seedから生成する。「hidden profile生成がすべて欠落」と記述しない。ただし、その存在は実行から測定/学習値を自律生成する因果モデルの完成証拠ではない。参加だけの加点やneutral式を補わない。

次の仕様相談では、上の未確定項目と以下の初期案を3群まとめて提示できる。**いずれも提案であり、未承認・未採用。** 方針への同意だけで未定義の数値や条件が確定したことにはならない。

| 政策群 | ゲーム上の例 | 推奨初期案（未承認） |
|---|---|---|
| 球場特則 | 屋根への打球、観客席への送球 | 最初の1会場・1RuleProfileの基準規則と特則を明示し、未記載事象は未解決に保つ |
| 自律Career | 翌日の給与・補強・試合前roster | 共通実日付で1日ずつ進め、未完試合・必須決済・必須判断/入力不足で停止する。通知だけでは止めない。補強は既知レポート・既存予算/役割policy・提示済み条件、rosterは受理済みGame Plan候補から始める |
| 因果的育成 | 代表戦の経験から練習し、定着した技術を次戦で使う | 既存実行familyで処方し、実消費・負荷・定着後にdomain別の受理再測定を反映する。測定なしに能力増分を補わない |

## 次の担当者が維持する停止条件

今回の引継ぎは文書整備であり、新規Native・benchmark・CIの実行を含まない。環境中断を理由とした自動再試行・別環境への起動も、所有者の新しい依頼なしに行わない。

再開時は、まず元LANの受理済みimport後の**単一の正規lineage**と残journal4＋terminal17を確認する。最新入口の有限23件PASSはNative認証成功ではない。完了済みの前半を書き直さず、異なるlineageを合成せず、完了済みFR01/National/Positive/40-piece等を最新sourceへの帰属更新だけのために再実行しない。LANが完了しても、元9領域の未完複合試合・季節・長期検証と上の未決仕様を別途評価する。
