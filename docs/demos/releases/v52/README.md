# v52 — 視点追従調整版

- [通常試合HTML](game.html)
- [選手メーカー（v47と共通）](../v47/maker.html)
- [変更ファイル・検証・限界](../../../reports/2026-10-18-v52-camera-pursuit.md)
- [再開入口と元計画](../../../handoffs/LATEST.md) / [開発史H24](../../../history/INCIDENTS.md)
- [配布SHA](SHA256.json) / [同じv51 Core108入力の保存ZIP](../v51/tested-core-inputs.zip)

GitHubでは **Download raw file** からHTMLを保存してブラウザで開く。外部通信不要の単独HTML。

打者視点はv49を基準に戻し、投球の微小な動きへ視点が密着しすぎないよう調整した。既存のミート・選球眼で追従の強さと余裕が変わる。高能力にも有限の余裕を残し、低能力でも球を追う。v50のlv27用cameraとスイング終端+700msの保持を撤去した。

投手視点は打撃後0.5〜1.2秒待ってから打球追尾を始め、180msで既存の向き・画角へ接続する。待機中の早期守備視点切替を防ぎ、現在の投手の眼位置を使う。物理・守備走塁・バット・裁定はv51の同じCoreを継承する。

OpenBiomechanics実測研究データの[原案内](license.txt)、[データライセンス](LICENSE-DATA.md)、[コードライセンス](LICENSE-CODE.md)を保持。CC BY-NC-SA 4.0と上流の追加除外条件を参照。MMDを使用していない。
