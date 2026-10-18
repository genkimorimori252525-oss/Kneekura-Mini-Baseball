# 最新の再開入口 — 2026-10-18

現在は **v44（見送り視線修正）**。既存ブランチ `jolly/tbd-lad-native-browser-core-2026-10-14`、[Draft PR #380](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/380)で継続する。mainへのマージはしていない。

- [最新の通常試合HTML・保存方法](../demos/releases/v44/README.md)
- [公開能力メーカー（v41のまま）](../demos/releases/v41/maker.html)
- [開発史・原因分析の入口](../history/README.md)
- [今回の実装・検証](../reports/2026-10-18-v44-taken-gaze-and-history.md)
- [元の全要求・実装計画・受入条件](2026-10-15-mini-baseball/00-START-HERE.md)
- [2026-10-17時点の能力接続・再生成の記録](2026-10-17-LATEST.md)

## 現在の実装範囲

ローカルHost＋共有Coreの通常試合。B1/4px/55ms、v31以来のUI・間・配球・アニメ、所持球非表示を保つ。OpenBiomechanicsの実測研究軌道を使い、MMDへは戻らない。公開11能力と内部40SIはv41から変更していない。

v43は予定打点を有限スイング終了まで注視。v44は見送り球が実際にplate前1mへ来てから小さく視線を動かし、捕球後も最後の可視位置を視線用に保持する。球は隠したまま。物理・判定・他の視点は変更していない。

現在のCoreは`7bc3982`由来、bundle SHA256 `f29aeeb7ed1e54c5f668a8ededa569d44880b0f2826197be1fd64d8c57fb6aaa`、103入力。v44 HTML SHA256 `def5e0c9e4a27ad99422a615c10e58f9f4cf9e3e778b6f58c7336457c383cee5`。同じv41という名前でも保存当初のCoreと後続更新後のCoreは違う。

## 今回確認したこと

- Helperのprefix-only、開始条件、捕球後の視線と非表示、停止時計・巻戻し・次球の準備を確認。
- Chrome 1200px/390pxで左右6見送り球、実時間再生、控えめな角度制限、他の4視点、v43の左右打点注視と追尾復帰を確認。
- 12球の全`frames/play/events/match` hashはv43と一致。Core103入力と埋込bundleも同一。全体テスト・9回・100試合を今回新規実行したという意味ではない。
- 原FAIL、検証条件が弱かった旧PASS、過去の訂正を保持し、[原因別の事例](../history/INCIDENTS.md)へ整理した。

## 残るもの

Native SQLite認証された全体連続世界、返球・再整列・全身／バット反動・落下などの接続、未完の公式H/E・ルール経路、全得能消費、実選手能力と成績分布の校正、最新Sourceでの100試合以上の監査、実機スマートフォン。旧400/101試合や保存当初v41の511球を現在Sourceの証拠にしない。

Charter外部承認不足／HOLD、過去のFAIL/UNKNOWNを保持。会話での最新の作業承認と機械的なCharter承認は別。再開時は作業ツリーとSourceを先に確認し、[履歴の追記単位](../history/README.md#今後追記する単位)に沿って変更理由を残す。

## 再生成・限定検証

```sh
node tools/browser-bridge/build-v44.mjs dist/rebuilt-game-v44.html
node tools/browser-bridge/check-live-batter-gaze.mjs
node tools/browser-bridge/check-live-taken-pitch-gaze.mjs
node tools/browser-bridge/check-v44-taken-gaze.mjs dist/rebuilt-game-v44.html outputs/new-v44-camera-proof
```

既存のnative bundle/manifestは同一のまま使う。Source変更や改行変換があれば、その環境で再ビルド・再検証し、旧SHAの証拠をそのまま流用しない。ブラウザQAのPlaywright/Chromeパスは現環境のWindows向け。Nativeの非公開DBは本HTMLに不要で、Native再開に必要な所有者DBをGitHubへ公開しない。
