# Atomic acquisition same-time history continuation

更新: 2026-10-04 JST

既存のatomic acquisitionが保持していた、同時刻のconstraint適用直後に別colliderへ接触するケースをNative historyへ接続する。物理結果、Source/result schema、geometry、kernel、toleranceは変更しない。

## 実Nativeで確認した旧境界

Base: `d5b7d2c4cb00f92ec8d1887cb853d278d519881f`（PR #267と同じtree）。`ScheduledFieldAcquisitionConstraint.test-support.ts`の実rolling ball / descending glove fixtureをatomic actionで実行した。

- 先行ground接触後、ballのincoming y速度は0。glove接触からconstraintへ移ると、同じelapsed time / positionのままy速度が-1になる
- Atomic ownerはcontinuing gloveと新しいground接触を含むinterrupted resultを正常保存する。保存済みsnapshotのSHA-256は`a1303781f863f60a6d428eeafe5381e7ebe95fd5f164da7b915a279bba5704ef`
- その直後の`whole_play_history`、`first_base_race`、`base_touch_history`、actual observerを個別にadmitすると、全て`coincident actual field contact states differ`で失敗し、各ownerのreadはnullのまま。修正前の実Native probeで4経路を確認した
- 同じfixtureの修正後期待testも、この例外でREDになった。以前から成功していたsnapshotを異なる意味に置き換えるケースではない

## 修正の限定範囲と互換性

`BattedWorldFieldPhysicalPrefix.appendContacts`の「同時刻・新しいcollider・異なるmoment」の旧拒否分岐だけが追加の検証を行う。Atomicの場合は、元のresponse / geometry / candidateから`deriveBattedWorldFieldAcquisition`を再実行し、保存済みresult全体との完全一致を要求する。その上で元glove速度とzero spinによるinitial constraint momentへの完全一致を確認する。

- Rule contact集合には元incoming momentを残す。Raw candidateと異なるconstraint stateはatomic result / whole-play physical stepsに両方残る
- 既に受理されていたatomicの分岐は追加の検証callbackを呼ばず、出力も変更しない。Scheduledの既存projectionは同じ条件とplan validationを保つ
- 任意の速度、reason、energy、contact継続性、孤立base companion、raw surfaceまで対にした偽companionは拒否する
- 新しいcontrol window、sampleable post-contact ball、SAFE/OUT、PlayEndを作らない。Observerは`physical_state_unavailable`、rule consumerは同時接触のpending evidenceを保持する
- 修正前に実Nativeで受理された通常のsecured atomic、whole history、race、base history、observerの5 snapshot hashを`AtomicFieldAcquisitionArchive.test.ts`へ固定した。Reopen / immutable retryでJSONとhash列が変わらないことも検証する

## 検証境界

- 実atomic fixtureでRED→GREEN。未修正base上のarchive/admission probeも2 test成功
- 最終focused gate: 9 files / 70 tests成功（Node 26.10.0、Vitest 1 worker）。Atomic constraint/archive、scheduled Core/constraint/history、field prefix、Native execution、whole history、release custody compatibilityを含む
- 最終`npm run typecheck`と`git diff --check`成功
- 独立review: Critical / Important指摘なし。追加のorigin / position / spin mutationおよびrehash済みNative corruptionのprobeも1 test成功

UI/art/Presentation、scheduled Core、物理solver、schema、旧atomic結果、CI設定、lockfile、自宅PCは変更しない。全suiteの成功はこの記録では主張しない。
