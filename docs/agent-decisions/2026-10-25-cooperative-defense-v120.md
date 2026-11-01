# 複数追球・連続dive・守備意欲の実装判断

2026-10-25 JST / Task `MB-20261025-COOPERATIVE-DEFENSE-V120`。

## 本人承認と範囲

今回の本人の直接指示「改善計画に着手してくれ。」を、直前に作成した `docs/superpowers/plans/2026-10-25-cooperative-pursuit-and-defensive-willingness-plan.md` と対応Specの実装着手の正式承認として記録する。固定担当/成功指定を作らず、個人の認識・採否・能力・緑得能・信頼・球場差とworld-first/Read-only Presentationを維持する。Plan/Specの原文は改変しない。

Ruling: 開始基準を計画時V118から最新V119へ更新する — 計画後に本人依頼で修正済みの接触停止・同塁集中を失わないため。V118の原監査・再現fixture・旧成果物は維持し、V119 Core `4e1dd0aad2ec2aa4156777e2946e39657d9a25c40406f436d60be5c47a0d964d` / Native169を固定する。誤れば再現性が失われるため、元Source pinと配置9fileをbaselineへ固定し、以後の変更を明示する。

Ruling: shared dirty checkoutを維持し、今回の独立moduleだけを所有分割する — 未commitの旧実装/成果物を別worktreeへ落とさず、frozen Coreとmodule所有で混線を防ぐ。rootはMain/追球/安全/通信/心理/Host/統合検証、既存Sol一名は新PostActionArrival moduleと専用testだけ。担当外のrollback・reset/clean・新agent・並行の重い性能試験はしない。

## 手順と判定

- [x] Task0: V119 Native169と配置9fileのpin、既存二遊間4場面/1B dive carry/旧最遅を凍結。
- [x] Task0: 実装前に5場面各20回（各fresh processでcold first＋19 reuse）、旧最遅3回を直列実行。工学予算p95×1.25+25ms/max×1.25+50ms/終了後GC heap+64MiBを結果を見る前に固定。receipt `79775165841b4bb696d7fdaefc5ddbc7` PASS、機能実装未着手時の測定。
- [x] Task1: 個人の追加捕球価値・前後/回収窓を既存候補へ接続。
- [x] Task2: 進路予告v2・全身体の連続保守境界・実commit改訂の整合と実連続dive。
- [x] Task3: absolute readyと再起後状態を使うcarry/receiver/relay/runnerの同じ予測。
- [ ] Task4: 既存Appraisal/単一感情gateと守備専用projection。未接続/失効を区別し、重要度直倍率・走塁risk流用・緑得能二重適用を禁止。
- [ ] Task5: 共通mapper/Host/練習/ログ/Worker/replay/旧JSON/3HTMLと性能予算。

性能記録: `docs/verification/cooperative-defense-v120/performance/`。同folderのfrozen-core.jsと入力JSONは比較用の固定資料であり、新版製品Sourceではない。保持力0.01J等は境界の検証介入であり、MLB自然頻度の校正ではない。3回しかない最遅場面に統計的p95を主張しない。peak heapは未測定。

感情の本番有効化は、計画どおり入力校正とWork所有のマーク表示handoffの整合後に限る。承認済み資料の場所を本人へ質問しつつ独立作業を継続する。今回の承認を、新しい絵柄/配置/配色・架空の人格査定・未承認育成DRAFT・傷害発生器の包括許可へ拡張しない。

Source/HTML/原JSONの大量置換やSource commit/push/merge/deployは行わない。新版は別名配置、旧V118/V119と原FAIL/UNKNOWNを保護する。重要工程ごとにCURRENTと機械receiptへ進捗・制限を残す。

## 実装途中の判断・証拠

Task1: 既存の個人判断に最大3系統の捕球窓を接続した。これは選手ごとの探索上限であり、追球人数の制限ではない。宣言は捕球の保証と扱わず、別の時刻・場所の追加価値と空ける損失を比較する。新module/旧個人判断/元51停止場面の19試験は `f8263b84ef124eb88df07e7015531a75` PASS。

