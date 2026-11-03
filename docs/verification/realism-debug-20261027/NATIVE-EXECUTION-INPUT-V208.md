# 判断・感情・実行入力区間 V208 — 中断記録

2026-10-29 JST / `MB-20261027-REALISM-DEBUG-PLAN`。V208の単独実行は完了していない。`3acc21cde7c7453e8edb64989b4615a9`は180047ms・exit124のTIMEOUT/FAILとして保持する。全goalも進行中。

保存current cut7から既存Native入口を通り、score・emotionの正常受理、World revision 0→1、cut8への正常advanceとcalibration32の完了を進めた。Owner解放後に正常current/prefix/TOTAL/cal32/physical/Worldを再読し、cut8のfullrefs付きcheckpointを保存した。その後、正常decision-cutでphysical ordinal 2→3を進め、cut9のprefix・TOTAL・view・current coverageまで到達した。最後の記録は`advance-9-current-coverage-ready`。

原seed19・play7・pitch3・outing-1と既存の導出処理を継承し、新しいRNGや`h.root`を追加していない。inputはworkOwnersに含まれず、入力自体のlifecycle advanceもない。目標境界は既存`execution-input-ready`であり、正常current cut9＋null AFTER＋正常current inputの認証である。

## 中断後の実状態

Root実行handle89063のterminalを確認後、保存したNative PID11668と直接子が存在しないことをCIMで確認した。プロセス観測の途切れを理由に再起動していない。

読み取り専用のproduction readerによるinventory `ea8ad2cfdc5b4047b695d78fb1801c61`はPASS6452ms。正常current `physical-fixture:cut9:view`とWorld1を認証し、cut9 calibrationは0件、inputも0件だった。32件は単一INSERT・単一Owner transactionで受理されるため、中断時の未commit部分は残っていない。1〜31件の部分受理状態は検出されていない。inventory前後で失敗DBのmain/WAL/journalは不変で、親Source・bundle・harness/inputの現在pinも一致した。

これを元runのPASSや終了時pin証明へ昇格させない。元TIMEOUT、最終未実行工程、元runの終了時観測不足は保持する。private DB・raw・manifest・bundleは公開しない。

## 復旧方針

V209はこの失敗DBの新owned backupから再開する。既存prefix・TOTAL・view・score・emotion・decision-cutを再受理せず、元と同じSource factoryで正規calibration32を受理し、正常inputだけを追加する。すでに32件あれば正常再読と期待Source全一致だけを行い、1〜31件なら既存`partial accepted set cannot be repaired` guardを維持して拒否する。

復旧自身の目標差分はcalibration32＋input1の33行だけ、head/CAS/schema変更0。別途、V208開始前の保存digestと復旧後を比較して、元の全区間の94行・2件のhead CAS・emotion2tableと5autoindex・全旧行保持を検証する。これは元V208 runの成否とは別の証拠である。

## 実行前の検証

最終strict `313b78decb75440c82018975779d932b` PASS9078ms、import-only `652b0d2c48a34ed1bac7f3bbc71f19a7` PASS7453ms（actual skip）、既存5 Source不変 `ea78ccfb5b4c4758b133e871fec4cad8` PASS93ms、driver構文 `757a40a0c9a94bc4a1afd98aa556163e` PASS77ms。初回strict `991d1605`のunion型診断は、正常in-flight capabilityの明示guardで修正し、原FAILを保持した。

Source・driverを独立reviewし、最終emitが入力受理前のfalseを継承する不整合だけを修正した。advance直後checkpointのfalseはその時点の事実として保持し、最終正常入力認証済みemitだけtrueにした。最終Source SHAはentry `9a0ed6bea17e5f7b50bd4000e2aeece8e014fe2af719ae0815dcc16d8430eeb0`、wrapper `5fd565c7764e2fc22834ea09f1fa311c53c7d636ecc14aaf4785ecf07559e2e9`、driver `372fc3ca625acba4419e4fb9f6ca6d325e381daef2bb1e8e840f2685d96d2642`。

この区間のOwner検証コストは継続課題であり、180秒到達を試合全体の性能値や高速化完了として扱わない。完了prefixの再実行で中断を隠さない。
