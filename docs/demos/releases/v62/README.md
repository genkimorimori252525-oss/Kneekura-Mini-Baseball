# にーくらMINIbaseball v62

- [通常試合](game.html)
- [カメラワーク調整室](camera-workbench.html)
- [リリース位置を編集できる選手メーカー](maker.html)
- [変更・検証・限界](../../../reports/2026-10-19-v62-pitcher-view-release.md)
- [SHA256](SHA256.json)

投手の目をマウンドの位置・高さ・身長へ接続し、同じ投球時計で身体と頭が動く試作を追加。通常試合の「投手視点：投球時の身体・頭の動き」で停止・倍率変更できる。調整室にも同じ設定があり、調整JSON／再現セッションへ保存する。これは既存アニメーションに同期する仮の頭部・上体モデルで、実測骨格ではない。

右投げは投手自身の右（world −x）、左投げは左（world ＋x）から実際に投球する。メーカーの投球詳細でリリース高さ、左右幅、前方への伸びを編集し、試合用JSONを保存して通常試合へ読み込み、「新しい試合」で反映する。初期値は身長比の暫定値で、実在選手の実測値ではない。

十分深く、全9人の捕球機会がないと観測から予測できた打球では、投手視点を維持し、野手は減速して待機する。際どい打球では通常の守備を続ける。公式HRは実際のフェンス通過時に確定する。

```text
node tools/browser-bridge/build-native.mjs
node tools/browser-bridge/build-maker.mjs ../../outputs/にーくら野球メーカー_投球リリース編集版_v62.html --executable-traits --roster=docs/demos/live-game-roster-v62.json --catalog=docs/demos/live-game-roster-catalog-v62.json
py -3.10 -X utf8 tools/browser-bridge/prepare-v62-workbench.py
node tools/browser-bridge/build-v62.mjs
```

実行済み検証を照合してから `py -3.10 -X utf8 tools/browser-bridge/package-v62.py` で配布する。全HTMLは自己完結。従来の調整JSONは読み込めるが、投球物理・守備AIを変えたため旧Coreの再現セッションは同一試合として読み込まない。v61までの凍結HTMLと原証拠は保存している。元の全計画の完了は宣言しない。