Task2: 通信v1の単一queue/配送lawを維持したv2 envelope、既存寸法からの全身保守境界、Bezier区間の連続離隔、play固有scope/world revision/全command束縛の証明を追加。focused option証明はjoint commitへ昇格させない。unknownはsafeへ変換せず通常追球/別案へ戻す。agentレビューで見つかった古いworld revision・不完全roster・外部clock変更を固定し `03295d3eea2d4efab7255b663a24b8ef` PASS。空中の既存commandを取り消さない。

実連続diveの探索記録は `pair-search-1/` の不成立24試行も保持。`pair-search-2/` の `2501c6183ba7443097f20f5cc6e1a434` PASSで、先行者f3の実グラブ接触/非保持→新観測後f5のdive採用→実保持を確認した。f5開始はf3の再起完了前で、同時空中とは主張しない。f5も保持力0.01Jにした境界対照では双方が失敗し別野手が回収。成功例はSSのx/z/反応だけを明示的に変えた検証入力であり、本番能力や球場を変更しない。自然な失策頻度の根拠ではない。fixtureをSource testへ固定し、描画間隔/trace対照を含む `6bb7fb5aaa534015ad05f2afd2385bf4` PASS。

Task2で露呈した再起境界の1ULP下向き残速は `pair-single-diagnostic/FINDINGS.md` に保存。連続した再起末端だけ、既存Source actionのexactEnd位置/ゼロ速度を通常motorへ引き渡した。着地impulseや接触guardのepsilonは変更しない。RED `cb3da2c861334fe09b97ee92083e8258` → GREEN `aaf41a760ac64828b1808d2dfb66ca7c`。

Task3: 独立moduleの絶対ready時刻、並行max依存、観測age一回、legacy無動作互換、およびrelay/runnerの51試験は `fbae37c9e55946f9a1c5dcda1e4e339d` PASS。Mainへの接続は本人の採用済みendpoint・到着済み予告・現在観測phaseからの推定を分離。他者のprivate future endpointは観測入力にしない。時点/有効範囲付きcontextがある時だけ古い相対relay cacheを再使用せず、無動作の旧branchは維持する。これは時刻の二重加算や異なるsnapshotのcache混用を防ぐため。Main統合の未定義optional keyによるinert検証拒否を `64fd3c8d` / `c39eaae6` に保存し、key省略で修正。test側のfalse trace入力は `2741912a` に保存し、既存true/省略契約へ修正。全型 `fe34b8776b1c469ebbf520b66eaca1ba` PASS。製品完了とは未判定。

## 感情資料handoffと採用段階

本人の今回の直接返信で6画像の保存先が提供された。閲覧済みのmotifは汗/笑い/!?/落胆線/黄色の強調線/怒り。JPEGにはcheckerboardやwatermarkの焼き込みがあり、そのまま製品表示へ貼る指示とは解釈しない。既存5感情への候補対応は FEAR=汗、SUPERIORITY=笑い、MOTIVATION=黄色強調、IMPATIENCE=!?、ANGER=怒り。落胆は既存EmotionKindがないため、新感情として追加しない。参照hash/対応は別handoffで保存し、画像や私的パスを外部へ投稿しない。

既存8軸Appraisal consumerはあるが、現Liveには校正済みproduction sourceが存在しないことを限定Sol読取で確認。名前/守備力/緑得能から人格を生成しない。計画の二段階gateを維持し、第一段階は `NOT_CONNECTED`・感情追加効果/markなし。これは平静確認ではない。戦術contextと非発火差0のpure helperは独立して準備するが、入力校正/同時tick表示契約なしに通常試合を有効化しない。段階2未接続を製品の完成済み機能とは記録しない。

## 後続の統合・性能診断

確認済み候補03はCore `dde43d993844664cf864078083347c3df18231ba4b593feb2fc9002c50e4fa67` / Native175、build `fd5d0759`。関連198test `d910202d` / 全型 `a7d7395d`、PC/スマホ12場面 `a5ed2afb`、旧JSON編集/保存/取消 `9d86e967`、局面12+7 `782480b0`/`9982f080`、Worker同値/取消 `e9ed3743`、athletic画面 `81413277` PASS。原seed9回は未実行。

