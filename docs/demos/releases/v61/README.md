# にーくらMINIbaseball v61

- [通常試合](game.html)
- [カメラワーク調整室](camera-workbench.html)
- [選球眼の絶対値に対応した選手メーカー](maker.html)
- [変更・検証・限界](../../../reports/2026-10-19-v61-take-sync-absolute-vision.md)
- [SHA256](SHA256.json)

見逃しを投球のSource時刻へ同期し、捕球後の遅い向き直しを止めた。選球眼は1〜100の絶対値で、45が指定設定.26/.02の基準。100で追従率.70/許容角0、1でも.13/.04で有限追従する。調整室には基準と現在選手の実効値を表示する。

旧20人の公開選球眼を42〜96で引き継ぎ、メーカーのリーグ切替/母集団で変動させない。旧JSONとv60設定/sessionも移行できる。選球眼編集後の試合用JSONを通常HTMLへ読み、「新しい試合」で使う。v60の名前/ボール前面/サイズ/impact調整は維持。

再生成（既存dependenciesを使用）:

```text
node tools/browser-bridge/build-native.mjs
node tools/browser-bridge/build-maker.mjs ../../outputs/にーくら野球メーカー_選球眼絶対値版_v61.html --executable-traits
node tools/browser-bridge/prepare-v61-vision-roster.mjs
node tools/browser-bridge/build-v61.mjs
```

配布前に報告のunit/browser/cadenceを実行し、`py -3.10 -X utf8 tools/browser-bridge/package-v61.py` で照合する。全HTMLは自己完結し、外部通信不要。A従来は旧カメラ比較用。新しい能力連携と見逃し同期は調整有効モードへ適用する。初期能力・カメラ係数は実測校正ではなく、元計画の未達を今回の完了に含めない。
