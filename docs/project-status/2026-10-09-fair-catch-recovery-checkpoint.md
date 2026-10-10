# 非デザイン: fair catch の復元と統合検証 — 2026-10-09

空中で正規に確保した fair ball を、架空の ground contact を加えずに既存 timeline へ投影する。独立した PlayEnd と閉じた公式 ledger が与えられ、物理 sidecar から再計算した projection / end が完全に一致し、空塁・1 out 加算・無得点の場合だけ fly_out 記録を許可する。実際の operative call、end、DB receipt を生成する変更ではない。

## Source と検証

- 復元元は公開済み `8aea9bb4999e2c18a76f7b9eb4fed572325c73e3`。未公開だった4 filesの変更は、元の bytes が失われたため意味契約から再構成した。元の `9e82d300` と同一の commit / bytes とは扱わない。
- 再構成した local commit は `3d69d1deba085d2021dd136d9fe28fa3b27d973c`、src tree は `b28aae801813b0752fb68c784b3fd21a5fbae403`。
- Node 26.10.0 の Core 3 files / 17 tests が PASS。独立 source review に blocking finding なし。保護対象18 blob は不変。
- 同じ固定 source の統合 TypeScript compiler は PASS、exit0、source / dependencies / runtime / controls の4入力群が不変、残存 process なし。実行時間23.90秒、peak RSS 1,910,520 KiB。
- 既存の一括 Native 検証5件は、BI01 / PL01 と IFN01 / BPN01 / FR01 の2 groupで継続する。各groupは独立DBと有限のresource capを使う。今回の公開時点で結果は未確定。

## 実行環境の中断

07:59 UTCに executor の識別子が変わり、旧実行の再開は拒否された。旧 scratch / shared source、private DB、log は新しい実行環境から参照できなかった。07:54に開始した2 Native groupは、完了したtest結果を確認できないため outcome UNKNOWNとして保持する。

公開済み source、lockfile、生成catalogのhash、Node26.10.0を復元して続行した。旧compiler / finite結果は当時の記録として区別する。旧Nativeの未観測結果をPASSへ読み替えず、既に完了していた重い実試合chainも記録確認のためだけには再実行しない。

## 残る接続

fair catchの標準ルールと記録条件は具体化したが、reserved same-PAのoperative call owner、producer / consumer completion census、独立したlive-end generation、公式適用への接続は引き続き実装対象である。必要な既存ルールによる機械的な接続と、未定義のproduction perception / physiology 数値は分けて扱う。

元の9領域全体は未完了。UI / design、home-PC CI、private DB / log / control packet公開は今回の対象外。Draft PRを継続する。
