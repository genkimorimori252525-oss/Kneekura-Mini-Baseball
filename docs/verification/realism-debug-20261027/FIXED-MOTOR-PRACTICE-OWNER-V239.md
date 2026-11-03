# 固定スイングの選択・記録・保存再開

2026-10-30 JST。技術名から本人／保存clipに結び付く固定XY設定を選び、既存の通常Coreと練習セッションで対照／試行を計算し、全結果を保存・再開する経路を実装した。**4技術の成立・通常獲得・希少Gold・完成版配送は未完成。**

## 実装

XY専用motorは本人・技術・clip id／SHA／左右・domain・版・由来・学習に用いた機会を固定する。旧V123の自己申告CONSOLIDATED／MODEL_VERIFIEDを資格へ転用しない。未資格motorは明示practiceだけで使い、通常earned選択はNO_TARGET。旧複合attack／pull／depthをXYへ黙って変換しない。

新しい明示practice policyは、旧spinMotionのV153方向登録停止とattack／pull／offset経路を通さない。元roster／設定は削除せず、policyなしの挙動を保持する。通常方向・心理・誤差・clock・late correction・速度制約へXYを一度だけ合成する。

既存`LiveBattingPracticeV150`のsessionとWeakMapを拡張した。別のstate Ownerは作っていない。

- 開始前にmotor・domain・criterion・予定ordinalを固定。未来のbefore hashはPENDINGとし、到達時だけOwnerが束縛する。未実施slotを分母から除外しない。
- 同じbeforeから正常対照と試行を作り、trialだけacceptする。previewはsidecarも非消費。hash計算後にphysics／sidecar両revisionを再確認し、awaitのない区間で同時公開する。
- hashは版付きの型タグ・全IEEE数値bit・配列順・キー順を固定したWebCrypto SHA-256。full inputs／recordsも保持し、hashだけをauthorityにしない。
- Host内部発行のprivate WeakSetでPITCH_NO_CALL／FIELD_INCOMPLETE／RULE_UNRESOLVEDを識別する。既存message／causeを保持し、未知の例外や同文ErrorをHOLDへ変換しない。
- 既知未解決をacceptするとphysicsは進めず、sidecarだけ更新。同じ機会の再試行を別独立試行へ数えない。
- closeは完了CLOSED／未完INTERRUPTEDとし、未到達・失敗を残す。通常練習へ戻った後も全normal tailを保持する。tailは明示NOT_HASHED。
- 非同期resumeはanchor以後の全pair、close境界、normal tail、最終continuationを正常Hostで再計算・比較してから公開する。自己完結captureの再現一致は作成履歴の実在やNative資格を証明しない。

## 限定したソース検証

担当の初期32 tests `db138a8733044b85a316b5db218548a7`、close追加3 cases `a9783f6a4f4446cea1365615213e1096`、strict `bb411b76b8164dc088a2429683af0965`、非opt-in旧経路 `59303da496a9419e9dd0167659da2582`を保持した。

closeは共通preview／accept／resumeにも触れるため、Rootが最終Owner fileだけを再検証した。`8420dfe3f3de427daca57a4c269a11f9` PASS30,500ms。純計算とhashの未変更テストを再演するための実行ではない。Rootはtask／PASS／exit／log SHAを照合した。

Astraは非同期競合、atomic publish、PENDING／HOLD、close／tail／resumeの局所整合性をSourceで独立レビューしReady。Rootは開始worktreeとGit親を別保存し、既存5Sourceへの実scratch逆patchで全bytes復元を確認した。純motorの開始版はGit親に未存在で、他者／前工程の内容を消していない。

途中のhash失敗 `07619da2` はtrial field telemetryの`receivingSeconds:Infinity`だった。hash encodingだけをIEEE±Infinity／NaNへ対応し、physics finite validatorは緩めていない。FIELD／RULEの型配線はstub、PITCHは実Hostケースで区別して記録した。全元FAILを保持する。

## 本人・実browser Worker

原JSON59,857B／e012…を正常importし、本人`1-b0 / L / obp-23_5`、全673clips／92,201frames、Chrome156.0.8078.49、同Native／Workbench／時間刻みで実行した。数値を入力せず技術select→開始buttonから固定設定と二球診断基準を確定する。

| 技術・事前固定seed | receipt | 実際の結果 | 診断 |
| --- | --- | --- | --- |
| BACKSPIN / 20261030 | a7301541c8bb42bc8bc601b49397547a | 二球ともNO_SWING、固定運動未実行 | UNAVAILABLE / CLOSED |
| TOPSPIN / 20261031 | 49386100b5924215b3ceb5ea12b19549 | 見送り1、実接触1。要求成分67.3883→451.4521 rad/s | UNAVAILABLE。見送りを除外しない |
| SLICE / 20261101 | 64c3f312428f4e949d32d856e6ef2c4c | 二球ともNO_SWING、固定運動未実行 | UNAVAILABLE / CLOSED |
| HOOK / 20261102 | 904092ccb40644edaa16d29b7fee7479 | 初球で実接触、打席終了で別打者へ移り二球目未実施 | INTERRUPTED / HOLD |

seed・motor・criterionを結果で変更していない。各ケースでMain正常Ownerのpreview反復非消費、実Workerのentry／record／capture全値一致、保存再開を確認。BACKではclose→通常tail1球→再開も確認した。元の正常対照やpreviewを受理打球・独立試行として計上しない。

最初のrun `2dd1d6f1f564497cb1fe3eab37e1bfcc` は旧診断のhidden selectを新checkerが操作し、投球前にFAIL。元Sourceを旧SHAに逆復元保存した。新checkerは無関係な欄を操作せず既定値を読み取り、出力先を分けて再実行した。元FAILをPASSへ書き換えていない。

Nodeの実PITCH_NO_CALL固定fixtureは、本人と別の`AUTHORED_TEST_FIXTURE_NOT_USER`としてChrome Main＋実Blob Workerでも実行した。`f15d6241d43d400ba4b23f453676e1a3` PASS8,297ms。HOLDでphysics不進行、二重preview、replay、同機会retry、未到達slot付き中断closeを全値比較。FIELD／RULEの真正未解決・本人・Native／Gold・capture作成履歴の認証へは拡大しない。

Rootは全receiptのtask／exit／log、ケースartifact全hash、原JSON／roster／Source／bundle／HTML終了pinsを照合した。1200／390px実画像を確認し、新二panelは390pxで340px。elapsedは検証全体であり試合性能ではない。SLICE／HOOKは別Chrome context・出力先で並行実行し、資源条件の違いを性能改善と呼ばない。

## まだ閉じていない機能

通常Hostの打順を使う二球固定診断では、fair contactで本人のPAが終わると次の本人機会を完了できない。また原本人のAUTOを保つと見送りがあり、現V121指示はeffort／compactnessだけで振る意思を指定できない。

次は明示practiceだけの意思入力と、本人の複数独立episodeを正規Hostで実行する版付き反復モードを整備する。元のNO_SWING／UNAVAILABLE／INTERRUPTEDを消さず、基準や必要数を下げて成立させない。実際のmotorモデル改善、独立獲得、希少Gold、全弾道／裁定・キレ物理3段階・完成3HTML／9回／性能／配送までGoalを続ける。
