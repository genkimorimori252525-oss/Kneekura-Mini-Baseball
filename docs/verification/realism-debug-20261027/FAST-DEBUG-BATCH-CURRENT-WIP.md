# 現WIPの実Chrome高速検証: 有限2球

2026-10-31。完成版ではない固定WIPの同一Coreについて、旧Coreの証拠を再演せず、現Chromeで新たな有限caseを取得しbatchの一致を調べた。Chrome 156.0.8078.76、Core SHA-256 `17d0d777c39d678cc899ab8652c809af4e436a1ac4e15cefb477e36107b6173a`、manifest `3affe840d0e7dd348a54d0bf8b14ada888e84e0ac9b15bf8d4dc7c593a4b6215`、case `4ec53822850ad5155279bf50724335bab6ae83fac648e8a53852c290166769b0`。開始・終了の入力／Source pinを検査した。

- 新2球の通常再生・高速再生・描画なし・毎球復元・実Workerは全record一致。receipt `a9241f0bb1004f0cb9073e357b839a3c` PASS、36.875秒。
- 事前固定のseed `1,2,3,4`、並列数 `1,2,4` の12 Worker jobsは、それぞれ同seedの通常Hostとrecord・state全bytes一致。receipt `03bbdf0fc56142a1b4bd3706b71cf606` PASS、63.625秒。Worker終了・cleanup・終了pin検査もPASS。report SHA-256 `2bb89d228b83769879f2f584604e6e9d42b15b9d8bcc586f97f25e08cc9e9654`。主担当は12件の保存record/stateも個別比較し、保存時の末尾改行を除いたdigestを照合した。
- 各seedは2球、全oracleで接触・守備0。現Coreの接触・守備、試合全体、全9回、性能改善、異runtime同値、完成版配送はいずれも未証明。経過時間は上記固定検証全体の測定であり、試合速度の主張ではない。
- 初回の成果物digest照合では、保存時に追加された末尾改行をdigestに誤って含め24件不一致と誤判定した。保存とdigestの対象を確認して再照合し、全12件のrecord/stateが一致。誤照合の経緯を残す。
