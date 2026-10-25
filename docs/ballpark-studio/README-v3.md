最新の承認画像に基づく中央スコアボードとロゴの軽い遠近は [README-scoreboard.md](README-scoreboard.md)、現在の検証は [CURRENT-scoreboard.md](CURRENT-scoreboard.md)。旧の深度減光は撤回済み。

最新の作業指針（自己改善可）は [STADIUM-AUTHORING.md](STADIUM-AUTHORING.md)、壁面ロゴの遠近調整と現行証跡は [CURRENT-logo-lod.md](CURRENT-logo-lod.md)。従来の固定密度の記述は履歴として読む。

最新の立体外装・壁面素材は [README-architecture.md](README-architecture.md)、現在の証跡は [CURRENT-architecture.md](CURRENT-architecture.md)。以下の初期設定・6視点の記述は履歴。現在は8視点/ロゴ密度2〜8倍に対応。

# 球場設計室 v3 — 輪郭に沿う局所密度

最新追加は「観客席」の満員/無観客切替。[現在の検証と保存仕様](CURRENT-attendance.md)。無観客では元の座席色を表示する。

現在の観客は [満員の群衆タイル](README-crowd-tiles.md)。最新hash/検証は [CURRENT-crowd-tiles.md](CURRENT-crowd-tiles.md)。過去の個別観客表示/間引きの仕様を現在の方式へ流用しない。

最新追加の観客・LED応援は [README-crowd.md](README-crowd.md)、最新の成果物hash/receiptは [CURRENT-crowd.md](CURRENT-crowd.md)。以下の局所密度・金色線も維持している。

その後の本人指定を反映した現在の設定は [README-visual-tuning.md](README-visual-tuning.md)。細分2〜8倍、明るさ/発光、観客の密度/簡素化、7cm LED、2コマ×2周→3コマ×1周。最新hashはCURRENT-visual-tuningを使用する。

2026-10-24 JST / `MB-20261024-BALLPARK-STUDIO-3`。

成果物: `outputs/球場設計室_v3_局所密度版.html`。狼画像を芝生の素材色に合成し、その後で元と同じ円形の光点に変換する。ロゴ専用の線・矩形pixel overlayは使わない。細かな光点は狼の可視輪郭と小さな周辺に限定し、周囲の芝生にも同じ格子を適用する。

「観客席と屋根」の密度・余白・移行幅で調整できる。初期値は3倍・0.6m・0.8m。2〜4倍を選択可能。「密度範囲の外接枠」は検査用であり、実際の密度は矩形ではない。近づくにはホイールまたは拡大率を使う。遠景では同じ素材でも細部が見えにくい。

赤青金の5層観客席、内野側への張出し、開閉式屋根、右翼105m・中堅128mを維持。左翼105m・壁1.3mは未指定の暫定値で編集可能。定員12万人は設計値であり12万actorを生成しない。内野・塁・白線・コーチ箱・元PNGは固定。

本人の追加指示により、ファウルライン・打席/捕手/コーチ枠・走路線の色は、テーマ金色に白を20%混ぜた明るい金色へ変更。初期テーマ `#d6ae4d` に対して `#debe71`。位置・太さ・光点は固定。本塁・塁・投手板の素材色は維持する。テーマの金色を編集した際は線色も連動しcacheを更新する。建築テーマのない旧球場は元の白線。

JSON・履歴・明示的なブラウザ保存、6視点・回転・拡大、人間/AI共通の設定と検証を利用可能。旧v1/v2 JSONを受け入れる。旧設定に新しい密度値を暗黙で書き込まない。新しい初期例は `examples/russian-dome-v3.json`。

## 開発入口

- [描画方針と再利用方法](RENDERING-POLICY.md)、[専用指示](../../tools/ballpark-studio/AGENTS.md)、[現在の証跡](CURRENT-v3.md)。
- `node tools/ballpark-studio/cli.mjs dome <new.json>` で例を生成、`check <file.json>` で検証。
- `node tools/ballpark-studio/build.mjs <unique-label>` でHTML生成。元V114を固定し、Core不変・変更箇所の逆変換・構文・入力SHAを検証する。
- `BallparkStudio.inspect()` の `surfaceDetailRender` で領域、素材順序、光点数を確認。通常の設定変更は `setDesign()` を使う。

この段階は `DESIGN_ONLY_NOT_MATCH_CORE_ADMITTED`。新しい外壁・屋根の衝突、守備予測、HR裁定、ホームランキャッチを通常試合へ接続したものではない。通常試合への導入は別工程。見た目の最終承認は本人の確認を待つ。
