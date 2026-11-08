# 打つ前の入力条件と実行後の記録の一致

2026-10-30 JST。正常な過去のprecommit入力を再構成し、実行後の記録から得るdomain / provenanceと全値一致する共通処理を実装・検証した。新しい現在判断や接触を受理したものではない。

## 変更

新`SpinAimObservedDomainConditionsV231.ts`へ、commitment / resolutionを要求しない条件型と共通data-only導出を追加した。binding / model / profile / pair / transform / 座標・geometry、clock / latency、正常capture / delivery / predictionと校正値を使う。個別参照はprovenance、共有条件はIEEE lossless hashを維持する。

posttrialは正常recordを検査してadapterから委譲し、precommitは既存V226の正常input / action / assessment → prediction → delivery / capture / calibrationを使う。未発生のcommitmentを組み立てない。静的actualFlightParametersはdomain照合に限定し、照準・crossingは配達済みforecastだけを使う。実ballの位置・速度・回転・未来軌道は条件導出へ追加していない。

既存V228 inventoryの変更はimportとdomain本体移動のみ。`readCensusV228`以後は変更せず、V226の公開返値・keysも不変。編集前worktree / Git親を別保存し、CRLFを明示した差分・逆変換で旧全bytesと移動本文を照合した。

## 検証

- 関連tests `f387c1b0`、Source型検査 `d75fe504`、tools entryを直接含む型検査 `3cb1165c`、bundle `5eea8b48`、driver構文 `a8257988` PASS。Source・seamの独立SolレビューReady。
- 実readonly `8e46612ac37546b8aa68bc56cda82479` PASS / 119,312ms。commandは `node tools/verification/check-spin-aim-precommit-domain-v231.mjs work/spin-aim-precommit-domain-v231-01`。
- 正常historical cut9 / input / view / action / Actorを経由し、decisionTick33535160のprecommit条件と、正常posttrial条件・provenanceが全値一致。正常不足評価は引き続き1試行・applicable=false。
- 原V230 DB、原V226 DBと保持済み8 DBの全10 DBは開かず、全files不変。所有コピーの全row / rowid / schema / head / data、caller q1 / savepoint / authorizer、Source / bundle / artifact終了pinsを保持。
- 新writes / practice / contact / qualificationは0。元の4分接触試行・旧6練習は再実行していない。

log SHA `20213bb75bc0e9550fd38f1f22870355598b60f1d184515576d2ba7665d6a7f2`、report SHA `8fb65f5d1aff2f8aa453b77b9e33b336f5006b3a5d295e268612340c87817e8f`。119.312秒は複数の正常原本を再認証するこのgateだけの時間で、試合速度や高速化の主張ではない。

## 残件・失敗の保存

新qualified consumerを導入する前に、資格の閉集合認証がその資格を使う後続commitmentへ再帰しないmembership境界を接続する。V232は別単位。通常AI・新しい真反復・4技術・Gold・全試合・完成3HTMLの受入は未完。

初期RED `d91b6c06`、型修正前 `d7557070`、並行編集中V232 module欠落による全体型検査 `477a5144` FAILを保持。repo tsconfigはtoolsを含まないため、tools entryは直接型検査した。改行についての一時的な「全体LF化」という報告はbyte計測で撤回し、old / current / seamのCRLFを確認した。未確認内容をbytes exactの根拠にしない。
