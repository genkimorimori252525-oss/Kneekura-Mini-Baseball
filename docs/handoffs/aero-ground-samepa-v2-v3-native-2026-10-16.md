# SamePA Aero/ground — genuine Native free root/step evidence

限定された stationary body・action なしの実 Source 接続を確認した。full Core/Host/render、守備9人の実駆動、裁定、得点、9回の受入完了を意味しない。

## 実行結果

| 実検証 | 結果 | 所要時間 | machine receipt |
| --- | --- | --- | --- |
| commit 済み cut10 calibration32 の元 owner cold read/reopen | PASS | 54.281s | `MB-20261016-AERO-CAL10-COMMITTED-OWNER-READ_36a0e4f9775d47db8cda08c5c9e3b25b.json` |
| commit 済み cut11 prefix/TOTAL/view の元 owner cold read/reopen | PASS | 107.905s | `MB-20261016-AERO-CUT11-COMMITTED-OWNER-READ_c57db23a0c194444b530f97904fce984.json` |
| V2 closed root/step 原 owner＋same-kernel 検証 | PASS | 25.280s | `MB-20261016-AERO-SAMEPA-V2-CLOSED-PROOF_f2083540809a492b85736f66e7139ba6.json` |
| V3 新 root→lifecycle→calibration32→実 ground step→元 owner reopen | PASS | 598.358s | `MB-20261016-AERO-SAMEPA-V3-ROOT-STEP_d13d58cb9f71454fbe9b955dbdf1d7f3.json` |
| V3 closed root/step 原 owner＋same-kernel 検証 | PASS | 25.483s | `MB-20261016-AERO-SAMEPA-V3-CLOSED-PROOF_c6d694c79ecd46228060c7dae7e72aca.json` |

receipt は `docs/ai-continuity/verification-receipts/`。V2 の admission child logs は repository の親にある `aero-ground-samepa-recovery-20261016/retained-resume/stage-child-logs-v5/`、V3 は同 `v3-branch/retained-resume/stage-child-logs-v6/` に保存した。V3 は各 stage 600s bounded、全4stage が成功した。Node は `v26.1.0`、SQLite は `3.53.0`。runtime/settings/dependency の切替は行っていない。

## 確定した物理接続

元 pitch/delivery/forecast/emotion/input/commitment/resolution の因果系列を再利用し、実 rigid contact の結果を Source kernel の初期状態にした。

- 実 contact tick: `34054636`
- exit velocity m/s: `(-5.212556003717928, -2.7178715754576643, 43.80918113870227)`
- exit spin rad/s: `(354.60438664392655, -194.4297506155825, 25.932920121140995)`
- stationary actor primitive: `50`（10身体×5形状）。movement admission、守備9人駆動の credit は `0`。

V2/V3 の最初の ground は完全に同じ時刻・状態だった。

| 値 | incoming | outgoing |
| --- | --- | --- |
| originTick | `34054636` | 同一 |
| elapsedSeconds | `0.2793662989158183` | 同一 |
| ball.tick | `34334003` | 同一 |
| y m | `0.0366` | 同一 |
| velocity m/s | `(-6.025618662953829, -7.41649887137618, 39.99831892276954)` | `(-5.548096126611245, 2.966599548550472, 37.446845225638285)` |
| spin rad/s | `(349.91554196555677, -191.8588548911423, 25.590015636356103)` | `(534.3398702631295, -191.8588548911423, 60.10605752655938)` |

元 owner の独立再導出後、同じ Source descriptor/kernel の incoming を field world、outgoing を cursor と照合した。origin/elapsed/tick と Source basis を保持し、新 ground material の `restitution=0.4` による `vyout=-vyin*0.4` も一致した。旧 header と新 profile の反発・摩擦が異なることを確認した上での結果で、旧 ground response の二重適用をしていない。

整数 tick までの残差は `7.010841816534885e-7` 秒。metadata の同 tick 処理がこの差を勝手に進めてはならない。Source material orientation は basis に対する相対量で、絶対的な縫い目位相の Native 認証を付与していない。

## 保全した閉境界

以下のパスは repository の親 `work/` 内。すべて新規生成 fixture の保全で、ユーザーの外部 DB ではない。

| 境界 | 閉 SQLite | SHA256 |
| --- | --- | --- |
| root 直前、cut11/calibration32 | `aero-ground-samepa-recovery-20261016/cut11-before-v2-root/original-cut11.sqlite` | `19e9dfc1e280db46fdc7e48b08aaf25fcafb8f8dac88e244cf3a671c2646b114` |
| V2 root | `aero-ground-samepa-recovery-20261016/v2-field-root/original-field.sqlite` | `ba51461a43f6ecf23a7e81bfbade86e92bd43b4cf358b4c5cf0bbb2250b6f065` |
| V2 step | `aero-ground-samepa-recovery-20261016/v2-field-step/original-field.sqlite` | `affefc506893efb7bb23abf1a9732e9022fceada2664b2e0e53ab62dab001677` |
| V3 root/step prefix | `aero-ground-samepa-recovery-20261016/v3-field-step/original-field.sqlite` | `057e63e14d4a51662f27e926037aa4088bef1e8a477c39977a5b2551c1da09a9` |

V2/V3 は閉 cut11 から別 DB に分岐した。V3 の新 Source namespace は `aero-retained-v3:field:*` と cut12 以降の `aero-retained-v3:cut*`。旧 V2 行を再保存・改名・再 hash していない。

V3 `receipt.json` に root/latest step/current lifecycle view/exact moment/cursor side/solver evidence/Source Map SHA を保存した。Source Map は `e6c36870dfa876102a0b3e9a302e3e07278542d496e14d955281f8d42fab8db3`、371 entries。閉 proof 前後の DB と Source Map bytes は同一。SQLite read-only backup が SHM readmark を変えた場合は manifest の `shmBytesUnchanged:false` に明記し、main/WAL/Source の不変と区別した。

## 既存失敗の保持

- 元600s fixture の最終 worker exit は `UNKNOWN_FINAL_WORKER_EXIT`。494.272s の delivery-cut 公開後までの証拠を保持した。
- cut9 の `0xC0000374` heap fault は `native-heap-fault-cut9/` に保存。根因 UNKNOWN。
- cut10 の `malformed JSON` は元 transaction が32件 commit 後に失敗。`malformed-json-cut10/` に保存し、元 owner の cold read/reopen で commit を確定した。再 admission はしていない。
- `advance-resolution` は240.029sで `ETIMEDOUT/SIGTERM`。`advance-resolution-timeout-cut11/` に保存。prefix1/TOTAL10/view1 が commit 済みであることを元 owner が再導出したため、同 stage の再 admission はしていない。
- Root が compiled-statement 再利用を撤去した後の固定 bundle で unique cut11 から続行した。元 SQL/binding/Source/fence は保持。上記 fault の根因を確定したという主張はしない。

## 次工程と制限

V3 metadata 1件の Native 実証は別担当。渡した閉 step prefix の current lifecycle view は cut12/root、physical head は実 step。そのため次には独立コピーで genuine cut13 lifecycle＋calibration が必要になる。helper `tools/verification/aero-ground-samepa/retained-entry.ts` の第4引数 `v3` は、root/advance-root/cal12/step/advance-step/cal13 の6 mode だけを許可する。

この証拠は `rulesUnsupported:true`、`custodyConnected:false`、`motorConnected:false`、`officialResult:null`、`scoringResult:null`。carrier/acquisition/release/throw/owned motor/rules の未接続 guard を維持する。実測による個人能力・身体トルク・absolute bat motion の校正、OpenBiomechanics の採用もこの証拠の対象外。
