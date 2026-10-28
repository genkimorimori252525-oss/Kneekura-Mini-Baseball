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

## 残る範囲

SPIN-04のLive作者設定に関する現版証拠を得た。Native正規Goldと公式終端までの対照、他4技術の実採用、自然rare校正、通常UIと3HTMLの同版配送、全goalの残件は継続する。