Solの限定読取で、送球直前だけ旧receiver ETAが残った点と、観測jumpの横制動重複を検出し修正。legacy receiverの反応を消してしまったRootの統合bugは `55bf089b` / `2ec34abd` FAILを保存し、receiver modeの残反応を保持して `b1cabca6` と最終198testで修正確認。一塁手の実再起後carry、二人のdive/保持失敗/別人回収、frame/trace/配列順の同値は `c9aeb757` PASS。

直送球の二重計算を疑ったが、既存RelayのfirstHopはdirectでも存在した。追加の再利用分岐は冗長と判明し撤回。本人向けにも訂正した。Legacy/通常で不要な新しい送球選択は作らない。

固定6場面の最終候補03計測 `4cbc984b` はFAIL、全完走・4場面予算内/2場面未達。close-first-weakのp95約1309msに対し予算889ms、separate-first-weakは約1295msに対し1170ms。最大/GC残存も元予算を維持。`performance/verdict-final-1.json` は保存測定からの集計であり、新しいPASS receiptではない。childの正常終了を予算PASSと扱わない。

通常速で16球完了・17球目要求の強化harness `fe62eff6` はunderflows=1でFAIL（heartbeat最大408ms、errorなし）。診断 `3011f2da` で5球終了後の30.208秒に6球要求、6球のrecord到着35.318秒、約5.1秒の実待ちを確認。集計定義やwarmup4/最大12を変更して隠さない。

実入力捕捉専用のBlob hook `7a4aaf81` から、実6球のfield-input-2と記録判定用field-input-3を取得。同じseed/origin/contactでfieldersだけが異なる。実守備の直接実行は約3.07秒、ordinary effort比較はprofile下で約29.50秒。後者のCPUの大半はRelay→ThrowAction→空力係数/RK計算。未表示未来の情報はharnessの私的診断にだけ保存し、戦術/通常UIへ渡さない。instrumentationは製品HTML/Sourceへ入れていない。

Ruling: 既存scoreLivePlayV100の安打/失策用単一比較実行は記録品質のため保持する。今回新しいshadow比較を通常運用へ増やさず、物理/公式結果と比較世界を混同しない。比較の削除や遅延による音声/表示/API変更は採用しない。先に同じ数値を計算する空力の重複を減らす。

追加最適化: 深い凍結/inert検証済みの係数profileだけ、drag/lift共通のspin区間探索・除算を一回へまとめ、blendが0なら有限のRe補間の無寄与部分を省略する。raw profileの従来検証/補間と積分刻み/式/係数値を維持。事前のowned/rawビット同値grid `7c7b4a8d`、変更後の同値＋Source/catch試験 `917be383` PASS。現distはCore `2cb99c576ed966a94ad440f69d9d29a29332a3004602a8a9bac01d7d1f6df989` /175。候補03とSourceが異なるため、03のPASSを新版配布証拠へ流用しない。ordinary-profile-2測定中、検証/別名再build/9回/性能の再評価が必要。

### 同値最適化の追加実測（2026-10-25）

同一ordinary入力の26.50秒に対し、既存memo上限を8192へ増やす診断は27.17秒、追加hit42件に留まり不採用。製品上限2048を維持。Source boundsのimmutable parameter定数だけを遅延compileし、rawは旧計算を維持した。非連続liftの拒否も従来のbound query時点を保つ。`50c4a461`試験PASS、build `887e46e7`、ordinary-profile-3 `bfcb0718`は約23.9秒で完走。

次にSource factoryがclone/validate/deep-freezeしたairだけ、RK k2–4の私的生成vectorに対する空力/回転微分をscalar投影した。k1とrawの計算、全RK重み・積分刻み・式・係数・error guardを保持。相対風速のnormを回転微分と共有し、unused diagnostic vector生成だけを省く。signed zero/重力の加算順、seam検証の先行、低密度でもspin decayを残す。RED `f192417d`→owned/full oracle `Object.is` gridほか `1882c012` PASS。build `c1b506bb`、Core `6febbd8e24987e7fcf275aec65d63b225449cd7d14379ab8add065837062fd49` /175。

ordinary-profile-4 `b8916978`は約20.38秒。旧候補03との全frames/facts/rules/end/runners/recoveryframes完全一致、256空中sampleと48 Source sample/ground境界のstrict一致 `8fc2bead` PASS。check-exact-airの最初のFAIL `336166b0`はharnessがinputのphysicsをballPhysicsと誤記したもので保存、製品の失敗ではない。これらは固定6場面・buffer・9回の合格を意味せず、元予算の再評価を続ける。

