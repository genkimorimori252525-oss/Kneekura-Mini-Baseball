# 非デザイン継続実装: 現在の接続と検証

更新: 2026-10-05 18:23 JST（2026-10-05 09:23 UTC）

ユーザーの継続指示に従い、最新の確定済み残計画を進めている。**計画全体・自律試合/Career全体の完了ではない**。デザイン/UI/art/Presentationは未接続のまま。

## 2026-10-05 09:23 UTC: official stage と実 practice の検証

登録済み profile の原始物理終了を使う固定 `6eb9dd6` の **actual official-only stage がPASS**。09:07 UTCにexit0、4,711.203秒、peak RSS 436,116 KiB、全process回収・全SQLite接続close。Adjudication/applicationの実INSERT改変rollback、1回だけの公式適用、元10 controllerの退役、close/reopenと同一retryが通過し、Source・原始input・監査receiptは不変だった。これは段階別結果であり、全10人のactual-role workloadと実next pitchはまだ未完了。H/E分類は正本が許容する明示unsupportedを保持する。後続workloadのprivate読取りをtransaction内に限定する性能修正は、consumer側のfreshな改変検査を保って別に検証中。

実pitching-practice ownerを既存delivery/body/timing/fatigue/workload/episodeへ接続した。固定 `6e6919f` は **5 files /55 tests、0 skip、full typecheck PASS**。完全なsrc treeは `58540a7188fe74e4d423a89bcb2241fb4933e68d`。明示opportunityからconsumed phase、独立effort/health評価、PRACTICE workload、適格な既存episode eventへ進み、Matchを捏造せず再開・retry・rollbackする。詳細は [practice verification](../verification/2026-10-05-actual-pitch-practice.md)。Raw timingの能力測定化や自動学習生成は含めず、実probeからaccepted measurementへの接続を続けている。

この2件と、一般runner・venue/legal・review・Careerの後続実装を継続する。**計画全体は未完了**。最新完了の累積wholeは引き続き#277の697 files /5,159 tests + typecheckであり、今回のfocused結果を後続全体の成功へ転用しない。

## 2026-10-05 08:57 UTC の検証位置

登録済み `npb-2026` を最初の Match から選ぶ新しい lineage で、元 pitch から実物理終了までの段階別 Native 検証が完了した。旧 `test-rules` fixture の official 失敗とは別の実行であり、旧証拠の profile は変更していない。

- Original construction: 固定 `23e4ef0`、Native **1/1、0 skip、exit 0**、355.327秒。元 pitch・10人50部位・実接触/知覚/判断/motor・一塁判定までを生成
- Pre-end tail: 固定 `56d96a7`、Native **1/1、0 skip、exit 0**、2,818.440秒。実 operative call、後続の独立判断と全10人の情報消費、全接続を閉じた通常 owner での reopen を確認。終了前DBは `64fc22bf43b656492aad85b6a8042e3862bd4fcf8132482cceca5f6109e8dc71`
- Physical end: 同じ固定 `56d96a7`、Native **2/2、0 skip、exit 0**、716.724秒。実 seal INSERT 後の改変 rollback、clean commit、close/reopen、同一 retry が通過。72 table / 145 rows、end1 / seal1、WAL0。元の70非終端tableを保持し、終了DBは `585ab7862ab93991e97cd5032ba8d520e113635559aa0019b5dd9bd43257a04a`

