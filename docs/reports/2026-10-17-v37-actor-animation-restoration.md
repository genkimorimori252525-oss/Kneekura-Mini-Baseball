# v37 — 投球・打撃アニメーション復元

成果物：`outputs/ばせぼーるlv37_TBD_vs_LAD_アニメーション復元版.html`（workspace直下）。単体でオフライン起動できる。v36以前のHTMLは保存した。

HTML SHA-256: `f7281baac644411d95f1ceff175a74a50e0d611f8a58acb5698d59a0191d6870`

## 変更内容

- 通常試合runtimeの `batFrame:0,pitchFrame:0` 固定が停止原因だった。投球は旧v31と同じ6段階の画像を準備・リリース・後続動作の表示時刻で選ぶ。結果待機中にも後続姿勢を進める。
- 打撃は既存4段階の画像を、実際に選択されたOBP clipの参照開始・終了・rate・実接触時刻に合わせて選ぶ。接触姿勢は55ms保持する。見逃し・バントでは4コマのスイングを再生しない。身体の実測運動を実装したという意味ではない。
- 投手視点は、採用済みのバットを含む打者画像を使い、Coreバットの通常描画・overlayを両方止める。A光点表示中もこの打者だけは既存画像を使う。他の視点は実測Coreバットを維持し、物理上のバットは全視点で不変。
- 実際の移動は走行、ベンチ帰還は低速の歩行コマ、静止走者は走者姿勢に割り当てる。インプレー後の投手・捕手は走行／守備姿勢へ移る。実送球リリースが観測された投げ手には既存投球画像の3→4→5を使う。投げ手の左右は投げ手側のhandを選ぶ。送球後も表示時刻で静止姿勢へ戻し、未来の送球イベントから姿勢を先行させない。
- 走者カメラだけ、同じ高さにある守備者との平面距離が身長×0.90未満なら体の画素を書かない（身長1.83mで1.647m）。深度を書き込む前に抑制し、背景や球を隠さない。実位置・判定・名前アンカーは保持。距離・視点変更時に毎描画で再計算し、他の走者は対象外。
- v31のUI／準備・待機、俯瞰の小さな白点、保持球非表示、打者名の走行開始時表示、v36の実測左右登録・打者カメラ・守備カメラを維持。

## 変更ファイル

すべて `work/mini-baseball/` 以下の新規表示／検証ファイル。旧バージョンのソースは保存した。

- `tools/browser-bridge/live-actor-animation.js`: 読取専用の姿勢選択。
- `tools/browser-bridge/v37-live-runtime.js`: v36に姿勢選択と再生位置指定を追加。
- `tools/browser-bridge/v37-live-presentation.mjs`: バット排他表示・画像選択・近接表示。
- `tools/browser-bridge/build-v37.mjs`: v37オフラインHTML生成。
- `tools/browser-bridge/check-v37-animations.mjs`: 下記の実ブラウザ試験。
- `tools/browser-bridge/check-v37-visibility.mjs`: v36の既存表示試験を再使用。投手視点のバット期待値だけ最新指示へ更新。
- 本報告書と `docs/ai-continuity/AMENDMENTS/2026-10-17-actor-animation-restoration.md`、CURRENT／証拠索引。

## 検証結果

最終build PASS `97c352ff1b374571b029768a0e4bf4b8`。元PNG mask・font・旧計算部のバイト同一性をbuildで検査。

```powershell
node tools/browser-bridge/build-v37.mjs '../../outputs/ばせぼーるlv37_TBD_vs_LAD_アニメーション復元版.html'
node tools/browser-bridge/check-v37-animations.mjs '../../outputs/ばせぼーるlv37_TBD_vs_LAD_アニメーション復元版.html' '../../outputs/NEW-animation-evidence'
node tools/browser-bridge/check-v37-visibility.mjs '../../outputs/ばせぼーるlv37_TBD_vs_LAD_アニメーション復元版.html' '../../outputs/NEW-visibility-evidence' --registered-field
```

- アニメーション統合 PASS `0b83dd1fcf2741478d852b6ae49bc3f6`、16.640s。1200/390幅ごとに実8球と追加の見逃し1球。投球0..5、打撃0..3、左右、moundのretro／point両方で画像内バットのみ・Core overlay透明、他の一人称のCoreバット表示、保持球0画素、俯瞰白点、遠近法の下限なしを確認。近接境界は実Sourceから複製した表示専用データで距離内外・高さ違い・他走者・他カメラを各appearanceで確認（架空の試合イベントではない）。Sourceのframe/play/event/matchの8球全ハッシュがv36と一致し、表示操作で記録が変わらない。
- 既存表示退行 PASS `a5f25031bbff495ea1b30706c25e3db9`、9.655s。1200/390幅ごと8球。実送球2件の途中で視点が実受け手へ切り替わり、視線が球へ向くこと、名前の表示開始・赤色、保持球0画素、白点、左右とゾーンを確認。
- 全97 Core入力・埋込みbundleはv36と同じ。bundle SHA `58fd175690dc2fc75791bc0d782c4f04069a7970dcc24c76f5ad6766b84fe2e7`。実測JSON SHA `72b615a28cd99b4a91c6e52cb02ee35f4ff97850c3bfe71ca73d0e609ba480ef`。今回Core／物理ソースは変更していないため、TypeScript全件・9回／100試合監査は重複実行していない。
- 限定関数検証：初期待機、見逃し／バント、送球前に振らない、Source停止後の後続姿勢を確認。`a768b0a897a54755836abe5943c02a76` は初期helper、最終の短送球待機は `f5e69aa40be749faaae3ba5b9eaf2df1`。
- 最終desktop投手左打者とmobile走者の画像を目視した。ページ例外・外部ネットワーク要求とも0。実機スマートフォンは未確認。

原FAILは保存した。v36への新機能試験は期待どおりhelper欠落でFAIL `fb6ffe021a014ff8be4e47424ffdae3e`。QA V1 `5ca95fc5...` は過去球選択中のnext操作を新球発行と取り違え、V2 `00c78fd1...` は接触同tickのincoming/outgoingを取り違えた試験選択ミス。試験だけを直し、最終V3で確認した。限定関数試験の浮動小数点境界FAIL `9bb4e32f...` も保持し、次の実用表示刻みで確認した。

## 残る制約

近接距離と4コマの身体姿勢は中継表示の規約であり、身体運動の実測校正ではない。元の全体計画（実選手能力・得能／SI、Native連続世界、未接続裁定・採点、実機確認）は継続中。今回の画像復元を全体完成とはしない。既存Charter UNAPPROVED/HOLDを維持する。依存・設定・lockfile・secret・DBは変更せず、push／mergeは実行していない。
