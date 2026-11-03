# 配達済み位置だけを使う予測精度の事前固定比較

2026-10-30 JST / MB-20261027-REALISM-DEBUG-PLAN。目的は予測精度を改善し、実接触・回転の不一致を減らせるか評価すること。userの4技術・2試行・成功条件は変更しない。このpilotだけで習得/Gold/製品default採用をしない。

## 観測と比較方法

既定V151 observerはcutoff 140ms/20ms間隔/latency0で最大7点を一時取得するが、予測とsnapshotに使うのは直近3点。点は理想位置でhumanCalibration未測定。実case TOPで同時刻予測と実位置は41.9mm差だが、入射spin/身体誤差/法線や飛行軸も異なり単一原因は未確定。

既存保存済み4技術×2機会を以下の順序とseedで固定: BACK 20261030/31、TOP 20261031/32、SLICE 20261101/02、HOOK 20261102/03。評価前から重複fingerprint BACK2=TOP1、SLICE2=HOOK1は認識済み。8件すべてと、その重複を除く6投球の結果を別々に表示し、8独立投球・獲得根拠とはしない。MISS/NO_TARGETも除外しない。

- 入力は実runtimeがcutoffとlatencyの前に取得し得た同Core Source位置のみ。現snapshotは最後3点なので、保存済みkernel Sourceを用いてcutoff以前の元observer時刻を再構成し、保存3点/旧V151 forecastを全値照合する。Source差/到達不能/入力不足はFAIL/UNKNOWNとして保持し、未来を観測に混ぜない。
- baselineは既存V151直近3点・定加速度のまま。比較Aは末尾最大7点の二次最小二乗、Bは末尾最大7点の三次最小二乗。時間は最新点を0に中心化し観測窓で正規化、直接の不安定な高次正規方程式は使わずQR等で解く。必要点不足・rank不良・非有限・前向きplane交差なし・旧horizon超過は理由付き未評価。window/係数/基準は結果前に固定しseed毎に選び直さない。
- 公平な位置誤差は各slotのbaselineが予告した同一arrival tickで3モデルを比較する。plane到達時刻誤差はそれぞれ予測した初回減少方向の交差時刻を同Core実到達と比較。未来の実球は**結果評価**にだけ使用し、いずれの予測・実運動選択へ渡さない。
- 根拠保存は各slotの値/失敗理由、8-slot集計と6-unique集計のmedian/maxを残す。予備判断ルールは6 unique全て評価可能、6中5以上で位置誤差改善、位置誤差medianがbaselineの80%以下、最大誤差がbaseline最大の105%以下。実行前に固定し、未達でも数値や失敗を保持する。小標本の未校正診断であるため、条件達成でも製品一般の人間知覚や習得精度の証明にはしない。
- 旧3点V151 default・実選手roster・既存RNG/clock/球種・個体差を変更しない。pilotは新module/計測scriptに閉じ、全部の結果取得後、ユーザー機能へつなぐ採否を判断する。

## 受入

入力観測cutoff/latency、旧V151再導出exact、Source/本人JSON/8元artifact開始終了SHA、全8slotと6unique分母、有限性・rank/前向きcrossing・途中失敗を確認する。通常再生のリアルタイム待機や8試合再実行を要求せず、同Chrome・同じ実SourceFreeBallKernelを使う。候補が改善した場合も従来モデルの全記録を上書きしない。
