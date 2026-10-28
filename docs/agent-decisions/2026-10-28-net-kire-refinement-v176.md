# V176: 固定したnet順序3入力の再利用・通常経路確認

2026-10-28 JST / `MB-20261027-REALISM-DEBUG-PLAN` Task4 Step5/7。本人の「3表示を選ぶだけで適用する」機能へ進むため、V174の事前rankで一度決めた3入力を確認する。旧V171入力/旧FAIL/旧A screenを保持し、選択の差替えや探索拡大はしない。

## 固定入力と既存証拠

V174 `c71a392b612d490494f06ee73c27ecdc` は保存80件だけを新net基準で観測したPASS。近量方向6739組中Q/P/D/L成立2319組、旧A込み0。固定rankは spinScale/gyro/phase = `.04/30/225 → .02/30/0 → .1/30/270`。共通clockの量最大相対差.0040342203726206095、隣接p10遅延/区間短縮の最小.005924013261098704秒、late20増分最小.0025839075810546452。実測/知覚校正・全球種・3選択UIの証拠ではない。

## 順序と測定範囲

1. 保存済みV158/V164等に同じ3入力のdense640/半物理stepがあるか、親receipt・record SHA・descriptor/基準PV/Trefを照合する。存在して一致する記録は再利用し、観測sampleをV172へ渡すだけにする。欠ける組だけを明示してから新測定対象にする。旧Sourceが現Sourceと異なる場合は、変更箇所と適用範囲を示し、単に最新と呼ばない。
2. 通常試投は最新V170 Native/Workbenchの実 `simulatePitcherWorkbenchV77` を用い、既存V168の名目release入力→逆算→既存誤差/workload→実Sourceを通す。同じ球/targetの3設定と直接V78入力の対照、通常へ復帰、ラベルだけを変え物理入力同一の対照を含む。共通PVの固定比較は通常の狙い補正と区別する。
3. 新net observerを同Chrome156.0.8078.49のMain/実Worker/JSON再読で比較する。過去.48とのcross-build同値を主張しない。共通時間と各実plate時刻までの全時系列を実samplerから取得し、own timingの欠測を補う。velocity/position/spin/q/tick/phaseを丸めず保存。groundの実event情報とphaseだけの分類を区別する。
4. 絶対量差2cmかつ相対5%、方向5度を共通clock/own endpointで確認。p10増加・p90-p10短縮・late20増加をそれぞれ確認し、p50/p90順位自体は必須にしない。旧A=.05は参考のまま。狙い補正後に量が変わる場合はraw値を併記し、固定PVの近量性を通常設定へ転用しない。

## 作業判断と境界

新tools/verification入口と新出力だけを作り、production物理・選手原本・既存core exports・旧harness・共有distは変更しない。Source/test/全型/buildの成功結果をこのために反復しない。準備担当とRootの実行を分け、同じjobを二重起動しない。結果が不成立なら固定入力をすり替えず不足を記録する。

受入後は既存trait UIの数値 `effectScale` をキレに流用せず、3状態/通常復帰の選択をversion付き実入力へつなぐ。表示名だけ・倍率だけの実装や、利用者への低水準手入力要求で完了にしない。Core入力/保存形式/通常Matchへ接続する変更は測定結果を根拠に別の最小差分とする。
