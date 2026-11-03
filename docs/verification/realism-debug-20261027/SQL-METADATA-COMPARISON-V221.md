# SQL集約候補の比較と不採用

2026-10-30 JST。ユーザー向け機能へ作業を戻す前に、CPU計測から選んだ限定SQL案を1組だけ比較した。**改善を確認できず不採用とし、productionを変更前の全bytesへ戻した。追加の内部最適化・再計測は行わない。**

## 比較対象と条件

対象は九観測後current22の通常getter。`SamePlateAppearanceLifecycleClaimGuard.ts`の3 typed paths × source / snapshotの2 mirrorsという6 SQLを、既存nodesとpath tag付き`UNION ALL`の2 SQLへまとめる案だけを検証した。cache、Reader省略、全Source hash / alias / snapshot検査の削減は0。

OLDとNEWは同じV217保存factsを使う独立fresh processとfresh paired readonly copy。通常getter各1回の区間を`performance.now`で測定し、import・DB open・digestは区間外。InspectorとSQL instrumentationは使っていない。OLDの実receipt・log SHA・endpinsをNEWの前提にし、NEWのSource例外は当該1fileのliteral reverse全文一致に限定した。比較probeと新patchの意味はAstraが別々の新しい論点として独立reviewした。

| 条件 | getter区間 | 実command全体 | receipt |
| --- | ---: | ---: | --- |
| OLD | 11,889.9994ms | 19,858ms | `657b6b5f21b14ab78695baa7b68b105a` PASS |
| NEW | 24,149.8342ms | 38,702ms | `c77c225940db46aa91c2698e3858d06a` PASS |

両legともgetter1回、保存current全値lossless一致、同一logical input、全rowid / schema / head、元DB非open、元とcopyのdata、Source / parent / harnessのendpinsを確認した。NEW / OLDは約2.0311倍だった。この1組で一般的な遅延原因・全試合性能は結論しないが、採用する改善証拠は無い。`performancePass:false`を保持する。良い値を得るための再実行は0。

## 回帰と復旧

旧6 SQLに対する期待RED `aca186c6609f4356bc8523d8d27e4cb5` を保持した。新SQLはdecoded duplicate、non-text除外、path-major/source→snapshot順、両mirror、列無しSQL0、hash不正、global alias、正常Reader等を確認した。型注釈修正後の関連29 tests `1b060834abb34034882f88beceadcb20` PASS、focused strict `81bade89c3d04787b7c12b1a9f97be70` PASS55483ms。型FAIL `66e860e6`も保持する。正確性PASSと性能採用は別判定にした。

productionは13534 bytes / SHA-256 `5fd1bd15fad12196d58cdc6e51d5968a87af982041f01f88092a794b83f45496` のbaselineに全bytes一致で復旧した。再試験は、同一bytesの既存成功を再利用して行っていない。試作production `de7f7bce…` と試作regression `d8efbd95…` は、private `work/native-lifecycle-claim-metadata-v221-baseline/` の `*.rejected-source.txt` と復旧記録へ保存した。不採用の2 SQLを要求する未追跡testだけを通常srcから外し、既存testは変更していない。

比較probe3filesは検証道具として保持する。過去NEWのPASSは当時の試作Sourceに対するもので、現在の採用Sourceや性能改善の証拠へ書き換えない。原DB / private output / logs / source archivesは公開しない。

## 次の利用機能

手動3方向＋おまかせ・連続打席・記録表示欄を、既存機能を作り直さず最新Maker検証HTMLへ統合する。全受入と最終3HTML配送は別途未完として保持する。
