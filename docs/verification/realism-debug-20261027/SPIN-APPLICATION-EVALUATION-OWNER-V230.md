# motor適用評価の保存と再読

2026-10-30 JST。既存の技能保有・元練習記述と分けて、特定motor / domainのproject評価を保存するOwnerを追加した。真正データで保存したのは**1試行の不足評価**で、適用資格は発行していない。

## 実装

`SqliteSpinAimQualificationV230.ts`は正規受理入口の明示V228 Sourceから、正常censusとpure評価を再導出する。独立table1つ・sourceId一意で複数domainを共存させ、旧Masteryのlatest選択やV225の記述を変更しない。

保存Source / snapshot / hashと4-field fullrefは不変。currentWorldRevisionはimmutable hashへ入れず、固定prefix / memberが変わらない正常な範囲外future追加を許容する。新Owner専用canonical JSON / hashは`-0`を保持し、generic actor hashへ置換しない。

Source / schema / canonical JSON / hash / mirror改竄と一般の再導出不一致は拒否する。正常認証した閉集合の変化は、現在snapshot未認証・HOLD・applicable=falseとして返し、古いstored trueをconsumerへ返さない。HOLD / INELIGIBLEの保存は資格発行ではない。旧consumer / Core / Blue・Gold / 旧データは変更していない。

## 検証

実SQLite＋代替censusの7 tests `fe1a39b5`、focused strict `a9f050a5` PASS、独立SolレビューReady。複domain共存、Source固定、offline / retry、alias、insert後の再導出・trigger rollback、Native callerのq1 / savepoint / authorizerを確認した。これらの合格資格ケースは代替censusであり、真正な資格成立の証明ではない。

新gateのstrict `628dea46` / 構文 `c1cdc2af` PASS後、実所有コピー `34ae8fbf79d34c3188dbe36439f5dea4` PASS / 48,217ms。commandは `node tools/verification/check-spin-aim-qualification-owned-copy-v230.mjs work/spin-aim-qualification-owned-copy-v230-01`。

- 保存済みV226 / V228の正常trial、全census、domain、旧Mastery / calibrationを再認証してSourceを作成した。
- 診断基準は独立3試行・方向0.001 rad/s・成功率0.5、missを失敗分母、未解決・未分類をHOLD。正常旧`synthetic-v127`の数値が出典だが、旧contact分母から新trial分母への採用はRootが明示した診断仮定。人間・新domainの校正や製品既定値ではない。`sourceVersion:diagnostic-project-v230`とprivate provenanceへ意味差を保存。判断は `../../agent-decisions/2026-10-30-spin-application-diagnostic-criterion.md`。
- 結果は`INELIGIBLE / INSUFFICIENT_TRIALS / total:1 / applicable:false / qualificationIssued:false`。接続を閉じ、providerless再読でも全値一致した。
- 原V226 DBと保持済み8 DBを開かず全files不変、旧全row / rowid / catalog / head不変。新tableの評価1行だけを追加。caller q1 / savepoint / authorizer、Source / bundle / artifact終了pinsを保持。
- 新practice / contact / 旧Mastery writeは0。旧6練習や4分の接触試行は再実行していない。

log SHA `ea2e2739dc69b537bd5ac9d47dc935097c545ab3bd20af04a97b77475e25a943`、report SHA `85d5fc88078db7a38d58836eb51195a96dac83c8c92586d0d31f1d4ef773714d`。48.217秒は診断保存・再読gateだけの時間で、試合性能ではない。

## 未完

真正な反復による基準成立、実行時domainに合う通常consumer、新しい4技術の適用、Gold、最終配送は未完。次のconsumerは技術保有AND現在applicable評価を必要とし、計画時の条件を正常precommit inputから求める。既に終わったresolutionから条件を取得して未来情報にしない。

初期RED `94c73948`と引数なしpreflightの期待拒否 `216ea3e1`、以前のNodeアクセス違反などは原記録に保持する。