終了前/終了後の検証専用 synthetic DB と明示的な publication manifest は [Draft #305](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/305) に保存した。Raw receipt と publication projection を区別している。詳細は [fresh end gates](../verification/2026-10-05-known-profile-end-gates.md) を参照。

[Draft #306](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/306) は既存 roster evidence が canonical JSON の object key 順により拒否される問題を修正する。Array 順序・値・余分な fact の検査は保持し、統合固定 Source で **13 tests、0 skip、full typecheck PASS**。この独立修正は #305/#307 の production Source には含めず、次の統合 Source に取り込んでいる。

[Draft #307](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/307) は新 lineage の原始15 file と同一実行の rollback witness を別の producer contract として検証する。固定 `6eb9dd6` で **355 controls、0 skip、full typecheck、helper import、実15-file admission、supervisor smoke PASS**。旧 producer の82 controlsも含む。Publication の実行module/testはこの固定 Source と同一bytesで、production `src` は変更していない。

この終了DBを使う actual official-only 検証は **実行中**。Physical proof の再認証、adjudication INSERT 改変 rollback、原始 call/rule の取り込み、queued disk の close/reopen、official application INSERT 改変 rollback を通過し、clean official application/retry の確認を続けている。Terminal receipt はまだなく、official stage の成功とは記録しない。後続の全10人 workload と実 next pitch は未完了。

次 play の境界は正本 [adjudication §9](../game-design/07-world-first-adjudication-contracts.md#9-between-play-world-reset) に従う。閉じた live action の外では明示的 `rule_system` setup を認め、元の終端・公式ledger・controller退役・全参加者の実 workload/recovery・次 actor/pitch の整合を認証する。連続した帰還歩行を未承認の新要件にせず、`physicalWorldRecoveryProven: false` は連続移動についての正直な境界として保持する。

一般 runner の11人55部位への field 接続、実 pitching practice と既存 learning の接続、venue/legal の追加範囲、既存 Club/Career の実行・統合検証は継続中。**最後に完了した累積 whole は #277 の697 files / 5,159 tests + typecheck**。今回の段階別成功を #278以後の累積wholeや非デザイン計画全体の完了へ読み替えない。

## 2026-10-05 06:32 UTC の検証位置

最新の公開済み統合は [Draft #304](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/304)。登録済み `npb-2026` を最初の Match 作成時から選ぶ fixture と、既存 World 接続・同一操作内の物理履歴再利用を含む。**非デザイン計画全体の完了ではない**。

- 元の物理プレー終了は固定 `9e27dc8` で実 Native **2/2、0 skip、exit 0**。実際の seal、全接続を閉じた再開・同一 retry、元の70非終端tableの不変を確認した。閉じた最終DBの SHA-256 は `3627a8d4e7cf99404eef8a6eefd22af591317a6dedcf46d82a0f61972dfa9331`。公開済みの最初の終了DBは別の保存bytesだが、全tableの論理行が一致する
- この旧fixtureは登録外の `test-rules` を初期Matchに持っていた。後段の公式確定は固定 `444b618` でその不一致を検出して **exit 1**、公式INSERT前に停止した。終了成功を公式確定・workload・次投球の成功へ読み替えず、旧DBを書き換えて規則IDを付け替えることもしない
- 新規 `npb-2026` 系列は固定 `23e4ef0` で投球から全10人・50部位、実capture、独立した観測→判断→motor、first-base OUT ruleまで **1/1、0 skip、exit 0、355.33秒**。全接続を閉じて再開し、63 tables / 113 rows、WAL残存0を確認した。新DB SHA-256 は `60525735348ea48aeb1944e7c1b2dc2d3afd6fdac8961d83486d2f4a4c6df0f4`、raw terminal SHA-256 は `215e7ad43ac770f0423405a658721467032f0a5151449fa2cb4d9af422850209`。end/seal tableはまだ作成されていない
- 新系列の実際の遅延審判call、post-call物理区間、将来判断・通信を作る継続は固定 `56d96a7` で実行中。型検査は直前の `f86a7de`、timeoutのみ変更した `56d96a7` の構文/import確認では3 Native casesを明示skipした。これらの準備確認は、実際のtail・新しい終了証拠の成功ではない
- [#299](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/299) のlegal inning/final接続は型検査と21 files / 154 tests、[#301](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/301) の既存DomesticSeason/World接続は型検査と28 files / 208 testsを通過した。独立したaccepted入力の試験であり、今回の本物の物理系列から全試合・Worldまで通った証拠ではない
- [#300](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/300) の操作内物理履歴再利用は型検査と29 files / 236 tests。[#303](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/303) の同一観測による履歴構築の共有は型検査と12 testsを通過した。旧終了DBの同じ読取りは82.694秒から72.693秒へ短縮し、SQL集計・物理projection・history・元DB bytesは一致した。単発の比較であり、一般的な性能保証ではない
- 40-piece archiveの全受入れは引き続き未完了。以前の21区間時点の中断を成功へ変更していない。元のrunnerを含む11人・55部位のfield接続と、実投球練習の所有・workload・development接続は別の実装/検証中
- 最新の累積whole成功は **#277の固定Source、697 files / 5,159 tests + typecheck**。#278以降のfocused gateを合算して新しいwhole成功とはしない。次のまとまった統合Sourceを固定し、通常suiteと明示artifact gatesをそれぞれ実行する

次は、新系列の実call/tailから新たなseal rollback・終了を確認し、その閉じたDBを公式確定、全10人のworkload、実際の次投球へ渡す。以後の一般runner/body、練習・出場機会、既存Club/competition/Career接続も継続する。数値calibrationや結果を推測して不足を埋めない。個別のSourceとreceiptは [known-profile verification](../verification/2026-10-05-known-profile-fixture-preflight.md) に記録している。

## 2026-10-05 00:09 UTC 時点の復旧履歴

以下は 2026-10-05 00:09 UTC 時点の更新。後段の古い個別記録は各固定Sourceの履歴であり、最新Source全体の合格へ読み替えない。

- 本追補直前の公開済みDraftは [#293](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/293) まで。復旧後の実Sourceは #286–293 の独立review・固定Sourceの検証を経て順次保存した。失われた未公開部分を再構築した箇所は、元のbytes/hashと同一とは主張していない
- 元の投球から全10人・50部位の捕球、実際の観測→判断→motor採用、fair OUT ruleまでのNative構築は、固定 `bf8233fa` で **1 test / 0 skip / exit 0**。全2,024 tracked hashes不変、全connectionを閉じた後の再開とbackupを確認した
- 続くPositiveは operative OUT、post-callの実物理区間、2人目の将来判断、全10人の将来通信まで進んだが、23:17:14 UTCに `Worker exited unexpectedly` でexit 1。physical PlayEnd/sealの合格ではない。元Sourceと入力artifactは不変だった
- 元の構築fixtureと終了直前fixtureは [checked synthetic fixtures](../verification/fixtures/README.md) に保存済み。後者は72 tables / 143 rows、end/sealなしで、実試験のtrapも明記している。継続は別copyを使い、元のowner検証を省略しない
- Vitest forkは親Nodeのheapフラグを引き継がなかったため、以前の「worker 1 GiB」の資源設定主張を訂正した。正しいfork内receiptを伴う `NODE_OPTIONS` を使う。構築の正しさ・Source不変の合格は維持するが、kernel OOMの原因までは断定していない
- 新しいread-only診断は180秒の明示上限で停止した。worker peak RSS約297 MiBで直ちに異常増大は再現せず、rule consumption到達前に256,720回のSQL prepareを観測した。さらにtest用のwrite witnessが全prepare結果をVitest spy履歴に保持する不具合を特定した。これらを分けて修正・検証中であり、診断停止は受入れ合格ではない
- 40-piece archive試験は21区間のcommit後に性能診断のため明示中断した。部分snapshotを保存しているが、40区間の受入れ完了ではない。最新のscoped archive再利用candidateは実disk/WALの4ケースとbaseline/candidateのSQL・bytes一致1ケースを通過した。固定 `4867087` は最終統合typecheckと17 files / 170 testsを通過し、全2,058 tracked hashes不変、exit 0を確認した。実際のend継続はこれから
- 最新の累積whole成功は **#277の固定Source、697 files / 5,159 tests + typecheck**。#278以降へ転用しない。現在Sourceのwhole、physical end→official→全参加者workload→実次投球の通し検証、一般runner/body/practice/Club competition/Careerは未完了

現在の優先は、保存済みの同じ本物のplayからphysical endを検証し、公式確定・workload・次投球へ接続すること。新しい数値calibrationや完了flagで不足を埋めない。

## 公開済みの積み上げ（以下は各時点の履歴）

| Draft PR | 実装commit | 接続した範囲 |
|---|---|---|
| [260](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/260) | [55cacd18](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/55cacd18dc2f709bd058f0e74dfd55ed0ef57cbb) | actual field acquisition/custody/transfer/throwの所有 |
| [261](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/261) | [2b35ecaf](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/2b35ecafb1fc1bb77d96f92c6891613d69d3c59f) | 足/塁/支配履歴とactual first-base rule |
| [262](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/262) | [83838144](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/83838144dff16b9af4e553570d09b9ea78b5b132) | 未解決truth/call分離、continuing contact修正、original pitchからwhole-play physical history |
| [263](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/263) | [e2f635da](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/e2f635daded52326404bcda09935057639591c72) | 持替え途中の保存/再開、exact release、source固有queueとball/contact handoff |
| [264](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/264) | [de36ce08](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/de36ce08c310ab382fe25328dc27d4c143354ba1) | Player/Personにpinした明示的な観測calibration baseline |
| [265](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/265) | [2e361ee4](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/2e361ee47e8dc32297b51fc185ab911b3ebac681) | 旧atomic release境界のversioned custody補正とarchive互換性 |
| [266](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/266) | [54860afb](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/54860afba63dc33a20b421610cad29eba7eeca71) | actual fieldからのview/attention、知覚receipt、noise/memory、bounded replay |
| [267](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/267) | [f1b24ca1](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/f1b24ca1701b66872a95961d4334880cccc6746f) | scheduled capture、exact confirmation fence、拘束中の知覚、未確認支配による誤SAFE防止 |
| [268](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/268) | [bc29c37c](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/bc29c37cdb6787007202851363a4066d1cee1bf9) | fielding/observation modelのPlayer/Source identity mirror改ざん時の二重所有防止 |
| [269](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/269) | [be2851ae](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/be2851ae552b045ccdeebd215e06ebe760960b32) | 明示的な個人decision/first-step calibrationのimmutable所有 |
| [270](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/270) | [815b7b21](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/815b7b21ef416f36877a3e3865187d1e9d3b95b1) | 旧atomic acquisitionの同時刻glove拘束/ground履歴をarchive互換で接続 |
| [271](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/271) | [917016f4](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/917016f4ffb11374d5933c092097d9c6a869e5ab) | actual observation履歴と3モデルの重複JSON identity所有を検査 |
| [272](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/272) | [0fa664bb](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/0fa664bb696dd061a0d339e75ca60674ca30483d) | 実知覚に基づく個人判断、pending判断/初動、実際の発行時刻とimmutable履歴 |
| [273](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/273) | [e023ef96](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/e023ef96280389fb1affb1f1db5ba99afb112ce8) | original World/command履歴からPlayer rootと5部位のrelative kinematicsを復元 |
| [274](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/274) | [afb6ed03](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/afb6ed03e3b53dc4ccc56ef73f66be73fee06724) | Player/Person/fieldingにpinした明示的locomotion calibration |
| [275](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/275) | [5a7caf77](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/5a7caf7746130ac78fa7da565d98ac2f517a7868) | 判断deadlineと未消費motor/adoption workのread-only Source固有投影 |
| [276](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/276) | [329a03f4](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/329a03f44fb3dbbc15ae3857d8a41a87da5cbf0d) | actual checkpointと明示command coverageの分離、元のactor曲線を保つretained継続 |
| [277](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/277) | [e93bf5dc](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/e93bf5dc3cfab034895a5642b8be3d919ef4c17c) | 実際に発行された個人判断から、元のrelative指令を保持するbounded初回motor receipt |
| [278](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/278) | [8c584e5e](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/8c584e5ed53165d3d037b705c3dbbd76ef9f5455) | 全10人・50部位のowned/retained指令合成、実物理へのatomic adoptionと独立due work |
| [279](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/279) | [df558bd4](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/df558bd4ab2491b386e99e670635a1624b077b4e) | 捕球/持替えの元energy・時刻・RNGを保つpiecewise Coreとcheckpoint非依存contact root |
| [280](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/280) | [8db860a5](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/8db860a5efb18214107ee5446aad438f3aa0895e) | 元の10選手/50部位、70必須domain、実所有者のbounded inventoryとpending-only Native scope |
| [281](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/281) | [df5ef199](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/df5ef1996805ce5681be04f0ec2663da3867974c) | 元のlive call時刻・exact availability・証拠identityを保持するpost-play adjudication import Core |

各公開treeはローカルの検証Sourceとfetch/diffで一致を確認した。GitHub上のcommitはmetadataが異なるため、commit IDだけでなく全tree/src treeの同一性を各PRに記録している。いずれもmergeしていない。

## 追加したactual observation

[詳細契約](2026-10-04-actual-field-observation.md)。既存のperception部品を、実際に所有・実行したfield/execution prefixへ接続する。

- Player/pitchごとのimmutable view/attention Sourceとobservation receipt
- 明示的なbody-center相対eye anchorとforward。真のballや速度から視線を決めない
- Exact physical moment、actual actor primitives、adopted ball cursorだけをsampleする。Pending planやincoming velocityを現在の真実にしない
- FOV、実actor sphere、ノイズ、refresh、記憶予測。未知のwall/base opticsは `surface_visibility_unavailable` として記憶を保持する
- Sparse sampleから連続注視時間を捏造せず、瞬間観測と明示calibrationを使う。整数tickのmemoryとexact evidence timeを区別する
- Future payloadを読まない履歴再生、complete metadata/head checks、現在性、WAL rollback、元archiveの保持
- AI-facing perceived stateへCanonical truthを渡さない。Caller結果注入、property-name alias、導出後のnonfinite値を拒否する

このreceiptはautonomous gaze/decision/controllerやcomplete-play registryではない。

## その後の接続

[Scheduled acquisition](2026-10-04-scheduled-field-acquisition.md)は、減衰完了と同tick競合確認を分離して途中保存・再開する。実DBで、確認待ちに誤SAFEを出さず、確認後の元のexact secure時刻からOUTを導出すること、過去の知覚・判定を変えないことを確認した。最終固定Sourceはtypecheckと14 files / 239 testsを通過し、全tracked hashesが一致した。

[Model ownership修正](2026-10-04-player-model-ownership-integrity.md)は、検索列・Source・snapshotにまたがる元Player/Source identityを検査する。Integrated 5 files / 80 testsとtypecheckを通過した。

[Decision calibration owner](2026-10-04-player-decision-model-continuation.md)は、既存ratingsを複製せずに判断・初動の明示parameterを所有する。Integrated 13 files / 258 testsとtypecheckを通過した。実際のdecision receiptやmotor生成とは区別する。


[Atomic同時刻履歴](2026-10-04-atomic-capture-history-continuation.md)は、以前は原始snapshotの保存後に全consumerが拒否した狭いglove拘束/ground境界を、元結果の完全再導出で接続する。新しい支配やOUT/SAFEを作らず、6個の旧snapshot hashを維持した。

[Observation履歴所有](2026-10-04-actual-observation-history-integrity.md)と[モデルmetadata所有](2026-10-04-player-model-metadata-ambiguity.md)は、SQLiteのfirst-keyとJSON.parseのlast-keyの差、重複container、隠れたhistory ownerを検査する。統合固定Sourceはtypecheckと11 files / 241 testsを通過し、全tracked hashesが一致した。これは自DBの改変再現に対する整合性修正であり、外部攻撃や誤った試合結果が観測されたとの主張ではない。

[Actual個人判断](2026-10-04-actual-defensive-decisions.md)は、各Playerの実知覚・明示優先度・独立ratingからpursuit/holdを選び、元のtargetとdeadlineを保つ。実際の後続観測で到達したissuedAtを保存し、早すぎる同tick発行や二重発行を拒否する。[自己kinematics](../implementation/2026-10-04-actual-player-kinematics.md)は、defenderのWorld由来rootとbatterの実swing-grip由来rootを区別し、5部位の非zero relative motionとcanonical残差を保存する。[Locomotion model](2026-10-04-player-locomotion-model-continuation.md)は既存Coreが消費するparameterだけを所有する。

この3段の統合Source local `644476836f0edd82b5d28bde4997e06f9946fc31` / published `afb6ed03e3b53dc4ccc56ef73f66be73fee06724` は、typecheckと14 files / 195 testsを12分46.310秒で通過し、全tracked hashesが一致した。Full treeは `53982941bc2fd43a7409777a8cc353183d58d892`、src treeは `ba87b718631d242154d460858ff1e252837c3e89`。修正前の判断51件、metadata follow-up35件、各独立reviewの証拠とは分けて記録する。各中間commitを個別にwhole実行した意味ではない。

[Decision live work](2026-10-04-actual-defensive-decision-live-work.md)は元の判断/初動deadlineを保持し、issued後もmotor/adoptionをpending successorとして残す。Queue coverageは未知であり、全体watermarkやPlayEndを認定しない。独立Sourceの20 testsとreview後、統合Sourceではtypecheck、Core/WAL12件と実Native read/retry/reopen1件を選択実行し通過した（他Native7件はこの統合focusedでは再実行していない）。統合13件、1分30.529秒、全tracked hashes一致。src treeは `e5ec2a4b12a47aad0535d534b5fa6073ef786852`。

次の実装は、owned判断からboundedな1区間のmotor receipt、10人全5部位の指令合成、既存物理ownerによるatomic adoptionへ進める。通常のmotionが「実行checkpoint」と「指令の有効coverage」を同時に終了する境界は、[versioned checkpoint](2026-10-04-motion-coverage-checkpoints.md)で接続した。独立Sourceの76 testsとreview後、統合Source local `7ea7d5c2bfced9005d29e688582bef818c5bb359` / published `329a03f44fb3dbbc15ae3857d8a41a87da5cbf0d` でtypecheckと4 files / 19 testsが通過し、全tracked hashesが一致した（3分41.374秒）。Full tree `3ef4173caced54189e2c3de6b0208a977cfa614e`、src tree `6960552a83fd5d66b97de529c042670a7fe04b9b`。Actor/selfは元の曲線を保持し、ballは既存real-cursor kernelで進む。これだけで独立motorのdue workやscheduler全体を閉じた意味ではない。未確認の保存期間延長や部位のzero-fillで代用しない。


[Owned初回motor receipt](2026-10-04-owned-locomotion-receipts.md)は、実際のissuedAt、現在の自己位置・速度、明示calibrationと元の知覚targetから、first waypointへの1区間またはholdの制動指令を導出する。未解決contactやpending capture/transferでは受理せず、5部位の元relative指令を保持する。Receiptはadoption_pendingのままで、これ自体で物理が動いたとは記録しない。

元の固定Sourceは6 files / 16 tests、checkpointを加えた最終独立Sourceは4 files / 8 testsを通過した。それぞれ別のSource-bound証拠であり、同じ全件再実行として合算しない。統合固定Source local `6f3947b60a19dca4f25a4199eff267e5ba763dfd` / published `e93bf5dc3cfab034895a5642b8be3d919ef4c17c` はtypecheckと3 files / 7 testsを3分49.202秒で通過し、全tracked hashesが一致した。Full tree `dd9387d5f115bd7cdebd029f4386e43d291663a2`、src tree `1fcc576ca115c7bd514422d2bd5ab0dc2031867d`。通常のcontact-free経路で、元の判断deadlineから発行、motor receiptまで繋がることを確認した。

[Owned physical adoption](../implementation/2026-10-04-owned-motion-adoption.md)を#278で接続した。全10人・全5部位のowned/retained contributionsを既存物理ownerの同一transactionで採用し、実際に実行した区間だけを記録する。短いmotor区間と長く残る元の部位/他Playerの指令を混同せず、実contact、独立した判断deadline、coverage終了時にはpendingを保持する。Motorは一度だけ採用し、ゼロ時間contactでも未来の区間を消費済みにしない。正当な長い観測prefixは検証済みsnapshot manifestで扱い、元のhash規約やinert-data上限を緩めない。

固定src tree `fd9fb503d9bd94f103566cf7b964bccfb8d69cba`はtypecheckと29 files / 158 testsを通過し、全1,807 tracked hashesが一致した。独立reviewで見つかったnested field/predecessorの所有alias、due handoff漏れ、解決済みground contactの誤blockerを再現・修正した。統合local `412c49582b8959049a95431ebfe875c096026e20`は同じsrc treeで、typecheckと別の2 files / 4 testsも通過した。公開 `8c584e5ed53165d3d037b705c3dbbd76ef9f5455`のfull tree `9539420b632402cf4f630b84969890af534112ff`とsrc treeをfetch/diffで確認した。これはfocused gateであり、whole成功ではない。

[Piecewise scheduled-operation Core](../implementation/2026-10-04-piecewise-scheduled-operation-core.md)を#279で追加した。元の捕球energy/secure/fence、transferのreadiness/RNGを保持し、将来のactor区間だけを切り替える。新経路のcontact rootは要求checkpointに依存せず、exact endpoint/tangentと複数collider集合を保存する。旧数値経路・既存tolerance・legacy archiveのbytesは変更しない。

Core単独source `464a76802a5cb29952b420b9941ca9b16d250848`でtypecheckと93 files / 832 tests、独立reviewで17 files / 232 testsが通過した。#278へ統合したlocal `373da7068776f09c3f56f52a7f0a4ebe211178cb`でもtypecheckと同じ93 files / 832 testsが44.49秒で通過し、tracked hashesが一致した。統合src treeは `35a147816742b97d655545aa371b2212022a5578`で、Core単独baseのsrc treeとは区別する。公開 `df558bd4ab2491b386e99e670635a1624b077b4e`をfetch/diffし、full tree `791a224513a828e3dcf4c9787ecbd4461343750c`とsrc treeが一致した。

Pending capture/transferへ実際の独立判断/motorを接続するNative所有・履歴・transaction統合は継続中。Core単独の成功をその完了へ読み替えない。以後のcontroller更新、route進行、全contributors/actor dispositionからの実PlayEnd、official closureとCareer全体も引き続き残る。

## Native scopeとlive-call import

[Original Native scope](2026-10-04-actual-live-play-scope.md)を#280で追加した。Player/Person/fixtureと50部位を元のphysical pitchから導出し、必要な70のproducer-domain instanceを、現在見つかったSQL行の集合とは独立して登録する。元のpre-pitch runnersはIDを残してunsupportedにする。Observation/decision/motorのbounded inventoryと実際のlocal workを集めるが、不在のgeneratorや未確認coverageはpendingのままで、PlayEndは生成しない。

固定した独立実装Sourceでtypecheck、Core6 files / 101 tests、Native8 files / 54 testsが通過し、独立reviewでも43 metadata/Core testsと実Nativeのrollback/adoption/archive probeが通過した。#279へ同じ12ファイルを統合したlocal `8eac874f95fe845bd7694032dd72506b08f701dd`ではtypecheckと5 files / 43 testsが2.73秒で通過し、tracked hashesが一致した。追加のcurrent-tree Native store再検証も同じ固定Sourceで1 file / 3 testsを190.98秒で通過し、exit0と全tracked hashes不変を確認した。Scheduled-motion v2の検証とは区別する。公開full tree `8352554e77d4bd0f1dba6b9bc5e5760c01efa800`、src tree `c24e3096b231cd57230715074173aa9665a6414f`をfetch/diffで確認した。

[Original live-call import](../implementation/2026-10-04-owned-live-call-import.md)を#281で接続した。元のcall tick・exact called/available timeとpost-play import timeを別々に保存する。元の古い規則証拠は現在の証拠へ自動的に付け替えず、staleのまま保持する。過去のcallを後発のappeal-call義務の消費として扱わない。これはCoreの形式/順序/再生契約であり、Nativeが各Sourceの実所有・game/pitch・exact PlayEndを再導出する接続は残る。

固定local `5869ebbf3815fe534f43769eceb85dae922427ca`はtypecheckと17 files / 122 testsを4.75秒で通過し、全1,830 tracked hashesが一致した。独立reviewで16 files / 118 tests、別の33 adversarial tests、旧版との240 trace-prefix比較が通過し、Critical/Important指摘は残っていない。旧call→review→closureの2,278 bytes、SHA256 `d0170ec820ccd8545bc3bfb7716144831c45447f52a805d6bc4368d2f62139e3`も維持した。公開full tree `4fc2e4de2e57159a7014a227956908abf63a2c56`、src tree `bb3903b4a00bdc25e84540a4795c34d9f662fdc6`をfetch/diffで確認した。Native実審判や公式試合ループ全体の検証ではない。

## 未公開Native統合の現在位置

Piecewise capture/transfer中の独立motor採用、owner-qualified archive manifest、observer-only suffixの厳密な元cut照合を統合中。中間Sourceの選択検証では、実物理の静止球接線→energy0確保→遅延0の送球→同exact時刻の新しいground接触、整数clockの保持、observer履歴後の一度限りのmotor採用が通過した。旧版で生成した3種類のDBも新readerで再開/再試行し、保存行と元artifactのbytes/hashが不変だった。これらは同一の最終全件gateとして合算しない。

3人のmixed motorと履歴再導出の試験は1/1、exit0、全体4,489.04秒で通過した。3人の実decision→motor→adoption、残りの指令lineage、50部位、3観測、次の実進行を確認した。ただしこれは性能修正前の作業Sourceの証拠で、強化した最終assertionsの再実行も残る。

別のbounded診断では、1選手・3実行記録の実Native鎖で複製/正規化JSON化がCPU sampleの約65%を占めた。同じsnapshotのJSON比較とhash比較を1回の正規化結果から作る限定修正は、pure/metadata41 testsと独立27 testsでbytes/hash一致を確認した。保存済みlogical-initのcodec比較は43.96ms→16.35msだったが、これはNative全体の速度改善率ではない。Generic serializer・入力上限・DB再導出・transaction後の改変検出を保持し、DB/global cacheは導入していない。

修正後のcandidateはfull1,844filesを固定し、typecheckと8 files / 36 pure/codec/metadata testsを通過、hashes不変。Integration→EndToEnd→LiveWork→WAL→実32段履歴の段階別Native gateを待機/実行する。未実行のconsumer casesと強化したmixed/zero-time assertionsも含め、最終frozen-source受入れは未完了。

次に、確認済み捕球→actual first-base rule consumer→未消費result successorの実Native鎖を接続する。単なるrule読取りだけで消費済みと見なさない。また、数学上の整数Tまで進めただけでは「同じTへ量子化される直後の端数時刻」まで処理した証拠にならない。全actorの連続曲線coverage、実event生成/消費、独立operative call、参加writerのfenceを実際に揃えてからPlayEndへ進む。

## 全体検証の正確な位置

| 固定Source | 結果 | Sourceの範囲 |
|---|---|---|
| #259 `ad296f7e` | `npm run verify` exit0、620 files / 4,157 tests、81分9.642秒 | 元の公開checkpoint。全1,624 tracked hashes一致 |
| #260 local `943d18cb` / published `55cacd18` 同一tree | exit0、623 files / 4,198 tests、85分12.031秒 | Field execution追加時点。tracked hashes一致 |
| #262 local `43dc03df` / published `83838144` 同一tree | exit0、632 files / 4,326 tests、94分12.209秒 | 修正済みwhole-play historyまで。全1,656 tracked hashes一致 |
| #266 local `2045573a` / published `8d752788` 同一tree | exit0、648 files / 4,554 tests、94分39.813秒 | Actual observation・scheduled throw・release互換修正まで。全1,692 tracked hashes一致、checkout clean |
| #269 local `cdd5908e` / published `b2b8ee48` 同一tree | exit0、662 files / 4,807 tests、117分38.678秒 | Scheduled capture・model mirror修正・decision calibrationまで。全1,722 tracked hashes一致、checkout clean |
| #277 local `e8b3aaa2` / published `0484d42e` 同一tree | exit0、697 files / 5,159 tests、165分59秒 | #270–277を含む初回motor receiptまで。全1,784 tracked hashesと以前の部分証拠checksums一致、checkout clean。#278以後を含まない |

いずれもtypecheckを含む。#262のfull treeは `c9c1fd2a91c94b43966a77cb4c8b958d70df86e9`、src treeは `3215fe92c34ae51c5deca1bfcff7bacb59b847a6`。Tracked diffは空で、検証checkoutのuntracked itemはruntime dependency用node_modules symlinkのみだった。

#261旧Sourceのwholeは、continuing-contact不具合発見後に意図的に中止した。成功扱いせず、修正を含む#262を別に全検証した。#255–258の古い各固定Sourceの未完了記録も後続結果で書き換えない。

#266の累積wholeは2026-10-04 01:21:35 UTCに完了した。独立したlocked dependency directoryを使い、実行中はSourceを変更していない。Full treeは `ea050f719a5ad82227ab245d0d95dee106ecc75f`、src treeは `7dd590be2d9f6edf9f03578baddd2e77e896529a`。#263–266を含むこの累積Sourceの検証であり、過去の各中間commitを別々に再実行した意味ではない。

このgateを閉じて確定残計画のscheduled acquisitionへ進んだ。#269の固定Source local `cdd5908ed034af103719d568049a3064932959f2` / published `b2b8ee480b451e187f526b2be7db2d7d31c8c25a` の累積wholeを2026-10-04 02:29:06 UTCから別の不変checkoutで実行し、04:26:46 UTCにexit0で完了した。Full tree `97a38527f0d62a6ebe8d055547b9632ca8184acd`、src tree `5920b491ad4f2f74784fda398a85da14fe643ed0`。Typecheckと662 files / 4,807 testsが通過し、全1,722 tracked hashesは前後で一致、checkoutはcleanだった。この累積Sourceの成功であり、各中間commitを別々にwhole実行した意味ではなく、#270以後も含まない。後続変更へ#266の成功を流用せず、各focused/reviewと次の固定Source gateを区別する。最新terminal resultと公開tree情報は該当PR本文にも記録する。

#277の固定Sourceのwholeは、最初の2回でterminal exit/hash記録が残らず中断した。部分logを成功扱いせず、2026-10-04 08:07:46 UTCに同一Sourceで再実行した。Local `e8b3aaa2117b6fc2a4a62ee3c5f2f61cc37a1a77` / published `0484d42e33b520d105dd20c0415026fa2d29a9ed`、full tree `264fb1ba911e88f39b9d45d7edc54121e4175d7f`、src tree `1fcc576ca115c7bd514422d2bd5ab0dc2031867d`。2026-10-04 10:53:45 UTCにterminal exit0で完了した。Typecheckと697 files / 5,159 testsが通過し、全1,784 tracked hashes不変、以前の中断証拠のchecksums不変、checkout cleanを確認した。全体所要9,959秒、Vitest部分9,929.04秒。これは#277までを含む累積Sourceの成功であり、各中間commitの個別whole成功や#278以後の成功へ読み替えない。後続の全体検証は最新のまとまった統合Sourceで実施する。

## 残る確定非デザイン接続

1. 残るactual ball/contact/ruleの生成・消費source、未解決contact policyの接続（旧atomic同時刻履歴境界は#270で接続済み）
2. 接続済み知覚/個人decision/first-step receiptから、実際の情報・通信sourceと既存motor所有を維持するbounded controller/relative reach/全actor指令合成へ接続。Pending capture/transfer中の独立指令変更は別のpiecewise契約が必要
3. 全contributorsとcausal actor dispositionを集めるNative registry/watermark、実際のPlayEnd
4. Physical endと独立したcall/reviewを既存official closure/scoring/legal Match/actual-role workloadへ接続
5. 版付きvenue/legal/dead/out-of-play/interference policy、bunt依存foul intent、実移動/recoveryによるnext-play
6. Pre-pitch runnersを含む一般participant/body/capability、実際の練習・出場機会、既存Club/competitionを使う自律Career、performanceと実測calibration

既存ownerと既存Coreアルゴリズムを再利用する。Accepted Sourceやsynthetic test motorは、自律本番生成・数値校正・全試合/Career完成の証明ではない。未知の方針・入力は未知のまま保持し、結果・PlayEnd・実測値を捏造しない。

## 正本と変更境界

最新確認した正本はfoundation `44b9f5de7b9d87e649f12f1af78c202f2b5ab44d` とrealism `4f0a60a3818926327b6bf5877ab3dec456a76530`。元の[確定済み残計画・prior PR記録](2026-10-04-nonvisual-implementation-checkpoint.md)を継承する。古いDRAFTファイル名だけでstatusを巻き戻さず、archived Pixel/JSON案や未接続designを再開しない。

自宅/self-hosted CIをdispatchせず、workflow/config/lock/公開範囲を変更しない。実行済みのcloud-local検証と、未実行の現在commit CIを分けて記録する。

## 2026-10-04 12:36 UTC: event consumer and exact-query connection

Draft #282 connects original source-local capture/throw events and first-base rule consumption. Corrected fixed-source Native verification passed 7 files / 10 tests with terminal exit0 and unchanged hashes; independent review also passed 127 Core/API/metadata tests. Main integration passed typecheck and 9 files / 90 focused tests. This keeps unconsumed custody/rule-result successors explicit; it does not prove a complete queue, operative call or PlayEnd. Scheduled-motion v2 compatibility remains in separate fixed-source integration.

The exact free/accelerated retained field query now accepts an exact elapsed endpoint while preserving all real collider sets and continuous actor coverage. Review exposed two floating-point interval failures: retimed outside-horizon base roots and clipped local-duration add/subtract round trips. Both were reproduced and corrected without changing legacy exports or tolerance. The final worker source passed 54 Core files / 827 tests; independent review passed 58 files / 853 tests and all three original-source archive hashes. This is a Core query/actual-retained-checkpoint seam only. Native scheduling, foot/base generation, complete producer/consumer proof and the durable end fence remain to be connected.
