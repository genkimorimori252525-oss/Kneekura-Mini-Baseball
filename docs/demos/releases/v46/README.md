# v46 — 走塁と守備AI改善版

- [通常試合HTML](game.html)
- [公開能力・詳細設定メーカー](maker.html)
- [変更と検証](../../../reports/2026-10-18-v46-running-and-fielding-ai.md)
- [最新入口](../../../handoffs/LATEST.md) / [開発史](../../../history/README.md)
- [配布SHA](SHA256.json) / [検証したCore入力105ファイル](tested-core-inputs.zip)

GitHubのHTML表示画面で **Download raw file** から保存し、ブラウザで開く。両方とも外部通信不要の単独HTML。

安全なタッチアップと追加進塁、非フォース送球からの実タッグ、捕球担当とカバーを改善。公開能力は11項目のまま。メーカーの「内部能力の詳細設定」には、走塁の安全余裕と追球負担の重みを追加した。試合用能力JSONを保存し、試合の設定から読み込み、新しい試合に反映する。旧JSONも使用できる。

通常HTMLで251球の規定9回を新規完走し、PC／スマホ幅を検証。現実の成績分布の校正、実機スマートフォン、全得能とNative連続世界の完成は含まない。既存のUI・視点・4px／55ms描画を引き継ぐ。

OpenBiomechanics実測派生研究データの[原案内](license.txt)、[データライセンス](LICENSE-DATA.md)、[コードライセンス](LICENSE-CODE.md)を保持。CC BY-NC-SA 4.0および上流の追加除外条件を参照。MMDは使用していない。
