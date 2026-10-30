# 現WIPの実Chrome高速検証: 有限2球

2026-10-31。完成版ではない固定WIPの同一Coreについて、旧Coreの証拠を再演せず、現Chromeで新たな有限caseを取得しbatchの一致を調べた。Chrome 156.0.8078.76、Core SHA-256 `17d0d777c39d678cc899ab8652c809af4e436a1ac4e15cefb477e36107b6173a`、manifest `3affe840d0e7dd348a54d0bf8b14ada888e84e0ac9b15bf8d4dc7c593a4b6215`、case `4ec53822850ad5155279bf50724335bab6ae83fac648e8a53852c290166769b0`。開始・終了の入力／Source pinを検査した。

- 新2球の通常再生・高速再生・描画なし・毎球復元・実Workerは全record一致。receipt `a9241f0bb1004f0cb9073e357b839a3c` PASS、36.875秒。
- 事前固定のseed `1,2,3,4`、並列数 `1,2,4` の12 Worker jobsは、それぞれ同seedの通常Hostとrecord・state全bytes一致。receipt `03bbdf0fc56142a1b4bd3706b71cf606` PASS、63.625秒。Worker終了・cleanup・終了pin検査もPASS。report SHA-256 `2bb89d228b83769879f2f584604e6e9d42b15b9d8bcc586f97f25e08cc9e9654`。主担当は12件の保存record/stateも個別比較し、保存時の末尾改行を除いたdigestを照合した。
- 各seedは2球、全oracleで接触・守備0。現Coreの接触・守備、試合全体、全9回、性能改善、異runtime同値、完成版配送はいずれも未証明。経過時間は上記固定検証全体の測定であり、試合速度の主張ではない。
- 初回の成果物digest照合では、保存時に追加された末尾改行をdigestに誤って含め24件不一致と誤判定した。保存とdigestの対象を確認して再照合し、全12件のrecord/stateが一致。誤照合の経緯を残す。

## 接触と守備を含む現WIPの追加受入

同じCore/Chromeで事前固定した12球case（SHA-256 `af614430c735f4f53bdca5b8aa17843df94e0fa2c75a7b6dba9775691499e342`）を取得。旧caseと設定・seed `1174965123`・12 commandsがlossless一致し、通常・finish・描画OFF・毎球復元・実Workerの５経路で全record一致、４接触・４守備。receipt `26cce18c90bb40908ec6ef4d6a1db721` PASS、256.656秒。

このcaseで事前固定seed `1,2,3,4` × pool `1,2,4` の12 jobsを実行。各seedの通常Hostは12球・３接触・３守備で、各Workerの全record/state保存bytesが対応Hostと一致。receipt `5772df74f2d24a6198ea2b8096cad4a8` PASS、269.422秒。report SHA-256 `37d9304e0ecf505e318b349013b482cafe230f93b7447b5f99a3d52c570ece46`、主担当は12 jobsの保存bytesとdigest、receipt/logを個別照合。開始終了のCore・case・232 inputs・HTML・runtime・Chrome一致、errors・cleanup・終了pin不一致なし。

これは有限12球・４seedの同値検証で、全９回や試合速度の証明ではない。上の時間は各検証全体のelapsedであり、実時間再生と高速モードの速度比較ではない。以後のSource変更にはその変更に応じた新しい検証が必要。
