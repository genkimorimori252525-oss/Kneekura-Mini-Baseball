# 最新の再開入口 — 2026-10-18

現在は **v45（連続打者視点）**。既存ブランチ `jolly/tbd-lad-native-browser-core-2026-10-14`、[Draft PR #380](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/380)で継続する。mainへのマージはしていない。

- [最新の通常試合HTML・保存方法](../demos/releases/v45/README.md)
- [公開能力メーカー（v41のまま）](../demos/releases/v41/maker.html)
- [開発史・原因分析の入口](../history/README.md)
- [今回の実装・検証](../reports/2026-10-18-v45-continuous-batter-view.md)
- [元の全要求・実装計画・受入条件](2026-10-15-mini-baseball/00-START-HERE.md)
- [2026-10-17時点の能力接続・再生成の記録](2026-10-17-LATEST.md)

## 現在の実装範囲

ローカルHost＋共有Coreの通常試合。B1/4px/55ms、v31以来のUI・間・配球・アニメ、所持球非表示を保つ。OpenBiomechanicsの実測研究軌道を使い、MMDへは戻らない。公開11能力と内部40SIはv41から変更していない。

v45は打者のeye・角度・角速度を一つの状態として維持し、投球追跡→予定打点→打球追尾→走者移動を連続化。焦点距離・画面中心を固定し、突然の切替をなくす。知覚遅れと予測差、選球眼SIの表示用対応は暫定policyであり、実測眼球能力ではない。保持球は隠したまま。物理・判定・他の視点は変更していない。v43/v44も履歴として保存する。

現在のCoreは`7bc3982`由来、bundle SHA256 `f29aeeb7ed1e54c5f668a8ededa569d44880b0f2826197be1fd64d8c57fb6aaa`、103入力。v45 HTML SHA256 `f075101ca0ff6c5a154183deab68355fc9bfb1767684417f11fad78a6b769996`。同じv41という名前でも保存当初のCoreと後続更新後のCoreは違う。

## 今回確認したこと

- Observerのprefix-only、予定打点の早期未読、単一eyeの不規則55ms追従、上限変更・直接seek・再生・巻戻しの一致、有限追従を確認。
- Chrome 1200px/390pxで左右スイング16境界、6見送り、実時間再生、角速度／角加速度制限、他の4視点、所持球非表示と次球前の正面復帰を確認。
- 12球の全`frames/play/events/match` hashはv44と一致。Core103入力と埋込bundleも同一。全体テスト・9回・100試合を今回新規実行したという意味ではない。
- 原FAIL、検証条件が弱かった旧PASS、過去の訂正を保持し、[原因別の事例](../history/INCIDENTS.md)へ整理した。

## 残るもの

Native SQLite認証された全体連続世界、返球・再整列・全身／バット反動・落下などの接続、未完の公式H/E・ルール経路、全得能消費、実選手能力と成績分布の校正、最新Sourceでの100試合以上の監査、実機スマートフォン。旧400/101試合や保存当初v41の511球を現在Sourceの証拠にしない。

Charter外部承認不足／HOLD、過去のFAIL/UNKNOWNを保持。会話での最新の作業承認と機械的なCharter承認は別。再開時は作業ツリーとSourceを先に確認し、[履歴の追記単位](../history/README.md#今後追記する単位)に沿って変更理由を残す。

## 再生成・限定検証

```sh
node tools/browser-bridge/build-v45.mjs dist/rebuilt-game-v45.html
node tools/browser-bridge/check-continuous-batter-view.mjs
node tools/browser-bridge/check-v45-continuous-view.mjs dist/rebuilt-game-v45.html outputs/new-v45-camera-proof
```

既存のnative bundle/manifestは同一のまま使う。Source変更や改行変換があれば、その環境で再ビルド・再検証し、旧SHAの証拠をそのまま流用しない。ブラウザQAのPlaywright/Chromeパスは現環境のWindows向け。Nativeの非公開DBは本HTMLに不要で、Native再開に必要な所有者DBをGitHubへ公開しない。
