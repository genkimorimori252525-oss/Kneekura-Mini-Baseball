# v61 見逃しの同期と絶対選球眼

見逃した球が捕球された後にカメラが遅れて向き直す原因は、捕球後に投球の圧縮/pursuitが外れて目標角が変わり、さらに300ms後の自動戻しが作動することだった。旧v60で捕球後0.055906radの後追いを再現した。

## 変更内容

見逃すと判断した後の注視は現在の観測済み投球prefixへ同期する。捕球が確認できたSource時刻まで連続的に動かし、その姿勢を保持する。角度を飛ばさず、未来のsecureTickや結果を先読みしない。次球では新しく追従する。既存の前方/俯角制限は保ち、ミットの奥まで覗き込む動作へ戻さない。

選球眼 `physical.plateVision` は1〜100の絶対値。設定値は選球眼45の基準とし、1→45→100で以下の点を区分線形補間する。上限/下限はユーザー指定、低側は極端な不追従を避ける表現係数。

| 選球眼 | 初期設定時の追従率 | 追わずに許す角度 |
|---|---:|---:|
| 1 | 0.13 | 0.04rad |
| 45 | 0.26 | 0.02rad |
| 100 | 0.70 | 0.00rad |

従来のミート由来の有限pursuitは維持し、旧vision寄与を45相当に固定して新選球眼と二重適用しない。A従来モードは旧カメラの比較用で、能力強化と見逃し同期は有効な調整モードへ適用する。調整室は基準45の欄名と、実際の選手/実効追従率/許容角を表示する。

旧20人は公開選球眼42〜96を持つ一方、判断誤差SIは全員.025mだった。全員を45へ同化せず、旧個人公開値を一度明示plateVisionへ移行する。リーグ平均は使わず、以後は明示値を保存する。初期SIとsourceIDは保持。公開編集時は既存判断誤差も連動し、詳細判断誤差の編集では古い明示値を再算出する。無変更はbyteを保持し、旧ゼロ誤差も無変更なら保持する。参照資料のない旧入力には固定SI式（.025m→45）を使う。

メーカーの公開選球眼はmin1/max100、リーグ比較も絶対値表示。ほかの能力の比較方式は維持する。初期値は以前の作者設定の継承で、実在選手の実測校正ではない。plateVision単独に隠れた物理補正はなく、世界の球/バット/裁定は既存SIに従う。

通常HTMLへ旧能力JSONを入れると同じ移行を実行する。新Coreはabsolute fieldと公開APIの追加で再bundleした。旧v54〜v60 CoreのSHAだけを明示互換リストに入れ、同じSIで新Coreへsessionを再実行する。任意Coreや別schemaを受け入れない。v60名前重なり/球前面/サイズ/impact調整、投手100〜250ms、4px/投球22ms/その他55msは継承する。

## 検証

- TAKE-VISION-RED9b0efa5f: 旧v60の捕球後0.055906radをFAILで再現。新TAKE-VISION55fc1e85 PASS5.360秒。左右×選球眼1/45/100、1ms刻み、捕球境界±1µs、捕球後完全停止、現prefix同期、能力単調性、未来poison/seek/rewind。実12球中9見逃し・27実捕球、Source/バット不変。A旧式とB45のスイング/バント/field姿勢はv60完全一致。
- CORE-REGRESSIONfdbfad85 PASS58.063秒。6ファイル66件。公開/物理roster/隠れAI/打撃能力/得能と、Coreの規定試合進行を確認。通常HTMLの新9回完走を意味しない。
- CORE-BUILD5bbc7e04 PASS.360秒、MAKER-BUILD35346fc0 PASS.266秒。新Core SHA `390eb00f118ef6fae5fbdde9ea8bdd66d497ed39c9a2a3f6cbf36f917b39af7a`、113入力。メーカー79入力。
- VISION-MIGRATIONf1b58d8a PASS.094秒。20人の42〜96と初期SI/sourceID不変。最初のFAILb8236fe1はビルド検査のNode/VM object realm不一致。保護検査を消さず、JSONを同じVM内でparseして修正した。
- BUILD97a8f688 PASS.204秒、CADENCEe62ae2e0 PASS8.219秒。通常と調整室の同一内包、投球22/他55ms・60Hz手動時計の18/45とloopを確認。
- BROWSER62563dcf PASS32.389秒。1200/390pxで同一6球の物理/裁定/バットをv60と比較（追加plateVision metadataは区別）。18実見逃しからR/L×curve/fastball4例、捕球後250/700msの角度変化0、捕球前の注視を確認。grade1/45/100の実効値、メーカー全20人と5リーグ絶対値、旧JSON移行のSI/sourceID維持→実通常HTMLimport、v60設定/session→新session再読、impact3欄と名前/球表示を確認。例外/外部通信0、モバイル横溢れ0。
- PACKAGEc852a8b7 PASS1.937秒。Native113/Maker79 raw入力、5helper/driver/template/roster/reference、3HTML、旧v54〜v60配布SHAを照合。

通常 `a97893a7c6206b2cd7b7dc6aa1478e6d65afb26893df25bd4b01efca072df5bd`、調整室 `e858c4f76a1c7ed5258533402b1ca3edeeaffc40352e6d5085c69b73676a6f75`、メーカー `754029e7bca64a073dc0003dad8551560bd537447d68c90f98d9d3955a4ac5ba`。

[ブラウザ記録](../verification/releases/v61/presentation/presentation-check.json)、[配布照合](../verification/releases/v61/release-check.json)。実コマンドと原logは `docs/ai-continuity/verification-receipts/MB-20261019-V61-*`。

## 変更した主なファイル

- `LivePhysicalRosterV1.ts` / `LivePublicAbilitiesV1.ts` / `LiveBaseballMatchV1.ts` と両browser export、関連2テスト: absolute grade/validation/migration/編集/preview。
- `docs/demos/baseball-maker-ui.mjs` / `.html`: 移行、絶対表記、詳細編集の再計算。
- `live-camera-tuning-batter-view-v61.js` / `check-camera-take-vision-v61.mjs`: 同期見逃しと45基準能力。
- `camera-workbench-v61.js` / `.html`、`build-v61.mjs`、`prepare-v61-vision-roster.mjs`、`package-v61.py`、`check-v61-presentation.mjs`: 比較・HTMLとデータ生成・統合検証。

元全計画、Native認証連続世界/公式裁定・得能の未接続/物理詳細/AI残件/統計校正/100試合/実機の未達、原FAIL/UNKNOWN/CharterHOLDを保持する。今回の完了は見逃し/選球眼接続の範囲。保存先は以下へ記録する。

## GitHub保存

製品コミット `9e77fd0d8954c5e931d6d79ae1eb007fe8b3c538` を既存ブランチ/Draft PR380へ保存。STAGINGb754b58a PASS1.016秒と最終追加分の照合で80ファイルのstage raw byte一致、credential pattern0、非log whitespaceを確認。PUBLICATION83314cc4 PASS4.125秒でremote/PR head・Draft OPEN・15件の公開raw byte一致を確認した。[公開記録](../verification/releases/v61/publication.json)。後続の記録のみのコミットは製品byteを変更せず、mainは未マージ。
