# V174事前固定: 保存80件を実軌道基準で再観測

2026-10-28 JST / `MB-20261027-REALISM-DEBUG-PLAN`。V172の数学的反例に加え、V171固定3件を保存sampleだけで再観測した170fa70bで、実net late20が .34870821277112557/.3474639447925034/.34771109864648747となり段階順が不成立だった。旧の誘導空力p10差約10msに対し最初のnet p10差は約54μs。旧資料や選択を変更せず、V171の追加flightは起動しない。

## 新しい問いと範囲

新categoryは `NET_INITIAL_TANGENT_TRAJECTORY_ORDER_RESEARCH_ONLY`。保存80件の実Source sampleを新V172へ通し、初期接線垂直平面における実軌道の時間分布を比較する。旧重力基準・A screen・旧candidate0・V171固定3件は保持し、新metricの結果を付け替えない。新flight/旧Source再実行なし。

共通P/V/Trefが同一であること、親receipt/record/hashを確認。各到達断面の実platePosition/flightSecondsが保存されている場合は、同じ初期接線に対するendpointの量/方向だけを計算する。own-planeの全time seriesがない場合は、own timingを未測定と明記しCLASSIFIEDを捏造しない。ground情報が不足する場合もUNKNOWNとする。

## 比較と選択規則

- common-timeの新net statusがCLASSIFIEDであること。量/方向は共通時計と取得済みown endpointの両方で、従来と同じ絶対2cm/相対5%/方向5度を維持する。
- p10増加・p90-p10短縮・late20増加を別条件として全組を評価する。旧A=.05は比較用screenであり、判定/知覚要件へ無言で昇格させない。
- 次へ回す入力がある場合は、隣接p10遅延2つ/区間短縮2つの最小値最大→隣接late20増分最小値最大→最大相対量差最小→ordered IDs辞書順で一度rankする。新しい閾値や技能認定を作らない。

80件/全組の生値・分類・欠測と全判定を保存する。小さい差/旧screen未達/own timing未取得/知覚と実測未校正を保持し、UI採用可否はこの観測だけでは決めない。正しい観測基準の確立が目的で、合格を得るために旧gateや旧選択を変更する作業ではない。
