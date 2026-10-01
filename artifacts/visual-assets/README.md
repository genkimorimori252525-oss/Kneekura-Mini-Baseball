# Kneekura Mini Baseball — 描画素材アーカイブ

描画担当で確定した素材と、指定された統合試験版を保管するアーカイブです。

## 収録物

- `kneekura-mini-baseball-match-v16.html`: ユーザー指定の統合試験版16
- `kneekura-mini-baseball-match-v14.html`: 最新の素材マッピングを組み込んだ描画ビルド
- `kneekura-approved-player-art-v1.html`: 採用原画ギャラリー
- `approved-player-art-v1/manifest.json`: 原画の役割・SHA-256・寸法
- `approved-player-art-v1/originals-white/`: 採用原画と追加フォロースルーPNG（白人版）
- `approved-player-art-v1/originals/`: 既存参照互換用の原画コピーと追加シート
- `approved-player-art-v1/originals-black/`: 採用原画と追加フォロースルーPNG（黒人版）

背面素材は、カメラの遮蔽関係に応じて使い分けます。前側にあるグローブが背中で隠れるポーズは `back-occluded-v1`、肩外側または頭上に出るポーズは `back-defense-v1` を使用します。背面走行はユーザー承認済みの `back-view-v1` を使用します。

打撃は低め・真ん中・高めでインパクト第3コマのみを切り替えます。グローブ色は専用マスクを描画時に塗り替えます。肌色とグローブ色はv14描画プレビューの「表示設定」で変更できます。

打撃第4コマのフォロースルーは、左右打者別に5ポーズ（高め空振り・低め空振り・ファウル・ゴロ・フライ/安打）を追加しました。白人版・黒人版は肌色名を含む別PNGで各2シートです。描画プレビューでは打球結果と高さから該当ポーズを選択します。白人肌色は黄みを抑えた明るいピーチ系に変更しています。

このアーカイブは描画成果物の保存用です。試合計算Coreの実装や公開APIは変更しません。