6場面再測定 `e604b23f` は5/6予算内、close-first-weakだけp95約1191ms>889、max約1416>1184でFAIL。78,472回のETA memoの迂回診断 `645bc0b3` は同結果だが再利用時の有意な利益がなく採用しない。既存33k hitを捨てない。

同じ移動command tupleを回避探索の各passで繰り返し集計していたため、探索内だけ最大2048個のaggregate memoを追加。従来も全pairの算出はcacheされていたので、候補/評価/新pair counterの意味・探索順・min/soft/risk加算順を維持。forecast中に不変のactor/body pointも一回生成。旧回避/連続dive `8a03ae78` PASS。close-first-weak20回 `858cbe30` はp95約1161/max1292で改善したがなお予算FAIL（child正常終了を予算合格にしない）。

現Core `5b8aae080ef0fc600f171653ce5aa5315a181d50b8b38bb0e136c26459603912` /175、候補04 build `e4b7c1e7`。28file230試験 `1290a194` /全型 `78b842dd` /PCスマホ12場面 `e515a609` /旧JSON編集保存取消 `5cbe7867` /局面12件 `8dbbbd0c` /athletic両幅 `f659e15a` PASS。authoring初回 `873cc390` は検証prefix引数不足のFAILを保存。9回原seed完走と背景・通常速bufferは実行/確認途中。これを完成済みと扱わない。並行した機能検証のwall timeを単独性能やFPSの根拠にしない。

### 候補04の通し確認

原JSON/seedの9回 `b1c4006b` PASS、689球/175守備すべてcomplete、16半回更新。jump3/dive51/feet-slide113/head-slide38は検出数であり頻度の校正ではない。score21–91は引き続き異常に高い得点の課題を示す。今回の守備判断をMLBの平均成績へ校正済みとは扱わない。9回中の実throw-recovery検査は該当0件であり、この経路は実carry/連続dive固定fixtureの証拠を別に使う。

追加7局面 `afe62ce2`、Worker/直接Core同値と取消の両幅 `fe7aab00` PASS。単独CPUでの通常速bufferと固定6場面の最終性能は次のgate。Sol一名の限定read-onlyレビューではscalar微分/所有権と回避aggregate/forecast再利用に具体的な欠陥なし。独立実試験や全seedの保証の代用にはしない。

### 最終候補の扱い・未達を保持

通常速16球完了/17球目要求 `62d522d8` PASS。underflow0/max queue12/warmup4、heartbeat最大393.3ms。これはこの固定シーンの証拠であり、全9回・全seedの無停止保証ではない。

current Coreの6場面単独測定 `10234cfc` と予算集計 `2ef67e9c` はFAIL。5/6予算内、close-first-weakはp95約1127ms（予算889）/max約1410ms（予算1184）。6場面すべてcompleteでGC残存heapは予算内、peak未測定。閾値は変更しない。旧最遅3回のmax約15.18秒は元予算内でp95を主張しない。

ordinary-profile-5 `437f8251` 約20.17秒、現Coreと旧03の空中/Source/ground境界・ordinary全frames/facts/rules/end/runners/recoveryのstrict同値 `62cc70b0` PASS。候補の全捕捉入力・Native175・3HTML/sidecar9file・元JSON/固定fixture・旧18file・15receipt/logを照合 `eb811e0d` PASS。ただしこれはartifact integrityのPASSであり、candidate-integrity.jsonのstatus=PERFORMANCE_GOAL_OPEN、firstStageComplete=falseを維持する。

Ruling: 依頼済みの改修をレビュー可能な別folderの候補として渡し、正式配置/第一段階完了/計画全体完了には昇格させない。性能目標1件と心理source/校正/mark同時発火は未完了。復旧は旧V119を開くことで行え、Source/HTML一括rollbackを行わない。既存公開Draft PR380の判断要約 issuecomment6397610258はrepo/head/公開範囲を確認して投稿しreadback一致。私的原画像・JSON本文・ローカルパス・生会話は投稿せず、Source/HTML/文書本体のcommit/push/merge/deployなし。
