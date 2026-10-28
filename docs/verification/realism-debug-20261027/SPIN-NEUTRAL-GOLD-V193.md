# SPIN-04: Gold保有とNO_SPIN_TARGET V193

2026-10-29 JST / `MB-20261027-REALISM-DEBUG-PLAN`。全goalは進行中。

同一の球・フォーム・seedで意図的回転目標がない場合の通常/Gold対照を追加した。Liveの作者設定と、Nativeの正規資格は分けて検証する。得能名による結果補正、物理定数・運動・学習閾値の変更は行っていない。

## Live: 実接触と公式打席終了を確認

- 新しい専用fixtureは、同じ右打者・原clip・物理SI・投球commandを使う。対照との差は、4技術の作者設定profileと`NO_SPIN_TARGET`だけ。
- Gold側の境界は`LOCAL_AUTHORING_ONLY`、`nativeAdmission:false`。Nativeの習得資格を証明する入力ではない。
- 通常/Gold間で実接触・原exitVelocity/exitSpin・打球の全physical record・公式判定・continuationが厳密一致する。比較外の2診断は、`spinIntentV123`をGOLD/4技術/NONE_REQUESTEDへ、冗長な`battedSpinV123`を実接触からの観測へ個別照合する。
- 同一の現版browser CoreをChrome Mainと実Workerで動かす。通常乱数と独立乱数の各2経路、計4caseで全record/continuationが一致。全件actual contact、`rules.kind=applied`、`batterAdvanced=true`、最終eventは`pitch_adjudicated`。
- 独立13streamの診断traceは一致。Legacy乱数の内部状態・消費回数は公開されておらず未観測であり、同じ物理結果とcontinuationの証拠に限定する。

最終Chromeは`156.0.8078.49`、Native browser Core216 Source、bundle SHA-256 `9904009b29a0828defcceef3c320ff65f3440dd7774c06abe6cbf7dc15575c57`。通常乱数179frames/公式tick8704527、独立乱数241frames/tick12382521。各caseは打席終了までで、9回試合全体の完了ではない。

Sourceをload時/終了時にpinし、fixture bundleとharness自身も終了照合した。private出力`spin-neutral-live-v193-02`は外部公開しない。

| 検証 | receipt | 結果 |
| --- | --- | --- |
| 新Live unit 2件 | `1c7d4c41b1a74b11850dd9bf165eec8e` | PASS 6875ms |
| 新Live2fileと依存のstrict型 | `82ccf80490d44b92948c7ea23baaf019` | PASS 3015ms |
| 最終Chrome Main/Worker対照 | `66afbdafe67d4597b8c212526d6d5fa4` | PASS 10281ms |

旧Chrome out01 `db1fb92fff4240ef9304a59ae09048f5`はPASS10891msだが、最終版はLegacy未観測を明記し公式打席終了gateを追加したout02。初期unit missing-module `ff3bf68b2e4944b8ae220a1fbd92a886`とunknown event型`ae02118016dd4e25aaa9e1e41cd6b225`のFAILを保持する。最後のtest名のみrandom stateからcontinuationへ正確化し、実行処理・assertionは変えていない。独立の静的レビューで具体的な欠陥は見つからなかった。

## Native: 正規Gold2資格成立、consumerは未証明

既存の同Actor/repertoireを用い、BACKSPINとTOPSPINを別episodeで各3actual contactから習得する。cooldown/minElapsedを変更せず、事前宣言したgameDay40で正常Mastery Ownerの2資格/GOLD/rejected0まで成立した。Goldは2技術以上の投影であり、4技術を必須にしていない。

既存の資格なしNative NO_SPIN_TARGET例を、Gold対照の証拠には流用しない。Native consumerは資格の正規Source/snapshot/Actor/Person/day/repertoireを読取時に認証するため、この経路まで実行して確認する必要がある。

| 新実行 | receipt | 結果と最終stage |
| --- | --- | --- |
| out01 | `d99f10b03fac48329faf5cc12a77d34c` | FAIL 180031ms / CCG TIMEOUT / launch-right-ready |
| out02、機能枠600秒 | `5b2df41eabe446e48f26c6715acb8d8b` | FAIL 283688ms / tinypool Worker exited unexpectedly / observation-ready |

`observation-ready`はcapture受理直後であり、その次のlifecycle advance完了を保証しない。consumerへの2資格の実採用・実接触は未証明、`performancePass=false`。OSの診断に当該crash/OOMの確証はなく、原因はUNKNOWN。旧DB/WAL/SHM/stage/全FAILを保持する。Gold locatorの早期checkpoint、stageメモリ計測、環境変数を除外したfatal reportは診断用に追加したが、これだけで成功とはしない。

