# 同じ本人の独立practice episodeを反復する

2026-10-30 JST / MB-20261027-REALISM-DEBUG-PLAN。通常試合の規則と元JSONを保持し、複数の本人機会を固定cohortへ通す版付きpracticeモードを整備する。

## 問題と判断

V239のHOOK組では初球のfair contactが正常Hostで打席終了となり、次の打者へ進んだため本人の二球目が未実施になった。通常打順の連続ordinalだけでは、本人の二つの機会を完了できない場合がある。必要試行数や基準を下げて解決したと扱わず、既存INTERRUPTED／HOLDを保持する。

Astraは外部で捕捉結果を選び直す新集約Ownerではなく、既存practice Ownerへの版付き独立episodeモードを推奨した。現連続count／ordinalモードは別に維持する。

## 事前宣言と実行

- episode数、本人／保存clip／domain、seed導出規則または列、開始条件、評価対象投球の選択規則を開始前に固定する。初版は本人の最初の1投を各episodeの評価対象とし、結果を見て別episodeへ差し替えない。NO_TARGET／missも含める。
- 通常Hostが受理する開始状態から実行する。本人へ到達するprefixが必要なら全投球を保存し、本人以外を代用しない。
- 評価対象のpaired結果を受理した後も、そのPAが正常に終わるまで進める。PA終了の証拠とepisode transitionを保存してから、別の練習実行として次episodeを開始する。前の公式状態を巻き戻したように見せない。
- origin／時計、初期memory／prior、持越しまたは初期化、workload／疲労の扱いを明示する。新episodeを通常試合の連続時間・経験継承と偽らない。日付をsystem clockや最終接触から補作しない。
- Ownerが固定scheduleからidentityを生成し、episodeと実physical pitchへ結び付ける。seed差だけで獲得上の独立性を証明しない。同captureコピー、同pitchの反実仮想で数を増やさない。
- prefix、評価pair、PA末尾、transitionを全replayする。未実施episode／未完PAをHOLDとして残し、closeで分母から落とさない。

## 最初の本物の受入

本人の初episodeがfair contactで終了しても、正常HostのPA終了を保存し、次episodeで同じ本人・clipの事前指定機会を実行でき、全体をcaptureから再現できること。

評価分母・seed列・元JSONが結果によって変わらないこと、別playerを代用しないこと、旧連続練習／保存が維持されることを確認する。V241の振る意思入力、実4技術の回転成立、獲得・希少Goldは別条件であり、この反復モードだけで授与しない。

既存Ownerへの最小接続と保存形式は実装前に具体化し、別Ownerの連鎖を作らない。旧V239の閉じた診断と結果は上書きしない。
