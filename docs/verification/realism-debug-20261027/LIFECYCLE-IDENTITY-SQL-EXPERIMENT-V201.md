# Lifecycle identity候補SQLの限定比較 V201

2026-10-29 JST / `MB-20261027-REALISM-DEBUG-PLAN`。production最適化は未適用、正常Owner認証の新証明ではない。

V200で大きかったidentity候補取得について、現行scalar SQLとfresh Native batchを比較した。保存V195のTOTAL10/current calibration32で、全候補member・rowid・alias判定が一致した。実行`d859f2ed89cd4c2b89f76d7656a2b9c6`はPASS1625ms。

| cohort | scalar 1回 | batch 1回 |
| --- | ---: | ---: |
| TOTAL 10 ID | 129.5106ms | 16.4116ms |
| calibration 32 ID | 396.4468ms | 37.9468ms |

各cohortでscalar→batchの固定順・各1回。compile/import/DBopen/raw digest/storage guard/locator取得/等値検査は計測区間外。raw digest後の共有connection/page cache条件があり、順序bias・単発測定を含む。試合全体や正常getterの速度改善へ換算しない。

## 比較した境界

元のpublic typed-claim helperとNative JSON node generatorを利用し、prefix/total/view/calibration/outcome/resetの6table、source/snapshotの両mirrorを検査した。Native SQLの`matched_N`で元入力位置を保持し、decoded atomをJS identity keyにしない。元JS IDとのalias判定を保持する。rowidはTEXT化して大きい整数を保持した。

batchはTOTAL/calibrationの対応入力だけに限定し、非対応kind・empty/sparse/large等はscalarへ戻す。missingは既存のsurviving-claim検査が必要と明記し、候補取得だけで正常Owner証明を作らない。statement/proof cacheや新phase wrapperを導入していない。

初期未実装RED`1d020f3f`を保持。新9 Native SQL testsは`c3cb93d3d29e46fa8c2fe7f39dca15ef` PASS6766ms。追加のoutcome.source_json→TOTAL、reset.snapshot_json→calibrationの2 alias caseだけを`6adacef0cbfc49769e01130697a466de` PASS7391msで確認し、旧9件はskipした。最終限定strict`6da445db71564ff59837352d2575619b` PASS8281ms、driver構文`68f1a6dd75a240778dc0d066e09c68bc` PASS47ms。独立静的reviewで重大な実装欠陥なし。

## 非消費と適用範囲

初期manifestはentry import/DBopen前にwx保存。元V195はOS readonly/query_only=1で読み、全row/rowid/catalog/head、main/WAL/journal、caller transaction/savepoint/authorizer、792 Source/bundle/harness/inputの開始終了pinを保持した。正常current getter・physics・practice・TAKE・新Writerは呼んでいない。raw locatorと候補行を正常Owner認証へ昇格しない。

`normalOwnerProof:false`、`productionOptimizationAdopted:false`、`performancePass:false`を保持する。private DB/候補全record/raw/manifest/bundleは公開しない。旧FAIL/UNKNOWNは保持する。

## 次の一件

既存の認証・Source parse・正常再導出・四つの検証境界を続けたまま、既知TOTAL/calibration IDの候補取得だけをproduction内へ限定適用する。後続IDのNative row hydration errorが先頭IDの拒否より先行しないよう、batchはrowid TEXTと入力matched flagsだけを取得し、現在要求するIDの行だけをhydrateする。ROWIDの追加READをcallerが拒否する場合は元scalarへ戻し、他のNativeエラーを隠さない。

新Scopeは既存phaseの期間・DML poison/rollback/終了による破棄に従属させ、shared cacheやstatement cacheを復活させない。限定test・strict・独立review後、新Sourceで全正常result/rowid/callerの同値と測定を確認するまでは本採用の効果を主張しない。
