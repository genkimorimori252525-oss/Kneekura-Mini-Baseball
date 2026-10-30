# 実打球から通常の守備開始状態への接続

2026-10-30 JST。保存済みTOPの実接触から、同じ分岐の正常なfield rootと次のexecution viewを受理できた。**飛行・守備判断／移動・公式判定・打席の解放は未完成。** この結果は4技術全体や最終HTMLの完成ではない。

## 利用可能になった範囲

V226の実contact tick `34054578`、正常resolution・Actor・body model・calibrationをそのまま再認証し、通常Ownerのfield root、cut12、32件のcalibrationへ進めた。新しい練習・接触の生成は0。別分岐V219の守備参照や結果は移植していない。

field rootの初期命令は、正常modelのprimitive IDを対象に新たに宣言したstationary control。接触時点・elapsed 0だけの初期条件であり、以前のAI判断や継続する守備成功の証拠ではない。身体位置・速度・姿勢・球場・規則を成功用のfixture値に置換していない。最初の観測／反応に必要な正規の短い時間進行と、無期限静止による人工terminalは区別する。

## 実検証

receipt `4986760742414057a1516f1e749e60f0` PASS、149,687ms。この時間は保存分岐の再認証とfield root受理のgate全体であり、試合速度の測定ではない。実行は1回、既存handleの終了を確認済み。

- 原DBは開かず、main／WAL／SHM／journalを実行前後で照合。原ファイル不変。
- 所有コピーの既存行・rowid・catalog・他のheadは不変。許可した45行（field root 1、prefix 1、TOTAL 10、view 1、calibration 32）の追加とphysical head CAS 1回だけ。World head不変。
- caller状態、Source／bundle／artifactの終了pinは保持。既存2TAKE・6練習・実接触は再生していない。
- field root sourceHash `87f0b84d42a1bbe16dcc0a4c9f51d94b7f0e5282986d383803992146f267e249`、snapshotHash `2761c73905a15553019d9c688de3c902b3b3f5c8fc3983d6b43d1340a7803c78`。
- cut12 snapshotHash `77347422719d82d223649051b223b9ae614906e5cfe7f4977992fc6797f54ecd`。

log SHA `73beb6a86f1b27c853e6b229427f33e2756c1d7f3be01efaf9acaf5844bc2683`、report SHA `d1e9024b35fe9bfa82c68bf11a7e3be22d4697b87e9e5d6dde13a3aa6bc25008`。Rootはreceiptのtask／PASS／exit、log実bytes、reportの保全項目と未完flagを照合した。

新tools3のSHAはentry `81123b19f261f5a0d48da619a299dccb6457481dbb9d3a4036e2aab052e87dbf`、test `5516d752552049aad68199e743b2271d0c50826280e953e04773171afea4ea7e`、driver `43055e9b128ad06acb4cd18c0769ca4c387257834742004188c1cfe40abaf1ae`。focused test `320c7a61e2054a1fa4ffb5829ebab04e`、strict `31ac09d4d7c647378cfeca14eb249c20` PASSを再利用した。Solのentry静的レビュー、Rootのdriverレビューとreviewed Source manifestの後に実行した。

## 次の実装と保持する不足

同分岐のfield clockから観測・判断・移動へ進める。現在cut12の観測calibrationは1kHz、field rootは1MHzであり、同viewへの同一nominal calibration追加には一意制約がある。正常な短いfirst stepと新viewから投影する経路を調べる。V212のbody coverage終端まで8.7秒静止させる処理は流用しない。

正規のfoulならresetして次球へ、terminalならendpoint・10 effects settlement・transition・releaseから次の独立した機会へ進める。同じpitchのコピーを反復試行に数えない。4技術・資格付き真正成功・自然Gold・全弾道／空力・最新3HTML配送は残る。過去のFAIL／TIMEOUT／UNKNOWNも各原記録に保持する。
