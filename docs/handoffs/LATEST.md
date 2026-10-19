# 最新の再開入口 — 2026-10-20

現在は **選手メーカーv74／通常試合v74／調整室v74**。既存ブランチ `jolly/tbd-lad-native-browser-core-2026-10-14`、[Draft PR #380](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/380)で継続。main未マージ。

- [HTML・保存方法](../demos/releases/v74/README.md)
- [原因・変更・検証範囲](../reports/2026-10-20-v74-equipment-public-overflow.md)
- [実検証索引](../verification/releases/v74/README.md)
- [開発史・H48](../history/INCIDENTS.md)
- [元の全要求・計画・受入条件](2026-10-15-mini-baseball/00-START-HERE.md)

v74は用具3m/5kgを同じ選手の描画/衝突へ接続、メーカーのみ公開能力100超、選球眼1〜100維持、打球比較のみ全幅へ。バット軌道の配置、初期20人、元673記録、元フォーム分類は維持。group作成max=nullは無制限の物理を意味せず、有限/0以上/既存SI検証で編集全体を拒否する。通常画面に能力表や公開投影のDOM経路はない。将来表を追加する場合は表示のみ100までとする。

通常HTML/Coreに用具範囲を反映済み。JSONを読み込み新しい試合を開始する。旧CoreのreplayはCore hash不一致で拒否、設定JSONは互換。Native2073bc28/115inputs、Maker837d0b2b/82inputs、union122。関連104tests/TSC/実ブラウザー/前版6球exact/旧206凍結物一致。原FAIL/中間PC277pxの目視結果も保存。

元の累積計画は継続。全身筋力再計算、Native連続世界、実選手SI経験的校正、全得能、100試合分布、実機検証などの未達はCURRENTと原資料を引き継ぐ。v73の9回証拠は保持し、新たな全目標完了とは扱わない。ユーザーAGENTS変更を編集/stageしない。原CharterHOLD/旧FAILUNKNOWNを自動承認へ変換しない。

製品保存commit `3fd9f60`。公開照合db06847e PASS（3HTML Git blobs＋raw9）。後続は検証記録のみ保存し、製品bytesは不変。
