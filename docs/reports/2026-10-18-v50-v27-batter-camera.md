# v50 — lv27基準の打者カメラとスイング終了後700msの注視

[通常HTML](../demos/releases/v50/game.html) / [最新入口](../handoffs/LATEST.md) / [前版v49](2026-10-18-v49-positional-defense.md)

ユーザーの最新指示により、打者カメラをlv27の構図・見逃しへ戻した。バットの実測軌道・位置、選手能力、v49の守備走塁・裁定、他のカメラ、既存UIは維持した。Downloadsの指定lv27と保存baselineはSHA `c613574b377afd19060d89100c1bd7c1fa693efd42361c77ed7ab21943670f1f`で完全一致する。

## 原因と変更

v48の見逃し後には、捕球から一定時間後のreturn-readyと、残った角速度の積分があった。制動を強めても、この復帰と積分が微動を残した。v50では見逃しにこの制御器を使用せず、lv27の投影式で直接姿勢を決める。

構図は `eye=(-.4*s,max(1.15,height*.77),-.95)`、`yaw=atan2(.4*s,19.4)`、`pitch=.08`、`f=400,cx=300,cy=110`。右左の符号もlv27と同じ。見逃しは実球がプレート近傍のz<=1mへ来てから165msで小さく向き、yaw差±.40rad／pitch差±.18rad、z下限-.42m、画角6%・ラベル3%縮小、cy172というlv27の制限を用いる。旧固定38〜41tickの開始だけを現Coreの球速に合わせた。最後の可視投球を参照し、捕球後に戻したり揺らしたりしない。次球ではlv27同様、初期構図へ戻る。

スイング中は、実測軌道に登録された予定打点を直接注視する。実際の打球先から狙いを逆算しない。`referenceThroughTick`で示す有限スイングの終了に**700ms**を足し、その時点から既存の打球追尾へ戻す。旧バット画像の22tick静止holdは終了時刻の根拠にしない。デッドボールなどでCore frame時計が止まっても、表示時計から700msを計る。従来の9tick=495msの補間で既存field observerへ移り、補間完了後はその姿勢をそのまま返す。

身体が先に走り始めても、目だけが本塁に残ることは避ける。身体への追従eyeは最新版を用い、変更するのは打者の向きと見逃し方である。チェンジ時のベンチ演出は既存の優先順位を保つ。バントは実際に観測した打球接触を待ち、空振り後に架空の打球を追わない。

## 変更ファイル

- [live-v27-batter-view.js](../../tools/browser-bridge/live-v27-batter-view.js): lv27構図、見逃し固定、予定打点保持、700ms遅延と既存身体／field observerへの接続。
- [v50-live-presentation.mjs](../../tools/browser-bridge/v50-live-presentation.mjs) / [build-v50.mjs](../../tools/browser-bridge/build-v50.mjs): 既存v49を保持する新バージョンの表示・単独HTML生成。
- [check-v27-batter-view.mjs](../../tools/browser-bridge/check-v27-batter-view.mjs) / [check-v50-batter-view.mjs](../../tools/browser-bridge/check-v50-batter-view.mjs): 単体・実ブラウザ回帰。
- [check-v50-release.mjs](../../tools/browser-bridge/check-v50-release.mjs): 最新・旧版のbyte、Core全入力、参照・配布検査。

`src/`、Core bundle、選手データ、最新バット、既存カメラhelperは変更していない。

## 検証

- [単体PASS](../ai-continuity/verification-receipts/MB-20261018-V50-CAMERA-UNIT-FINAL_0ecac62ffa6644babd36c57b4d2d1503.json): lv27左右の構図、165ms制限角、見逃し後の完全静止、慣性制御器未呼出、実測終端+700ms、既存field姿勢への完全復帰、身体eye、巻戻し、停止Source時計、判断前・未来frameの非参照、空振り。
- [生成PASS](../ai-continuity/verification-receipts/MB-20261018-V50-BUILD-FINAL_4d22178bec574a4dbc40b9a73be93294.json): 承認PNG・font・旧計算の保全。
- [実ブラウザPASS](../ai-continuity/verification-receipts/MB-20261018-V50-BROWSER-FINAL_ac0c48f136ae4974b834d0028479a008.json)、25.061秒。[生QA](../verification/releases/v50/v50-batter-view-check.json)。1200/390px、左右実スイングで終了+699msは予定打点、+700msは追尾開始・進捗0、補間後は旧field poseと完全一致。6見逃しの完了後4時点で姿勢・光学値・目標が完全一致。他4カメラ24時点、保持球非表示、巻戻し・再生、4px、ページエラー・外部通信0。画像を視認した。
- 実12球の `frames/play/events/match` とバット全時系列のSHAがv49と一致。Core107入力とbundle SHAも同一。v49の250テストと320球の規定9回は同じCoreの既存証拠であり、今回の新しい250テスト／9回実行とは呼ばない。

HTML SHA `acc38cf4566438a2a4faadc1a7ef105c7bfd83e512af5b1a46ac75b76c32ee26`、新helper SHA `b5282910135f4a3abdeb5512a80e65c9311f52e55369bb410600f5b4d900048d`。Coreはv49と同じ`e0677928d7641513228fb78782a8afcceb5e4890fddbd99ac93c05f271da2e6c`。[配布SHA](../demos/releases/v50/SHA256.json)を参照。

旧v48を使う単体の[見逃し微動再現FAIL](../ai-continuity/verification-receipts/MB-20261018-V50-TAKE-DRIFT-RED_aaee791d41fb4372aa6b3c416a11d872.json)を保持。最初のQAには未作成helperと、1.386というリテラル期待の丸め違いによるテスト作成ミスもあり、製品の根因とは区別する。初回ブラウザは補間完了pitchの1ulp差でFAILしたため、完了時は旧姿勢を直接返す最小修正をした。テスト閾値は緩めていない。[初回ブラウザ原記録](../verification/releases/v50/development/browser-v1-fail.json)も保持する。

## 残る範囲

見逃しの固定、700ms、補間時間はユーザー指示・lv27に基づく表示仕様であり、眼球や頭部の実測校正ではない。快適さはユーザーの実際の確認を要する。390pxは実機スマートフォンの証明ではない。元の全計画、v49で明記したNative連続世界・足接触・全規則／得能・野手衝突回避・統計校正等の残件、原FAIL/UNKNOWN/Charter HOLDは維持する。
