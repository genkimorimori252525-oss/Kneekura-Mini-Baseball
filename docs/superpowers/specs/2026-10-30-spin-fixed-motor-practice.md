# 技術選択・固定motor・独立practice評価

2026-10-30 JST / MB-20261027-REALISM-DEBUG-PLAN。V238の通常plan保持と実運動を基礎に、4技術と希少GoldまでのGoalを縮小せず進める。今回の機能単位は通常能力の資格授与ではない。

## 判断

Astraは「技術選択→固定motor適用→独立practice評価」を推奨した。選択と配線だけなら未資格デモであり、評価まで閉じる。球spin推定契約のない逆算plannerを次の最小単位にせず、真の未来ball spinを参照しない。

既存V123のCONSOLIDATED／MODEL_VERIFIEDはlocal自己申告投影であり資格ではない。また旧spinMotionはV153の方向登録を停止するため、そのまま新版consumerへ接続しない。旧複合motionのattack／pull／depthを黙って捨ててXY記録へ変換しない。

## 必要なSource契約

1. 固定motor記録は技術、本人、clip id／SHA／左右、適用domain、motor版、XY差分、由来を保持する。初版はXY専用と明示し、旧複合motionを自動転記しない。初期値を名前だけで成功扱いせず、既存1cm probe由来ならその不成立と未校正性も保持する。
2. 技術選択から一致する記録を解決し、通常planへXYを一度だけ合成する。旧spinMotionの方向停止・attack／pull処理は新policyでは通さない。通常の方向／心理／clock／誤差／late／速度制約と、ゼロ不変性を保持する。
3. 未資格motorは明示practiceでだけ利用可能とし、通常earned consumerではNO_TARGET。Native R／course-aware資格をL／measuredへ転記しない。local設定からGoldを作らない。
4. 既存practice／Host経路で全試行結果・失敗・未解決を記録する。Rootの同capture分岐対照を別々の独立試行に数えない。独立性は正常な物理投球／機会のidentityから判定し、新ラベルやコピーで増やさない。
5. 評価前にmotor版・対象domain・試行集合・成立基準を固定する。更新に使った試行をその版の独立評価へ再使用しない。実装前に具体的な判定Sourceと必要値を確定し、既存別domainの数値を黙って製品defaultにしない。

## 受入

4技術を選ぶだけで事前固定motorが同じconsumerを通り、同入力NO_TARGETとの比較と独立practiceの判定記録まで残ること。数値入力UIを増やすことを受入にしない。

接触したか、要求成分そのものが成立したか、normalよりその向きへ変化したか、通常方向を保ったかを分ける。baselineが既にTOP／HOOKであるだけでは成功にしない。接触率・未接触・逆方向・未解決を併記し、4技術不成立ならUNAVAILABLEとして残す。評価条件の不足はHOLD。

この単位が通っても、4技術の全domain獲得・人間校正・希少Gold・最終3HTMLの完了ではない。不成立なら必要なmotorモデル／記録を改善して次の独立評価へ進み、選択配線や局所PASSだけでGoalを閉じない。
