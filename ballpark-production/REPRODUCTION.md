# 検証・再ビルド

リポジトリのルートから実行する。Node.js 20以降、今回確認したNode.jsは24.19.0。OS固有の制作PCパスや別の試合フォルダーは不要。表示にはCanvas対応ブラウザが必要。

## 完成HTMLをそのまま使う

```sh
node ballpark-production/production.mjs verify
node ballpark-production/production.mjs extract
```

`ballpark-production/dist/球場設計室_v3_局所密度版.html` を開く。完成HTMLはgzipに入っており、解凍前後のSHA-256を確認して復元する。Node以外の依存追加は不要。初期値は芝生ロゴ0.8倍だが、同じブラウザの保存済み設定は優先される。

採用HTMLのSHA-256:

`af2c00aa1cd56e596027af42eb3d547391a21322c8a9df75638194d907c8c1df`

## 単体検証

```sh
node ballpark-production/production.mjs test
```

制作部の `*.test.mjs` だけをNode標準test runnerで実行する。44件。別担当の試合Core全体のテストを実行したという意味ではない。

## ソースから再制作する

```sh
npm --prefix ballpark-production ci --no-audit --no-fund
node ballpark-production/production.mjs build
```

esbuildは本プロジェクトで既に使われる0.21.5を制作部内で固定。root packageとlockfileは変更しない。`production.mjs` はソースを `ballpark-production/.build/work/mini-baseball` へコピーし、凍結V114を `.build/outputs` に復元して、**元のbuild.mjsを変更せず**実行する。元buildの `../../outputs` をこの作業領域内へ閉じ込め、他の試合HTMLを上書きしない。結果とbuild-reportをdistへ書く。

制作部の公開検証では、このbuildから採用HTMLと**同じSHA-256**を再現できた。Core一致、描画script1つの変更、描画パッチの完全逆変換、JS構文、入力ファイル不変もbuild内で確認する。将来esbuildやソースを更新すればhashは変わり得るため、同一hashを一般保証しない。

制作部のsource/evidenceには限定したGit属性 `-text` を設定し、OSの自動改行変換でbyte pinが壊れないようにする。共通の案内4文書だけはLFで保存する。通常試合のsourceや他の文書にはこの属性を適用しない。

既存distのHTMLが前回生成物または採用版のhashと違えば、手編集を保護して停止する。必要な手編集は別名保存したうえで明示的に復旧する。失敗を避けるための自動削除・自動リセットはしない。

## ブラウザ確認

追加の任意検証。`playwright-core` を利用可能にし、Chromeの実行ファイルを指定する。

```sh
node ballpark-production/smoke-browser.mjs
```

`PLAYWRIGHT_MODULE` で既存Playwrightモジュールの絶対パス、`CHROME_PATH` でChrome実行ファイルのパスを指定できる。未指定なら通常の `playwright-core` 解決とWindows版Chromeの標準位置を使う。ブラウザ自体をこのコマンドでダウンロードしない。検証結果・画像はgit対象外のvalidationへ保存する。

旧check/auditスクリプトも同梱するが、一部は制作当時のv1/v2や過去の比較HTML・receiptを要求する。**歴史的な全検証を現在のpackageだけで再実行できるとは主張しない。** 現在の再現入口は上記のverify/test/build/extract/smoke-browser。元のprivate logを偽の再実行結果で置き換えない。

## 設定JSON

```sh
node tools/ballpark-studio/cli.mjs dome ballpark-production/dist/tambov.json
node tools/ballpark-studio/cli.mjs check ballpark-production/dist/tambov.json
```

現行プリセットから0.8倍のJSONを生成できる。examples内の過去JSONは制作履歴であり、初期値が古いものもそのまま残す。取り込み時は旧値を本人の入力として保持する。
