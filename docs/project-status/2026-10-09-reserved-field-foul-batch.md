# 非デザイン: field / foul / repeated-PA 統合バッチ — 2026-10-09

元の9領域の非デザイン計画は継続中。今回の checkpoint は実装・統合検証の保存であり、試合全体や自律 Career の完成を意味しない。

## 今回の接続

- reserved same-PA の実際の確保から transfer、release、中断、投球後の自由球を接続。optional defender_throw calibration は現在の10人の view と Player model に結び、既存32 calibration の受理集合を維持する。
- 公式 outcome / reset を持つ古い episode への追加 physical work を拒否し、正規 reset 後の新しい launch を維持する。
- bunt は accepted intent・現在 view・Person/body・model・calibration・effective profile と一致する明示的な profile binding を要求する。既存の物理計算を用い、holding / pullback の production 数値や自動 profile 選択は定義しない。
- 現在/履歴の field prefix から実際の両足・塁接触、確保、中断、throw release を既存 Core rule へ接続する。未所有の runner motion、PlayEnd、operative call、公式結果を生成しない。
- historical perception の再検証結果を、既存の同一 Native continuation read phase 内で共有する。個々の lifecycle read ごとに捨てていた問題を修正。transaction / write / schema / failure / cycle / commit の境界、row / head / reference の検証を維持する。
- fixture の姿勢有効期限を、各 pitch の ready tick と既存の明示的20,000,000 tick期間から定める。元の絶対20,000,000 tickでは後続 pitch より早く期限が切れていた。

## 統合・検証

実装差分は local base `59ed79681e55ee7c1b2f8b7b9ef5def27a409f57` から local head `aa1227c62086b2b645d546509447fd4188b5e96b` の39 files、+1545 / -48。公開時にコードとtestの **src tree `53aa873f9299a362fc890cae0b58d62c3dec6daa`** が一致することを確認する。

- 独立した統合 source review: blocking finding なし。保護対象18 blob は変更なし。
- 統合 TypeScript compiler: PASS、exit0、残存 processなし、4入力groupのhash不変。初回heap不足と、その後のtest helper型1件の診断は保持。helperのplan/checkpoint unionだけを訂正した。
- 同じ固定 source の focused / compatibility 検証: **10 files / 52 cases PASS、18.67秒**。これには純粋計算、明示mockを使う計算境界、短いNative ownership検証が混在する。長いNative試合合成の成功とは区別する。
- 一括検証の残りは5 Native compositions。BI01とPL01、およびIFN01・BPN01・FR01の2つの有限file groupとして実行する。公開時点では未実行。各groupは別DB/lockで、同一の固定 source を使用する。

IFN01は元のordinary swingと明示した2人の初期glove poseから、pitcher capture → transfer / release → receiver capture → perception / decision / locomotion → rule readを要求する。Core候補では実際の両captureとreleaseが成立したが、このNative全体の成功はまだ主張しない。FR01も、実際のcontact → untouched settled foul → official closure → retirement / reset → 第4球TAKEを正規ownerへ要求する段階である。

## 以前の結果の扱い

前のsrc tree `1d31b236b5dbb9f1fb9d2afadb7caca018af0b3f` では、選択した113 casesすべてに完了したfile単位の結果がある。1,200秒で打切られたgroupの18 files / 105 observed passes と、その未完了部分だけを実行した5 files / 8 PASSを区別して保持する。元groupのterminalはfailedのままであり、whole-project PASSへ読み替えない。NationalのRegional各段階、Premier12、通常のphysical National playからoriginal participationへの接続を含む。

旧BI01は1,800秒capで終了し、case成功は未確定。source / controls / runtimeは不変だったが、author check由来のVitest cache追加がdependency差分として検出された。生成cacheを保存して依存hashを元へ戻し、今回のread-phase修正後の合成で確認する。旧失敗を消していない。

## 残る境界

fair-ball終端には実際のlive-end generation、operative official / communication、必要なrunner actionの接続が残る。未実装のowner・既存ルールで実装可能な部分と、未定義のproduction physiology / perception calibrationは個別に調べている。accepted score/appraisalやbunt bindingを、自律的な数値生成モデルが完成した証拠にはしない。

UI / designは未接続。home-PC CIは起動せず、private DB / log / control packetは公開していない。Draft PRを継続し、merge / deploymentは行っていない。
