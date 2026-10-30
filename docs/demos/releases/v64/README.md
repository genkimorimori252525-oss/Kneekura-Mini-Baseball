# にーくらMINIbaseball v64

- [通常試合](game.html)
- [カメラワーク調整室](camera-workbench.html)
- [共通選手メーカー](../v62/maker.html)
- [変更・検証・限界](../../../reports/2026-10-19-v64-overhead-ball-height.md)
- [SHA256](SHA256.json)

俯瞰専用の「高さによる拡大」を追加。初期値1ではv63と同じ見え方を保つ。1.5にすると地面の球は同じ大きさで、高い球だけ最大1.5倍になる。20m以上で指定倍率へ達し、その間は現在の高さに応じて連続的に拡大・縮小する。これは表示上の目印で、球の物理サイズや軌道を変えない。

通常試合では下部の「ボールの表示倍率」→「俯瞰：高さによる拡大」。調整室にも同じ欄があり、俯瞰を選んで同じプレーを比較できる。既存の俯瞰全体の倍率とは独立する。設定JSON／再現sessionへ保存でき、旧JSONは新項目1で読み込む。捕球した球は表示しない。

```text
py -3.10 -X utf8 tools/browser-bridge/prepare-v64-workbench.py
node tools/browser-bridge/build-v64.mjs
```

検証後に `py -3.10 -X utf8 tools/browser-bridge/package-v64.py` で配布する。v62／v63と同じNative Coreを使用する。打者カメラv63と投手v62は継承する。元全計画と未達は継続する。
