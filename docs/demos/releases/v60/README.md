# にーくらMINIbaseball v60

- [通常試合](game.html)
- [カメラワーク調整室](camera-workbench.html)
- [変更ファイル・検証・限界](../../../reports/2026-10-19-v60-impact-and-name-controls.md)
- [配布SHA256](SHA256.json)
- [共通選手メーカー（v54）](../v54/README.md)

調整室A/Bに「安定開始：予定インパクトから」「安定中に許す角度」「安定中の最大角速度」を追加。負の時刻は早め、正は遅め。実際の開始は打者の意思決定からスイング終端まで。角度または速度を0にすると完全固定。初期値0ms/.025rad/.18rad/sはv59の視点と同じ。

カーブを生成した後、早め/遅めの記録ボタンで実記録を選ぶ。表示する誤差は打者の予測に対するタイミング誤差で、結果やバット時刻を変更しない。該当球がなければカーブを追加生成する。

通常試合の「選手名の表示サイズ」と調整室の「選手名のサイズ」で.5〜2.5倍へ変更できる。初期1。全視点で名前は投影位置に重なり、走者名を優先する。球は文字/背景枠の手前へ描き、保持中は引き続き非表示。調整室のJSONと再現sessionは名前倍率も保存し、旧JSONは新項目の初期値を補う。

自己完結HTMLでオフライン起動可能。Core113入力・物理/スピン/実測バット/能力/AI/裁定はv59と同じ。投球球22ms/他55ms、4px格子、球倍率1、投手待機100〜250msを継承する。

再生成と主要検証:

```text
node tools/browser-bridge/build-v60.mjs
node tools/browser-bridge/check-camera-impact-gaze-v60.mjs
node tools/browser-bridge/check-name-presentation-v60.mjs
py -3.10 -X utf8 tools/browser-bridge/package-v60.py
```

ブラウザ/周期/配布の実コマンドは報告からmachine receiptへ辿れる。生体校正、実機の主観的快適さ、元全計画の未達を今回の完了へ含めない。
