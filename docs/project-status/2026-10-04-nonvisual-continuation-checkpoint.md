# 非デザイン継続実装: 現在の接続と検証

更新: 2026-10-04 17:32 JST（2026-10-04 08:32 UTC）

ユーザーの継続指示に従い、最新の確定済み残計画を進めている。**計画全体・自律試合/Career全体の完了ではない**。デザイン/UI/art/Presentationは未接続のまま。

## 公開済みの積み上げ

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

次は独立指令をpending capture/transferへ途中採用するpiecewise拡張。以後のcontroller更新、route進行、全contributors/actor dispositionからの実PlayEnd、official closureとCareer全体は引き続き残る。

## 全体検証の正確な位置

| 固定Source | 結果 | Sourceの範囲 |
|---|---|---|
| #259 `ad296f7e` | `npm run verify` exit0、620 files / 4,157 tests、81分9.642秒 | 元の公開checkpoint。全1,624 tracked hashes一致 |
| #260 local `943d18cb` / published `55cacd18` 同一tree | exit0、623 files / 4,198 tests、85分12.031秒 | Field execution追加時点。tracked hashes一致 |
| #262 local `43dc03df` / published `83838144` 同一tree | exit0、632 files / 4,326 tests、94分12.209秒 | 修正済みwhole-play historyまで。全1,656 tracked hashes一致 |
| #266 local `2045573a` / published `8d752788` 同一tree | exit0、648 files / 4,554 tests、94分39.813秒 | Actual observation・scheduled throw・release互換修正まで。全1,692 tracked hashes一致、checkout clean |
| #269 local `cdd5908e` / published `b2b8ee48` 同一tree | exit0、662 files / 4,807 tests、117分38.678秒 | Scheduled capture・model mirror修正・decision calibrationまで。全1,722 tracked hashes一致、checkout clean |

いずれもtypecheckを含む。#262のfull treeは `c9c1fd2a91c94b43966a77cb4c8b958d70df86e9`、src treeは `3215fe92c34ae51c5deca1bfcff7bacb59b847a6`。Tracked diffは空で、検証checkoutのuntracked itemはruntime dependency用node_modules symlinkのみだった。

#261旧Sourceのwholeは、continuing-contact不具合発見後に意図的に中止した。成功扱いせず、修正を含む#262を別に全検証した。#255–258の古い各固定Sourceの未完了記録も後続結果で書き換えない。

#266の累積wholeは2026-10-04 01:21:35 UTCに完了した。独立したlocked dependency directoryを使い、実行中はSourceを変更していない。Full treeは `ea050f719a5ad82227ab245d0d95dee106ecc75f`、src treeは `7dd590be2d9f6edf9f03578baddd2e77e896529a`。#263–266を含むこの累積Sourceの検証であり、過去の各中間commitを別々に再実行した意味ではない。

このgateを閉じて確定残計画のscheduled acquisitionへ進んだ。#269の固定Source local `cdd5908ed034af103719d568049a3064932959f2` / published `b2b8ee480b451e187f526b2be7db2d7d31c8c25a` の累積wholeを2026-10-04 02:29:06 UTCから別の不変checkoutで実行し、04:26:46 UTCにexit0で完了した。Full tree `97a38527f0d62a6ebe8d055547b9632ca8184acd`、src tree `5920b491ad4f2f74784fda398a85da14fe643ed0`。Typecheckと662 files / 4,807 testsが通過し、全1,722 tracked hashesは前後で一致、checkoutはcleanだった。この累積Sourceの成功であり、各中間commitを別々にwhole実行した意味ではなく、#270以後も含まない。後続変更へ#266の成功を流用せず、各focused/reviewと次の固定Source gateを区別する。最新terminal resultと公開tree情報は該当PR本文にも記録する。

#277の固定Sourceのwholeは、最初の2回でterminal exit/hash記録が残らず中断した。部分logを成功扱いせず、2026-10-04 08:07:46 UTCに同一Sourceで再実行した。Local `e8b3aaa2117b6fc2a4a62ee3c5f2f61cc37a1a77` / published `0484d42e33b520d105dd20c0415026fa2d29a9ed`、full tree `264fb1ba911e88f39b9d45d7edc54121e4175d7f`、src tree `1fcc576ca115c7bd514422d2bd5ab0dc2031867d`。現在は実行中であり、#278を含まない。後続の全体検証は最新のまとまった統合Sourceで実施する。

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
