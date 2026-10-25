# 公開版の入口

最新の採用状態・技術・再現コマンドは [球場制作部](../../ballpark-production/README.md)。以下は初版からの制作記録として保持する。古い既定値/視点数は現行仕様ではない。

# 球場設計室 v1

現行の開発入口は [v3・輪郭に沿う局所密度](README-v3.md)。以下はv1の仕様・証跡。現在の `build.mjs` は別名のv3を生成する。保存済みv1/v2 HTMLは変更していない。

タスク: `MB-20261024-BALLPARK-STUDIO-1` / 2026-10-24 JST。

`outputs/球場設計室_v1.html` をブラウザで開く。配信サーバーや外部サービスへの接続は不要。現行V114の描画エンジンを内包し、原画・4pxの表現・色を再利用する。

## 編集と保存

1. 初期画面は現行の円形球場。現行の寸法を規則値へ自動変更しない。新設MLB基準に満たない寸法は警告として示す。
2. 左翼・左中間・中堅・右中間・右翼の距離と壁高を編集する。下の設計図の点もドラッグできる。
3. 「壁の曲がり角を追加」で点を増やす。追加した点は角度も編集・削除できる。5つの基準点の角度は固定。
4. ファウル側の広さ・バックネット・外野の土の幅も編集可能。内野の白線・塁・投手板・打席は共通固定。
5. 「取り消す」「やり直す」は最大80操作。エラー入力はその場に残し、プレビューは直前の有効な形を維持する。エラーがある間は保存できない。
6. JSON保存は持ち運び用。ブラウザ保存は明示操作のみで、同じファイルとブラウザの次回起動時に復帰する。file URLの保存領域はブラウザに依存するため、長期保存にはJSONを使う。

視点選択、右ドラッグ、ホイール拡大はカメラだけを変える。通常試合の自動再生は停止し、操作がない間の再描画ループを追加しない。

## 規則の扱い

根拠は [MLB 2026 Official Baseball Rules](https://mktg.mlbstatic.com/mlb/official-information/2026-official-baseball-rules.pdf) Rule 2.01–2.04。

| 区分 | 設計室の扱い |
|---|---|
| 塁間90ft、投手板前縁まで60ft6in、本塁・打席等 | 既存の固定形状を保持。JSONからの変更も拒否 |
| 外野ファウル線 | 開き90°と方向を固定。外周までの線の長さだけ追従 |
| 一般のフェア領域内の障害物距離250ft | 点間の壁も含め76.2m未満を拒否 |
| 両翼320ft・中堅400ftの一般推奨 | 推奨と必須条件を区別して警告 |
| MLB新設球場の両翼325ft・中堅400ft | 別の検証モードで99.06m / 121.92mを確認 |
| バックネット等まで60ft | 推奨値として警告。球場全体の認可を保証しない |
| フェンス高0〜30m、外野距離上限220m | このツールの作業範囲。公式の高さ上限という意味ではない |

NPB独自の最新規定・既存球場の例外を包括認証するものではない。内野の芝・土には追加制約があるため、今回その形状は編集しない。

## AIによる編集

人間の通常編集と同じ検証器を使う。AI専用の検証回避経路は設けない。

```js
const current = BallparkStudio.inspect();
const next = structuredClone(current.design);
next.mode = 'editable';
next.fencePoints.find(p => p.id === 'LF').heightMeters = 11;
const result = BallparkStudio.setDesign(next); // {ok, errors?}
// result.okを確認し、renderedRevision === revisionまで描画を待つ
BallparkStudio.measure(-45); // 本塁から左翼の壁までの距離・壁高
BallparkStudio.updatePoint('RF', {distanceMeters: 104});
BallparkStudio.undo();
const json = BallparkStudio.exportJSON();
```

`inspect()` には入力、検証、実際に使用した外周、固定部分、カメラ、直近80操作、ソースSHAが含まれる。`setDesign()` は不正JSONを現在の設計へ適用しない。`updatePoint()` は人間の入力と同じく未確定入力を保持できるので、返り値の `validation.ok` も確認する。

CLIはリポジトリのルートから実行する。

```powershell
node tools/ballpark-studio/cli.mjs example my-park.json
node tools/ballpark-studio/cli.mjs check my-park.json
node tools/ballpark-studio/cli.mjs reference original-park.json
```

`check` は有効なら終了0、不正設計またはJSONの読込失敗なら終了1。`examples/` に円形基準と左右対称の寸法例を置く。

## データと実装の境界

- schema: `kneekura_ballpark_design_v1`。距離・壁高はm、角度は度。原点は本塁、+zは中堅、+xは右翼、左翼−45°・中堅0°・右翼+45°。
- 外周の追加点は極角順に並べた直線壁。距離は角度に対する単純補間でなく、放射線と実際の壁線分の交点。壁高はその壁線分上で補間する。
- 基準円形は元の中心 `(0,37.5)`、半径72.5mをそのまま使用。編集へ移ると頂点をつなぐ形状になる。現行円に戻す操作は取り消せる。
- `model.mjs` が唯一の設計用geometry/query。プレビューの地面の端・壁・設計図は同じgeometryを使う。
- `renderer-patch.mjs` は凍結V114のコピーだけへ外周queryを追加。元HTMLは変更しない。Coreのスクリプトはバイト同一を検査する。
- `build.mjs` は入力SHAと基準HTMLのSHAを確認し、既存の設計室に外部編集があれば上書きを拒否する。独自編集はtools側へ反映してからビルドする。

**通常試合の衝突・守備経路・ホームラン裁定への接続は未実装。** `DESIGN_ONLY_NOT_MATCH_CORE_ADMITTED` をAPI・JSON検査・ビルド記録に持つ。非対称壁を現行の円形Coreへ無断で近似して渡さない。保存JSONは通常試合用の選手JSONとは別形式。

## 検証・再生成・復旧

```powershell
node --test tools/ballpark-studio/model.test.mjs
node tools/ballpark-studio/build.mjs unique-build-label
node tools/ballpark-studio/check-browser.mjs unique-browser-label
```

ビルドは既存esbuildを使用。ブラウザ検査はこの環境のChromeとバンドル済みplaywright-coreを明示参照する。別環境では `check-browser.mjs` の実行環境パスを指定し直す必要がある。ツール本体にこのパス依存はない。

検証記録は `evidence/` とCCGの固有task-ID receiptへ保存する。過去FAILは削除せず、原因と再検証を `CURRENT.md` に記録する。通常試合の他タスクのCURRENTは上書きしない。

復旧は設計室を閉じて元のV114を開く。球場設定は通常試合の選手能力・球場・物理へ書き込まない。ブラウザ保存のリセットは現行球場へ戻して「ブラウザに保存」、または保存領域の管理から行う。JSONを先に退避する。
