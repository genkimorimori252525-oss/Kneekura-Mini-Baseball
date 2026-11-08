# 最新描画・球場・試合待機の統合

2026-11-01 / PLAYABLE-ART-STADIUM-LATENCY-20261101 / 進行中。元のrealism Goalは本人の指示でPAUSEDのまま、新依頼を別に扱う。

- 作業基準: observed-default-v273-01/candidate-01/normal.html、共通Coreを使う未完成のローカル試遊候補。描画folderのmatch-v14は固定見本で実Core未接続。
- 採用選手資料: Downloads描画rootのaccepted-art-v2/catalog.jsonとDRAWING_AGENT.md以降の採否を優先。最新素材の実試合接続は未完、横walk/runの明示拒否・Pooh生成禁止を保持。
- 球場: v25福岡は本人造形確認待ちの最新候補、球場画像の採用・本体物理への接続は別。Core円形フェンスと表示の整合・球/選手のshared depthを守り、見本previewのstop/fixed-worldを使わない。v1/v2は黒い欠落のため不採用、v3で円境界適合を調査中。
- 待機: 同Chrome/速度1・内蔵rosterの旧候補で初回warmup4約4.34秒、連続2境界20/30ms・queue6/7、underflow0（観測計測負荷あり、一般化不可）。新warmup1の各1回3球比較は旧4.14→新1.69秒、record/continuation hash一致、最初のqueue1。中断/境界や変動の受入は継続中。
- 進行中: stadium v3 HTTP共通Core比較 session 87916。latencyの攻守交代比較は旧branch完了・新branch timeout（runner timeout引数誤り、旧partial保持）、修正後は新branchのみ。player描画は台帳と拒否履歴を照合中、任意の選手と原画を偽って結びつけない。
- 旧FAIL、UNKNOWN、個別receiptを維持し、本人JSON・原PNG・旧成果物を保護。

## 検証成果物の上書きと訂正

球場v5の2球比較として報告された `cc8ab088fc78489fb16c4dd16470ab41` は、コピーしたrunnerの参照先変更漏れでv3を実行し、v3の生成 `http-record.json` を上書きした。v5比較は未実施、旧receiptは維持する。上書き前JSONの正確なbytesは回復可能な原本が確認できずUNKNOWN。元Core・本人データ・原画への影響は別途照合中。新artifactは新規ディレクトリと排他createを用い、対象候補と出力先をmachine preflightする。


## 統合試遊候補（2026-11-01）

- 独立出力: `work/playable-art-stadium-latency-20261101/combined-4d58cb6c8ac64b6f86d3b2d678815fe1/candidate.html` SHA256 `04dd205b8c0035f4ef20f7394e79beb8287d322696dc80fc5ca9102ef28872b5`。v7球場を入力としてwarmup 4→1を一意置換（逆変換一致）し、採用台帳のB2右投6姿勢を小分け画像処理transformで適用。入力・台帳・6画像は同一captured bytesのSHA検査、他候補を変更しない。入力manifestは `combined-input-9429a4b31fef4d79af9755b028920c54/manifest.json`、統合manifestは候補と同じdirectoryの`inputs.json`。
- 範囲: 投手は青チーム・右投overhand・捕手視点・pitch中だけ新6姿勢。他選手/打者/他視点は既存。実球遮蔽は同camera/tick等の条件に限定、自然試合で遮蔽発生の実例・手元/接地・打者のbody-onlyとgripは未解決。本人未最終採用の福岡v25由来の客席を表示、Coreの円形フェンスは維持。球場の継ぎ目・描画負荷・競技場表示と見た目の差は残る。
- 統合前後Core: 基底`latency/candidate-a.html`と統合candidateの固定seed初球について、実Worker record/continuationとmain-thread replayを双方比較し一致、各両候補も一致。page/Worker監視窓エラー0。`core-compare-7f901b0a/report.json`、receipt `e962de0cb54b49bb8d598beb68809e49`。後続球/旧保存はこの比較の範囲外。
- 統合画面: 6画像ready、実Core 2球とseek上のpitch 0–5、pageerror/crashなし `af7d77370da84a8a9cda38a8535b243d`。WorkerイベントをNodeへ転送しcontext closeまでの追加観測 `51499fcb981f4c38bb55ab98e3464a04`、closeと同時の未配送signalはUNKNOWN。600px画面の選手は小さく接地や手元は評価不能。
- 実file起動: Chrome 156のfile URLで固定seed 2球・画像6枚ready、page/観測Worker errorなし `file-smoke-64392183b958466c8644fc22be686555/result.json`。起動前後のdisk bytes SHA一致。最初の`file-smoke-543c344146524b43918d5116ee75a450/result.json`はChrome inspector cache evictionによりresponse.body取得FAIL、原記録保持。修正版もbrowserが実際に受け取ったbytesの独立確認はUNKNOWN、別のHTTP実検証では同captured bytesを配信。
- 性能/評価: warmup実測は各1回の限定比較4.14→1.69秒、試合全体の改善は未証明。v7動的camera miss135–295msで滑らかさ未達。v8は画質変化と復帰時遅延により非採用。最新全選手・全画角・球場/演出の完全統合や全試合品質・正式配送は未完。試遊用の局所候補としてのみ案内し、元のrealism GoalはPAUSEDを維持する。
