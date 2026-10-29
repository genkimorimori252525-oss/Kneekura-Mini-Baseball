# 保存済みlaunch前状態の正常認証 V197

2026-10-29 JST / `MB-20261027-REALISM-DEBUG-PLAN`。全goalは進行中。

旧V193-01の`launch-right-ready`保存DBは、元action viewの正常current/next-pitch条件を保っていた。readonly `77ead172df0e42ffa2d77fddb269e0ab`はPASS3421ms。6practiceや2TAKEを作り直さず、prospective field入力を渡す前提が残ることを確認した。field校正/launchの受理そのものはこの工程で試していない。

## 正常認証した境界

- Actor、同Actor/Person/repertoire/dayに結び付く独立BACKSPIN/TOPSPIN2資格、current modelを正常APIで認証。
- pitch3の元action/posture/intentとbody10件を正常認証。
- physical head locatorは0。これだけで未launchとはせず、元viewのcurrent coverageとnext-pitch censusが正常readyになることを併せて確認した。
- 元viewは`physical-fixture:cut0:view`、nextPitchOrdinal3。現在のcut11へ参照を書換えていない。

preparedRightは保存row locator1件があるが、借用readonlyの正常getterがないため未認証のまま保持する。Storeを開かず、raw snapshotをproofにしない。fresh field校正に必要なのは元action/posture/current basisであり、rightは将来の正常launch受理で再認証される。Gold store selectorも再実行せず、正常Mastery2 refsの認証とselector未実行を区別する。

## 検証と非消費

新`native-spin-neutral-prelaunch-v197.ts`/`check-native-spin-neutral-prelaunch-v197.mjs`を追加。mjs構文検査、entryと依存の明示strict`f8e6f8c77bc24ca5bfd3d9dce19b85ab` PASS8265ms、critical入口/終了の静的reviewに重大な欠陥なし。

実Node pinned entryによるreadonly `77ead172`で、791 Source/bundle/harnessの開始終了pin、main/WAL/journalのbytes/SHA、caller transaction/query-only/savepoint/authorizer、catalogと訪問9rowidが不変。Writer/fieldcalibration/launch/practiceの新受理は0。新ts SHA-256 `99985575a88b41bfa8a642981f6c6c5abeb53d7a758c6e6ba322baaadf25ce09`、mjs `4b5be57b5a329e7a6a0ba111639da185a46520d562f00ee582f6b725294e06e4`。

private DB/start-manifest/frontier/reportは公開しない。原180031ms TIMEOUTと元実行endpin UNKNOWNは履歴として保持し、この認証を過去の実行完了へ遡及しない。

## 次の一件

新owned copyの正常prelaunch viewで、元posture body10から正常body-model assemblyとfresh field校正だけを準備する。既存helperはcalibration-onlyの薄いcontextへ分離し、元の既定動作を保持する。fixtureのgeometry/day1/bags/material/glove値はtest-onlyとし、production校正・物理・捕球・公式成功へ転用しない。

実fieldへ進む前に、予約v3 escapeと明示`AeroGroundBallPhysicsV1`を元equipment/physicsに適合させ、prelaunch時点の宣言を保存する。profile欠落をdefault aeroで補完したり、後の結果を見て調整しない。今回の校正準備と全Goalの最終物理実証を分け、旧FAIL/TIMEOUT/UNKNOWNと全残件を保持する。
