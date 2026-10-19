# OpenBiomechanics 実測バット軌道ライブラリー v1

対象は身体フォームではなく、実測された手元基準点と芯から作るバット軸の接触前後の短い区間である。原データは Driveline Baseball / OpenBiomechanics の `dataset-v1`、commit `44b98dae05cceb016f080ab39d105c85b8639084`。公開された optical landmark CSV を読み、raw C3D binary の復元とは主張しない。

## 収録範囲

- 索引677試行のうち、完全な673試行（右495／左178、被験者98人）。673人の別フォームという意味ではない。
- 接触前0.30秒～後0.08秒の原137標本ずつ、計92,201標本。名目360Hzから時刻を再生成せず、元の小数秒を正確なmicrosecond tickへ変換する。
- 欠損5行を持つ4試行 `203_3 / 342_1 / 342_2 / 67_2` は全試行を除外。穴埋めや左右ミラーは行わない。
- 芯と手元は原測定値。ノブ／先端は既存Coreの公称長・公開オフセットによる剛体推定で、軸まわり位相は未測定のためminimum-rotation transportを宣言する。
- 手元の最大残差15.7574mm、剛体長の最大誤差約6.67e-16m。接触結果・身体到達範囲・筋力・Nativeの採用をこのライブラリーだけでは証明しない。
- 旧12軌道の全runtimeキー／metaと自動選択順は完全一致。`defaultSelection: true`はその12本のみ。残り661本は明示選択時の候補であり、自動選択へ混入しない。

## ファイルとAPI

- `docs/demos/measured-bat-library-v1.json`: compact JSON、29,835,543bytes、SHA256 `b53a8d687f663a5578315120445de1407fb82efec594cde27cc313c1ea5b106a`。
- `tools/browser-bridge/import-openbiomechanics-library.mjs`: pinned CSV／metadata／公開model／旧12のwitnessを照合し、新しいライブラリーだけを出力。旧importerと旧`measured-bat-motions.json`は変更しない。
- `tools/browser-bridge/measured-bat-library-v1.js`: Nodeとブラウザー共通のIIFE。`globalThis.KneekuraMeasuredBatLibrary.decode(jsonTextOrSameRealmPlainObject)`は旧互換の`schemaVersion: 2` referenceDataを返す。
- decoderの出力は`.clips`673件、`.index`677件、`.licenseText`、`.clock`、`.coordinateRegistration`等。各clipの`.frames`、`.measurements`を展開する。出力はdeep freeze済み、caller入力は変更しない。
- 20列のsample rowは`tick / gripXYZ / tipXYZ / quaternionWXYZ / measuredSweetXYZ / centralDifferenceSweetVelocityXYZ / measuredHandXYZ`。数値の丸め・量子化はしない。
- 原CSV行の全文は各clipへ重複収録しない。元ファイルSHA・試行別の元行SHA・1始まりのCSVレコード行範囲で原本へ戻れる。license全文・公開元・使用上の制限は出力内に保持する。
- strict decoderはgetter・prototype付きobject・sparse array・非有限値・不正な時刻／姿勢／長さ／元資料ID・自動選択の変更を拒否する。元資料SHAの真正照合はbuild／独立source auditの責務であり、ブラウザー内に暗号学的認証機能を偽装しない。

## 実行証拠

1. Import最終PASS 3.139秒: `MB-20261019-V68-LIBRARY-IMPORT_1d3a7447acec4e6996c6d0aeb3bba0f1.json`。初回PASS `cf6f2e16...`は自動選択順の明示固定前の記録として保持。
2. 独立Python source audit PASS 8.764秒: `MB-20261019-V68-LIBRARY-SOURCE_5bbc2079f2994a2bb4b5a10ca5d49ee3.json`。ZIP内の元`landmarks.csv`とselected CSVの全469,377行・必要9列を直接照合。673区間の時刻・hand／sweet・元行SHA・速度・四元数軸・剛体長・残差を検査。結果は`source-audit.json`。
3. Node＋実Chrome decoder PASS 12.796秒: `MB-20261019-V68-LIBRARY-DECODE_d07dcaf1f22543de9d9dc165c0344584.json`。全673軌道のmanifest hash／旧12完全一致、plain object／JSON、deep freeze、11種類の不正libraryとgetter等の拒否を検査。Chrome1200px／390pxで92,201標本の読込と旧12一致、外部通信0、page error0。結果は`decoder-check.json`。390pxは実スマートフォンの証明ではない。

再現コマンド（repository root）:

```powershell
node tools/browser-bridge/import-openbiomechanics-library.mjs 'C:/Users/genki/Documents/Codex/2026-10-15/new-chat/outputs/参考データ/openbiomechanics'
py -3.10 -X utf8 -B tools/browser-bridge/check-measured-bat-library-source.py 'C:/Users/genki/Documents/Codex/2026-10-15/new-chat/outputs/参考データ/openbiomechanics'
node tools/browser-bridge/check-measured-bat-library.mjs
```

`build-manifest.json`は全clipのframe／measurement SHAと元行provenanceを含む。この工程ではメーカーUI、選手ロスター、LivePitch、Core、dist、依存関係、設定、lockfileを変更していない。通常試合・メーカーとの接続および弾道変形の効果は各後続工程で検証する。
