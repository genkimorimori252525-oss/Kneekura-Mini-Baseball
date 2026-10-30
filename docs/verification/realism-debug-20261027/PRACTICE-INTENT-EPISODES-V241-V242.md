# 振る意思と同本人の反復練習

2026-10-30 JST / MB-20261027-REALISM-DEBUG-PLAN。全Goal ACTIVE。

## 現在使える範囲

メーカー候補では、方向とは別に「おまかせ／振る／見送る」を指定するUIを追加した。同本人・同clipの反復診断は開始前に2つのseedと必要試行数を固定し、各回の本人の初球を評価して、通常Coreで打席終了まで進める。次の回はepisode内の記憶・負荷・時計を初期設定へ戻す。未開始・未完・見送り・未接触・未解決は予定分母から省かない。

Nodeの保存済本人HOOK入力でfair接触→通常打席終了→同本人次episode→全保存再生を確認した。新しいMain／実BlobWorkerの実ブラウザ受入も通過した。方向とは別の意思指定と、本人の打席終了から次の本人の練習、保存再開、通常練習への復帰を最新候補で利用できる。完成3HTMLの配送・4技術の成立・習得・Goldではない。

## 実装と境界

- V241のEXPLICIT_PRACTICE一球requestはcallerの意思指定であり、Native／earned認証ではない。現在配達済みV151予測、effort、latency、motor等の通常制約を保持する。既存spinControlはdummy policyで抑制しない。
- V242は本人TARGETと同打席の尾球へ固定意思を適用し、別人prefixへ本人意思を転用しない。試行deltaは本人の評価球だけ。normal／trial両armは同じ意思を使う。
- 通常候補のepisode状態へのbind、request cloneと公開前tail構築により、古い候補やcaller変更で別seed記録が混入しない。任意scopeId／motorIdだけでは異なる独立機会に数えない。
- local記録の投球番号はepisodeを跨ぐ通算値。分類表示は事後記録であり物理制御ではない。

## 検証済みと未完

保存済本人fair回帰390fc1f4 PASS23.671s。独立レビューで見つけた尾球拒否／旧候補受理／tail入力cloneを修正し、関連旧経路を含む43件456511ea PASS34.265s、strict8300a888 PASS12.969s。Root6b4d8148 PASS312msで8既存Sourceの逆変換全文と11receiptのtask／command／log実bytesを照合。ENDED表示の小修正はb0bbad23構文PASS、旧全文保存。

保持する失敗: 全catalog clone上限35752742、undefined再開d5ba86a7、初球fairで尾球未発生3a786b1c、Root proof読取key誤り721f7941。修正後のPASSへ過去結果を付け替えない。未変更の過去の受入は再演していない。

新Maker候補は `work/maker-practice-episodes-v242-candidate-01/maker.html`、HTML SHA979911906802a91e2912250b783d681715d5174c472fea6bc93689c05a49e265、生成608b3001 PASS2.032s。本人1-b0/L/obp-23_5、HOOK(-.01,0)、seed20261102/20261103、SWING／方向AUTO、2試行の必要基準を固定。

実ブラウザはChrome156.0.8078.49、3fb800a6392844578cded81eb18a43a7 PASS254.702s（この比較・再開・表示検査一式の経過時間。試合全体の性能値ではない）。2回とも本人TARGET初球がfair→正常PA end、別seedの同本人次episodeへ進み、Main/実BlobWorkerのstep／record／capture全値、2preview非消費、close後の通常AUTO投球と再開が一致。Blob Worker本文の実Workbench先頭全文、HTML内Workbench全文、開始終了Source/input pinsを確認した。Rootが11artifactのSHAとreceipt/logを照合、1200/390画像を目視しラベル・折返しを受入。report SHA9381e1d1281a33359418c7e9d351dc65e856785e9b10baa976223a60f1554914。handle68173はterminal、再起動しない。

**物理のフック成立は0/2、UNAVAILABLE／CRITERION_NOT_MET。** normal→actualの要求方向成分は−55.027455→−17.623732 rad/s、−350.862875→−331.755875 rad/sで改善したが、両方とも負のまま。接触2/2を技術成功や習得へ昇格しない。次は固定world XYと接触面・摩擦・回転成分の対応をprospective入力だけで調べる。

保存済本人入力がprivateであるため、配布するtestの当該回帰だけfixture不在時を明示skipにした（85fe2877）。存在時は元SHA照合を必須とし、合成3件は常時実行。missing/present条件の小検査ed4e8335 PASSであり、実contactや43件の帳尻再実行はしていない。

完成3HTML・通常試合・調整室・9回・最終性能・配送、career／Native資格と自然Gold、4回転制御、キレの元球種保持物理3段階は未完成。