次は、保存out02をSQLiteの正規backupで新しいprivate DBへ整合コピーする。原main/WAL/journalのpin、catalog/全rowのlossless digestを照合し、SHMの観測は別記する。新copy上で正常OwnerからActor/model・資格2件・実lifecycle prefix・physical/World headを再認証し、限定したpost-observation seamから継続する。原6接触を作り直す全面再実行、heap増加、物理/学習閾値の変更は行わない。

### 保存DBの再認証結果

専用backup/authの`21cb9bf8485c41ad8b58d4f6f5be2338`はFAIL4218ms。SQLite backup・原main/WAL/journalのbytes/SHA不変・全catalog/全rawtableの列値のlossless scalar digest一致は成立した（rowid値自体は未比較）。正常OwnerのActor、独立2資格、model/repertoire、World head、physical head、observation、historical lifecycleの個別読取も成立した。最後のcurrent lifecycleだけ、`same-PA lifecycle original ownership or complete coverage differs`で拒否された。全体FAILのまま保持し、historicalをcurrentの代用にしない。

保存状態は第3球の`capture-cut`、operationOrdinal1、evaluationTick33525140。historical cut3のcutと一致し、正規captureのobservedTickも33525140である。captureは受理済みだが、そのcaptureを含めるlifecycle advanceは未完であると確認できた。delivery完了やconsumer採用を推定しない。次はcopyのみに対し、正規Ownerで欠けたprefix更新を受理し、新currentのcoverage認証を通してから、delivery/commitment/actual contactを継続する。再開前の練習接触再生成は0。

独立の静的reviewで、physical/Actor/captureの因果joinの明示照合不足と、rowid値のdigest不足が指摘された。破損を観測したという意味ではないが、個別Owner読取を完全なfrontier認証へ昇格しない。再開前に同Actor/lineage/physicalPitch refを照合し、rowid付きの元DB/copy比較を追加する。旧FAILを残し、追加検証にも保存copyを利用する。

### 単独advance gate: 保存状態からの復帰を確認

`35ffeb620c834e978aff9830c44d2aec`はPASS43828ms。保存copyから新しいowned DBを作り、正規readerでprefix/TOTAL/dispatch32校正を再認証して、既存の履歴Ownerで未完の更新だけを受理した。cut4 prefix自体は旧DBに保存済みだったため、同Ownerのreplayで追記0。未完TOTAL10件・view1件・calibration32件を受理し、**新cut4のcurrent coverage認証が成立**した。練習6接触と前2TAKEの再生成は0、delivery/commitment/contactの新実行もまだ0。

原TOTALのeffortと保存済みの校正値を保持した。既存helperへの変更は末尾optional `onStage`だけで、defaultはnoop、処理内容・順序・正常Ownerは同じ。prefix/TOTAL/view/current coverage/calibrationの各成功時にprivate stageを保存する。Owner接続はfinallyで閉じる。

元02と保存copyについて、catalog・rowid・格納列の型付きlossless比較、main/WAL/journalのbytes/SHA不変を確認した。SHMは別観測。新owned DBは許可した4追記table以外の全値・全旧row/head/catalog不変を照合した。796 Sourceのload/end、bundle/harnessのpinが一致。private fullrefs/recordsは公開しない。

再開用gateの新3case（因果join・rowid-only差・WITHOUT ROWID型付き順序）は`0577ef560f3a4dca80fa9716cde607b4` PASS6781ms。後続reviewのSQL文字列によるWITHOUT ROWID誤判定と`__proto__` table脱落は、実schema属性`table_list.wr`とnull-prototypeで修正し、新2caseだけ`f4866294e03149f0a307b4ac44dd8566` PASS6671ms（旧3caseはskip）。各receiptを当時のSourceに限定し、5case全件の同時再実行とはしない。初期RED29de18d7/追加REDae0a776bを保持。新toolsと依存の明示strict型`ebc9d73558254e7782e5584da8c74f00` PASS8125ms。独立の静的reviewで単独advanceの重大な欠陥は見つからなかった。

このPASSは保存状態から正規履歴更新へ復帰できる証拠で、`consumerAdoptionProven=false`、`physicalOperationCreated=false`、`performancePass=false`のまま。次はこの新DBを不変baselineとして、別owned copyのcut4からdelivery/commitment/actual contactだけを継続する。元のTIMEOUT/異常終了を成功へ変更しない。

## 残る範囲

SPIN-04のLive作者設定に関する現版証拠を得た。Native正規Goldと公式終端までの対照、他4技術の実採用、自然rare校正、通常UIと3HTMLの同版配送、全goalの残件は継続する。
