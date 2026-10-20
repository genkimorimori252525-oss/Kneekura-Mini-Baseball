# v59 現在の球の高さで止めず、予測打点へ狙いを定める

人間の追加指示でv57の早い頭固定を置換する。振り始めた瞬間の向きを固定すると、カーブがまだ高い位置にある段階で視線が残り、狙う打点へ向かない。今回必要なのは、打者が振ると決めた後に将来の打点へ視線を寄せ、インパクト付近で落ち着かせながら小さな動きを許すこと。

## 実装

意思決定時刻から登録済みmotor intentionの `observedForecastPosition + aimErrorMeters` へ視線を向ける。実際の現在球の高さと区別する。取得時間は最長85msとし、予定インパクト40ms前までに取得できる範囲で短縮する。打者自身の動作意図には外球の感覚遅延を追加しない。角速度/角加速度の制約は保ち、カメラの現在姿勢を瞬間移動させない。

予定インパクト `referenceContactTick` の時点で基準yaw/pitchを取り、その後の目標と姿勢を角度ベクトル長0.025rad（約1.4°）、角速度0.18rad/s（約10°/秒）へ制限する。身体に付いたeye位置と注視点に沿う小さな補正を許し、ランダムな揺れは加えない。静止条件では収束する。基準は登録済みの予定インパクトで、将来の実衝突時刻や結果を先読みしていない。実接触と予定時刻が異なる可能性は診断 `REGISTERED_EXPECTED_IMPACT` として明示する。

スイング終端と認識済み打球から300msを満たしてから、70msの注視目標移行で既存の打球追尾へ戻す。解除後の遅い観測で再固定しない。見逃し/バント/fieldおよび従来Aは維持。投球追従率.26・許容範囲.02rad、既存のミート/選球眼も継承する。

高さ.30mと俯角上限.20radを予測打点注視に再適用し、Bの最初の2欄を再び編集可能にする。v57の非適用表示を取り除き、注視・安定の表示と予定インパクトmarkerを更新する。旧JSONを保ち、v59保存領域を使う。通常HTMLと調整室の1つの同一試合に反映する。

投手の0.1〜0.25秒短縮（v58、local commit4fa32b2）も含む。球物理、スピン、実測バット、能力、AI、裁定、投球22/他55ms、4px格子、表示倍率1は変更しない。

## 検証

- IMPACT-GAZE-UNIT5545522b PASS5.282秒。R/L、上昇中のcurveと未来打点の区別、意思決定からの取得、早期固定なし、予定impact境界、1ms刻みの実cone/速度、身体移動時の非ゼロ微動、静止時収束/no周期jitter、70ms解除、prefix/result poison、seek/設定、不変なtake/bunt/field/legacy、実12球8hit8swingのSource/バット不変。
- BUILD360c53d2 PASS0.141秒。frozen v58/Core113入力を固定して通常と調整室を生成。
- CADENCE2819e181 PASS7.343秒。60Hz手動時計で両HTML scene18/sample45、非投球の高速更新0、loopのA/B始点pixel一致。

- BROWSER67f83a0d PASS48.281秒。実Rスライダー・Lチェンジアップ・Lカーブで、現在球と予測打点の区別、85ms取得、予定impactの安定開始、非ゼロの微動を確認。6実球のSource/バットはv58と同一。1200/390px、5カメラ、7設定、保存、12枚の合成pixel、投手151.54ms待機を確認。例外/外部通信0。
- PACKAGEeee54863 PASS1.343秒。Core113入力、4helper、builder/driver/template、内包した通常HTML、旧配布の原byteを照合。

通常HTML SHA256: `41d7f56a4e30b4a0f41706e67512f8745d6bace5244fe4e7f4eb032132134d9e`。調整室: `67160af7cb25d435893b299430849dc26cacfe2cb3b7e119278a79de77fd6ae0`。

ブラウザ原FAIL890e537bは、登録済み予定impactをscene時刻へ往復変換すると1ULP手前へ丸められる境界を検出した。完全一致する登録markerだけ元の秒へ戻し、許容誤差で検査を緩めていない。途中FAIL1d93ed88はchecker修正中と再生成の混在で、最終では同一成果物と厳密assertで再確認した。原ログを保持する。

機械receiptは `docs/ai-continuity/verification-receipts/MB-20261019-V59-*`、配布照合は [release-check](../verification/releases/v59/release-check.json)、実ブラウザは [impact-check](../verification/releases/v59/impact/impact-check.json)。コマンドは各receiptに保存する。

姿勢係数は人間の要望に合わせた表現であり、生体力学の実測校正ではない。元全計画、未達・FAIL/UNKNOWN/Charter HOLDを保持する。新9回や100試合の実施を主張しない。

## 保存先

製品コミット `23455422bfe72e722b2928223a41bb0f45fa8a57` を既存ブランチとDraft PR380へ保存。v58の投手短縮commit4fa32b2も含む。STAGING6bceeda3 PASS0.890秒、PUBLICATION7e3d7f6b PASS3.250秒でremote/PR head・Draft OPEN・10件の公開raw byte一致を確認した。[公開検証](../verification/releases/v59/publication.json)。main未マージ。後続の記録のみのコミットは製品byteを変更しない。
