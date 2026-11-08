# にーくらMINIbaseball v66

- [通常試合](game.html)
- [カメラワーク調整室](camera-workbench.html)
- [共通選手メーカー](../v62/maker.html)
- [原因・修正・検証・限界](../../../reports/2026-10-19-v66-swing-running-camera.md)
- [SHA256](SHA256.json)

v59寄りの打者視点と、バットに引かれる頭の微動を維持する。微動を走者・打球追尾の基準処理から独立させ、振り終わり180ms後までに滑らかに収束させた。実際の走り出し・カメラ位置・打球の物理は変えない。

調整室は既存の「バットに引かれる微動」で強さを比較できる。v65の俯瞰の高さ設定、見逃し、選球眼、投手、UI、設定／session保存を継承する。自動保存領域はv66で分離する。

```text
node tools/browser-bridge/build-v66.mjs
node tools/browser-bridge/check-v66-swing-running.mjs --capture
```

後者は凍結v65の実投球から検証入力を再取得する。通常／調整室の検証後、`py -3.10 -X utf8 tools/browser-bridge/package-v66.py` で配布する。v62〜v65と同じNative Coreを使用する。元全計画と未達は継続する。
