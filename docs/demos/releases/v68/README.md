# にーくらMINIbaseball v68

- [通常試合](game.html)
- [選手メーカー：実測の打ち方・弾道](maker.html)
- [カメラワーク調整室](camera-workbench.html)
- [実装・原因・限界](../../../reports/2026-10-19-v68-measured-form-trajectory-maker.md)
- [実検証](../../../verification/releases/v68/README.md) / [SHA256](SHA256.json)

3つのHTMLは、それぞれ単独でオフライン動作する。全673本の軌道を含むため約32〜33MBになる。外部ダウンロードは必要ない。

## 打ち方・弾道を変える

1. メーカーの「選手作成」で編集する選手を選ぶ。
2. 「この選手が使う打ち方」で、右打ち・左打ちに合う実測記録を選ぶ。
3. 「当たる付近の振り方を調整する」をオンにして弾道1〜4を選ぶ。細かな角度・前後の時間は折りたたみ欄で編集する。
4. 再生／停止、時刻バー、3方向の図で、元の軌道と弾道1〜4を比較する。
5. 「試合用能力JSON」で保存し、通常試合または調整室へ読み込む。メーカー全体のJSONにも選手設定を含めて保存できる。

設定へマウスを約1秒置くと説明を表示する。キーボードのフォーカスでも読み、スマホでは「?」をタップする。公開能力はG〜Sを主表示とし、隣の数値で細かく編集する。球速はkm/h、選球眼はリーグに依存しない絶対1〜100。

弾道2の角度差0が元の軌道。変更は当たる付近だけで、必ずゴロ・フライになる指定ではない。比較図は元の測定を基準にし、試合では選手の用具・体格・速さ・投球への位置合わせも反映する。初期20選手は従来のままで、追加661本は選んだ選手だけに使う。673人分のフォームではなく、98人の複数試行を含む673本のバット軌道である。

## 互換性と再生成

カメラと試合UIはv67を継承する。俯瞰の空中球は初期倍率2、地面は従来サイズ、保持中の球は非表示。物理サイズとは独立する。旧能力JSONでは新しい弾道設定を省略できる。旧Coreの再現sessionは新Coreの同一試合として読み込まず、カメラ設定JSONと区別する。

```text
node tools/browser-bridge/build-native.mjs
node tools/browser-bridge/build-v68.mjs
node tools/browser-bridge/build-maker.mjs ../../outputs/にーくら野球メーカー_v68.html --executable-traits --measured-library --roster=docs/demos/live-game-roster-v62.json --catalog=docs/demos/live-game-roster-catalog-v62.json
```

生成後の検証を通してから `py -3.10 -X utf8 tools/browser-bridge/package-v68.py` で凍結する。ライブラリの再取得方法・出典・ライセンスは [原データ監査](../../../verification/releases/v68/measured-library/README.md)を参照。元の全計画と未達は継続する。
