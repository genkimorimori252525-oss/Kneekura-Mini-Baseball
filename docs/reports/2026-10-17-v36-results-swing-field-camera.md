# v36 — 結果表示・左右の実測軌道・守備カメラ

最終HTML: `outputs/ばせぼーるlv36_TBD_vs_LAD_結果表示タイミング修正版.html`。SHA256 `4593d5f65dada973247e2c6d942f630ca037b9d75c72927928aa8137ff22f1dc`。v34/v35と原実測JSONは保全した。

## 最新依頼への対応

- 打者視点はv34の構図へ戻した。v35で変更したカメラを原因とする説明は、今回の実測座標監査で訂正する。
- R/Lそれぞれの実測スイングを、正しい球場座標へ登録した。表示だけを反転する修正ではない。
- ホームランの見出し・色・読み上げは、フェアの未接地打球が越柵したCore確定時刻から表示する。フライアウトは打者本人の捕球アウトが成立してから表示する。得点・BSO・攻守交代・走塁終了は公式プレー終了時刻を維持する。配球図・投球一覧の確定公開は従来どおりプレー終了時。
- 守備視点は自由球を注視し、現在の守備者が捕球して投げるところを見せる。送球距離の約半分（距離に応じ48〜52%の範囲）で、送球時にCoreが決めた受け手へ切り替える。受け手も現在の球を注視する。保持中は発行済みの送球目標を使う。
- 俯瞰の小さな白点、保持球の非表示、打者名を隠して実走行開始後に赤く出すv35の変更は維持した。

## スイングの根因と物理変更

OBP原文は `+labX: home→mound / +labY: right-handed box / +labZ: up`。保存された研究JSONは `(labY,labZ,labX)` であり、ゲームの `+fieldX` は一塁方向。従来の登録では右打席が一塁側、左打席が三塁側に逆配置されていた。前回の「clip.sideは一致しているので正常」という検証は、この座標前提を確認できていなかった。

原JSONを変えず、消費時に位置 `(-storedX,storedY,storedZ)`、姿勢 `(w,x,-y,-z)` を適用した。バットのローカル長軸は+Yなので、位置・先端・芯が同じ鏡映になり、線速度は `(-vx,vy,vz)`、軸性角速度は `(wx,-wy,-wz)` になる。右打席を三塁側−X、左打席を一塁側+Xへ配置し、内角／外角も整合させた。左右各6軌道を維持し、Rの軌道でLを代用していない。診断に原clip IDと登録規約を残した。

これは接触と打球を含む正式な物理変更であり、同じシードでも旧版と試合結果が変わる。旧101試合の証拠は新物理の証明として流用しない。カメラのためのCore変更は、既存 `throw_release` に実際の `receiverPlayerId` / `target` を加える読み取り用metadataだけで、守備判断・送球軌道は変更しない。

## 変更ファイル

- `src/integration/browser/MeasuredBatFieldRegistrationV1.ts` と同test — 実測座標の登録と全キー／中点検証
- `src/integration/browser/LivePitchV1.ts`、`LiveBaseballMatchV1.ts` — 登録、打席、内外角
- `src/integration/browser/index.ts` — 既存塁座標の再export
- `src/core/sim/fielding/LiveFieldPlayV1.ts` と同test — 送球時点の実recipient metadata
- `tools/browser-bridge/live-field-camera.js` — 現時刻までのSourceだけを読む視点切替
- `tools/browser-bridge/v36-live-runtime.js`、`v36-live-presentation.mjs`、`build-v36.mjs` — 結果表示と描画への接続
- `tools/browser-bridge/check-v36-results.mjs`、`check-v35-visibility.mjs` — 統合ブラウザ検証

## 検証

- **全Source型検査PASS** `5e3f6be890a84f62a384a7db98c51c6d`。**5ファイル75テストPASS** `44bda8dc88664bb2bf831aba31f2a13f`。9回完走のunit試合を含む。
- 実測12軌道の1,644キーと1,632中点で、位置・先端・芯・線速度・角速度・掃引速度の鏡映関係と長さを確認。原JSON SHA `72b615a28cd99b4a91c6e52cb02ee35f4ff97850c3bfe71ca73d0e609ba480ef` 不変。32限定テストPASS `3949fb67fb8b4d6d9b57f39e93cf4e43`。
- **新物理の追加2試合・363球を9回まで完走** `6d48f4d733d54916a680fc44eba01708`。237接触・79送球・260捕球・6複数アウトプレー、例外0。全保存記録の裁定再適用・順序・hash・集計・改ざん検出PASS `ea2f5bc9fba54af9941736a84ada13bc`。この保存監査では物理再実行を追加していない。凍結Sourceは `work/v36-field-registration-audit-v1`、60入力・bundle SHA `d8b5507c0184162babd7da8694cf284404ca08460e96fb7e5bc462540bc750fc`。
- **最終HTMLの結果表示PASS** `bef058f1252f4b1390fe0fb78cf9ec53`。1200/390px各50球。越柵直前は非表示、直後はホームラン表示（新物理例はウィル・スミス、生還まで16.235秒を待たず表示）。捕球前は非表示、成立後はフライアウト表示。得点・BSO・攻守交代の先出しなし。巻き戻しで見出し・読み上げも消える。通常再生でも同じ境界を確認。
- **最終HTMLの左右・守備カメラ・可視性PASS** `526783e39eb54bcd9154e3523ad56dad`。1200/390px各8球。実2送球で、進捗約0.42→0.51、0.43→0.52の間に受け手へ切替。カメラ位置がその選手と一致し、yaw/pitchが現在のSource球へ向くことを数値確認。保持球0ピクセル、俯瞰白点、走者名、左右原画・元の打者カメラ・ゾーンを確認。
- 守備helper限定検証は、追加metadataを除く変更前後の物理結果一致、未来frame/catch/command payload未読、入力不変を確認（`work/v36-field-camera-source/check-camera-final.json`）。双方のブラウザ検証でpageerror・外部通信0。

初期FANZAWA例は旧物理の20球目で再現し、越柵から生還まで20.07165秒の表示遅延を確認した。先行表示修正の旧物理テストPASS `4517f00c7fd1481a97a098a4dcd3fc48` と当時HTMLを `work/archives/v36-before-field-registration` に保持した。旧版に対する期待された回帰FAIL、座標テストの初期fixture FAILも削除していない。

## 再生成・制限

ビルドは `node tools/browser-bridge/build-native.mjs` → `node tools/browser-bridge/build-v36.mjs <出力先>`。現browser bundle SHA `58fd175690dc2fc75791bc0d782c4f04069a7970dcc24c76f5ad6766b84fe2e7`、97入力。検証は上記check scriptsの `--registered-field` を使用する。

新物理の100試合監査、実選手能力・得能の校正、両打者の投手別切替、Native認証済み継続世界、未実装裁定、公式H/E採点、実機スマホは未完。2試合の49得点・20HRは現実の統計校正の証明ではない。元の全体計画は継続中。設定・secret・lockfile・依存・DB schemaを変更せず、push/mergeもしていない。Charter UNAPPROVED/HOLDと原証拠は保持した。
