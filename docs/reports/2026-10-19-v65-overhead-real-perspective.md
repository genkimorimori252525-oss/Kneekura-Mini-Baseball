# v65 俯瞰の高さ強調を実際の遠近差へ修正

## 人間の訂正と原因

ユーザーの「高さに応じて拡大し、その倍率が現実の1.5倍」という回答により、v64で回答前の仮定として実装した「20mで最大指定倍率」の意味を置き換えた。v64の成果物・原証拠・未回答時の仮定は履歴として保持する。

現在の俯瞰カメラで、現在の球と同じx/zの地面球（中心y=.0366m）を投影する。最小白点へ補う前の光学直径の比を使うため、1.25pxの可視マーカーで失われていた高さの遠近差も表示へ反映できる。高さ20mなどの固定基準や最大1.5倍の上限は設けない。同じ高さでもカメラの位置・角度や球のx/zによって変化量が異なる。

## 計算と互換性

`ballDisplay.overheadHeightEmphasis` は初期値1、範囲1〜8を維持する。

```text
1の場合: 従来の描画直径をそのまま使う
1より大きい場合:
  r = max(1, 現在球の光学直径 / 同じx/zの地面球の光学直径)
  地面基準サイズ = 従来と同じ地面球の表示直径（必要なら最小白点を適用）
  描画直径 = 地面基準サイズ × [1 + 指定値 × (r − 1)] × 既存の俯瞰全体倍率
```

例えば現実の投影で地面比1.2になる高さなら、設定1.5では地面比1.3へ強調する。ゴロは同じサイズ。既存の全体倍率とは独立する。投影のnear planeを越えた球は従来どおり描かず、地面の投影が得られない場合は従来表示を使う。

初期値1は従来表示を厳密に保つ互換モードである。1より大きくすると実遠近差を表示へ復元するため、最小白点に抑制されていた場面では1付近に表示差が生じる。これを連続補正して「1.5なのに実差の0.5倍」へ変えることはしない。通常UIと調整室に値の意味を明記した。旧JSONの省略値は1、明示した値は最新の意味で読む。調整室の自動保存はv65で分離する。

球の物理、位置、姿勢、回転、裁定、AI、能力値、打者／投手カメラ、バットを変更しない。現在の観測位置とカメラだけを読み、未来の軌道や予測着地点を参照しない。保持球の非表示、4px格子、投球22ms／他55ms、名前より前への球描画を維持する。

## 検証と対象ファイル

`build-v65.mjs`、`live-ball-display-controls-v65.js`、調整室v65のdriver／template、焦点を限定したブラウザ検証と配布スクリプト、通常HTML／調整室HTMLを追加。v64以前の凍結成果物とhelperは保持する。新依存・lock・secret・設定ファイル・DB・Coreソースの変更はない。

実行記録は `docs/ai-continuity/verification-receipts/MB-20261019-V65-*` と [配布検証](../verification/releases/v65/release-check.json) に保存する。結果は以下に記録する。今回の変更だけを元の全計画や100試合監査・実機検証の完了と扱わない。原FAIL／UNKNOWN／Charter未承認HOLD、ユーザーのAGENTS変更を保持する。

## 最終実行結果

- MB-20261019-V65-BROWSER: PASS、60.468秒。[実行receipt](../ai-continuity/verification-receipts/MB-20261019-V65-BROWSER_6b6d05c7d02e4050b94b530c35586cc4.json)。
- MB-20261019-V65-BUILD: PASS、0.405秒。[実行receipt](../ai-continuity/verification-receipts/MB-20261019-V65-BUILD_2e09ba86b04b49dab1210bc65d46a359.json)。
- MB-20261019-V65-CADENCE: PASS、8.985秒。[実行receipt](../ai-continuity/verification-receipts/MB-20261019-V65-CADENCE_be369e707eda4a878a0f373bd2176ea7.json)。
- MB-20261019-V65-PACKAGE: PASS、8.422秒。[実行receipt](../ai-continuity/verification-receipts/MB-20261019-V65-PACKAGE_4f8b2d9f77d64d49b1a2aa012bec3512.json)。

実v63の同じ6球Source／bat・全5視点×3場面の初期値pixels一致、ground不変、31投影probe（20→40m非飽和、同じ高さでxz／カメラ高による比の変化、水平cameraで高さ変化なし、光学サイズがfloorを超える場合、near-plane／above-eye）、全体倍率独立、他視点不変、保持球非表示、設定UI／旧新JSON／session／原子的拒否を1200px／390pxでPASS。実高球y16.270759mの光学比1.12855293を設定1.5で地面比1.192829395へ強調。Source SHA `2f939a684f2bad6fe5f86c40960a2871f4ed88618feca638c378ed6a20ce9829` は不変。

通常HTML SHA `99df7e9275f342f10b1febdf3d06df06b3817cda01928fbb844f28259ab8dd19`、調整室SHA `731f8b10648bb1a2e5e36e714ea70eb3ed41a6a77a379e77557852af3d07d95e`。Native114入力のraw照合とv54〜v64成果物の保持もPASS。新たなTypeScript／9回完走／100試合・実機の検証を実行したとは主張しない。

継続監査は従来からの `CHARTER_UNAPPROVED/HOLD` によりexit1。元の未承認記録を保持し、自動承認へ変換しない。製品試験のPASSとは別に扱う。
