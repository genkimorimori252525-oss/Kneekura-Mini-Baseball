# 固定スイングの二球診断基準

2026-10-30 JST / MB-20261027-REALISM-DEBUG-PLAN。本人の、機能完成を優先し通常Coreの実経路で検証するという依頼に基づき、技術名選択から既存Owner評価へ接続する初期診断を定義する。

## 対象と判断

初期motorは既に事前固定されたXY 1cm probeと同じ数値を使う。BACK (0,+0.01)、TOP (0,-0.01)、SLICE (+0.01,0)、HOOK (-0.01,0)。新しい数値を結果から探して成功させず、名称どおりに回るという仮定もしない。本人・現在の保存clip SHA／左右・正常planeに結び付くXY専用の明示未校正記録とし、旧V123の複合motionや自己申告資格を転用しない。

通常の能力判定・獲得・Goldは今回のpresetの対象外。選択UIは「固定スイングの二球診断」と明示し、数値入力を増やさない。APIではcriterion=nullを引き続き許し、基準不足HOLDを保持する。

## 初期の明示project診断

versionは`live_spin_practice_criterion_v239`、authorityは`EXPLICIT_UNCALIBRATED_PROJECT`。開始時点から次の二つの連続pitchOrdinalを対象として固定する。

- minimumIndependentTrials = 2
- minimumContactFraction = 1
- minimumSuccessFraction = 1
- minimumDirectionalSpin = 1 rad/s
- minimumDirectionalImprovement = 1 rad/s
- miss = COUNT_FAILURE、noTarget = COUNT_FAILURE、unresolved = HOLD

2は一回の固定操作に複数機会の記録・再開・未実施保持を通すための診断長で、獲得に十分な標本数という意味ではない。割合1は例外なしの二球診断を示し、実際の能力成功率の製品閾値ではない。1rad/sはゼロ符号だけの通過を避ける明示的な数値診断条件であり、知覚・生理・実測校正から得た値ではない。既存別domainのV230値を既定値として流用していない。

同じ正常機会から対照を計算し、要求成分そのものと通常結果より要求方向へ変化した量を両方評価する。見送り／未接触／NO_TARGET／未解決／中断を成功側へ除外しない。未実施slotを保持し、HOLDや別打者への移行で完了できなければ、その事実を残して明示closeできる。

## 影響・検証・復旧

この基準でDIAGNOSTIC_CRITERION_METになっても、Native／earned／Goldを授与しない。通常earned consumerで未資格motorはNO_TARGET。UI・Worker・Ownerは通常planを保持する明示practice policyだけを使う。旧API・旧保存・roster／能力／原JSONを変更せず、opt-inのsidecarへ記録する。

検証は技術名選択→固定motor→同Core paired計算→trialのみaccept→保存／replay→基準値と全結果の表示まで。対照のcounterfactualを別独立試行に数えない。未成立はUNAVAILABLE、未完はHOLDのまま残す。Source・入力を固定してから実ブラウザを実行し、原本と旧FAILを保存する。復旧はopt-inを使わない旧経路と保護した旧HTMLで行える。
