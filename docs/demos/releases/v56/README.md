# にーくらMINIbaseball v56

- [通常試合HTML](game.html)
- [カメラワーク調整室](camera-workbench.html)
- [選手メーカー（共通・v54のまま）](../v54/maker.html)
- [変更・検証・限界](../../../reports/2026-10-19-v56-pitch-presentation.md)
- [SHA256](SHA256.json)

HTMLをダウンロードしてローカルで開く。各HTMLは必要なCore・画像・フォントを含み、外部通信を必要としない。通常試合は自由な次球と規定9回の進行を継承する。

今回の「2.5倍」は投球のボールの描画FPS。目標間隔は投球球22ms、背景・選手・バット・打球・送球55ms。球の大きさと4px格子の画質は既存のまま。実際の表示頻度は画面更新周期と端末性能に依存する。

調整室のAは従来の投球追従、Bは改善初期値。新しい「投球の追従率」と「追わずに許す範囲」で、ボールを動きのまま追いすぎる挙動を調整する。初期値0.15／0.02rad、1／0radで従来値へ戻る。許容範囲は角度であり、反応を遅らせる時間ではない。スイング関連の4項目も継承する。

球の表示倍率は通常視点／俯瞰を個別設定でき、初期値は1。物理半径は変わらない。通常試合では「ボールの表示倍率」を開く。調整室はA/B共通の倍率を使う。JSONの設定・再現sessionへ保存でき、旧JSONも読める。

再生成:

```text
node tools/browser-bridge/build-v56.mjs
node tools/browser-bridge/check-ball-display-controls-v56.mjs
node tools/browser-bridge/check-camera-tuning-batter-view-v56.mjs
node tools/browser-bridge/check-pitch-ball-cadence-v56.mjs
node tools/browser-bridge/check-v56-display.mjs "../../outputs/ばせぼーるlv56_TBD_vs_LAD_投球描画と追従調整版.html" "../../outputs/カメラワーク調整室_v56.html" "../../outputs/verification-v56-display-recheck"
node tools/browser-bridge/check-v56-cadence.mjs
py -3.10 -X utf8 tools/browser-bridge/package-v56.py
```

表示checkerは新しい証拠ディレクトリを指定する。browser checkerは既存のChromeとCodex workspace runtimeのPlaywrightを使用する。依存追加は不要。Coreは同じ113入力。球物理・実測バット・能力・AI・裁定・メーカーを変えた版ではない。原全計画や全体成績の校正完了は意味しない。
