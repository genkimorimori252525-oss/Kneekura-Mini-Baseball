# V162 実行前固定: キレ3選択の実Source

2026-10-28 JST / MB-20261027-REALISM-DEBUG-PLAN。V161の観測対応実装/検証後、本人追加のTask4 Step7を進める。共通CCG/方向UI/V161本人caseを理由なく再調査しない。

## 既存証拠と不足

V158の64条件/2016対で時間差screenを通った辺はA/Bの1対。現格子から3段階を実証できない。A/Bはcurve4/seed3、低回転約44/220rpmの条件に限られ、Aを通常の狙い補正PVへ替えたV159では量差が相対約9.2%となり元5%条件を外れる。全球種へ固定presetを流用しない。

表示は本人指定の「キレ○／キレ◎／脅威の切れ味◎」。選ぶだけの操作を実装するには3段階の実入力が先に必要で、名札変更/結果角の補正/時刻による力ON/OFFへ置換しない。在庫breaking_ball_qualityのUNSUPPORTEDを名前だけで解消しない。

## 次の有界case

- 既存 `tools/verification/pitch-break-low-spin-v158.ts` と `check-pitch-break-low-spin-v158.mjs` の純粋なSource生成/計測/既存screenを再利用し、新しいV162専用entry/outputを作る。V158の関数/64条件/旧出力を上書きしない。
- curve4/seed3、**V158で保存した共通release P/V・Tref・重力基準**を使う。Aを狙い補正したV159の別PVへ黙って置換しない。通常5000tickで実行し、以前のlab1083tickとの差を完全一致としない。
- spin倍率 [.02,.04,.06,.08,.1] × gyro30度 × 材料位相 [0,45,90,135,180,225,270,315]度の全40条件を事前固定。利用者へ手入力させる仕様ではなく、選択肢の裏付けを得る開発用caseである。
- 全40行、全780対、全9880の3入力組を扱う。変化量/方向の近さと、隣接する2段階の時間分布差を既存screenで評価する。既存screenの正確な式はSourceから取得して固定し、都合のよい組が出るまで閾値を変更しない。非単調/微小/ground/未分類はrawと理由を保持する。
- 3入力が成立した場合だけ観測密度/半stepの限定確認、保存入力→通常authoring→狙い補正PVでの確認、同Chrome/実Worker/JSONへ進む。元PVだけの成立を、任意球種の3段階完成にしない。
- 3入力が成立しなければ当該モデル/入力域の不足として記録し、適用されたように見せるUIを出さない。次は不足する物理Source/実測境界を具体化し、他の独立した残件は止めない。

接続先は `PitcherWorkbenchV77.ts`→`LivePitchV1.ts`、保存は `LivePitchAuthoringV78.ts` のspin/q/seam、位相操作は `PitchMaterialPhaseV159.ts`。球別の実入力を物理の唯一の所有者とし、trait名と物理の二重適用を避ける。3選択の保存表示/即時適用/通常復帰・通常試合までを含むTask4 Step7は未完のまま。

新しいcase/entryだけで開始し、新依存・原本変更・旧結果削除は行わない。全goal、人体/Native/SPIN/旧残件・性能B/9回/配送・SIGN延期・最終設計GitHub照合を保持する。

## 実行前の型/判定/搬送の具体化

V158のCase型が旧const-gridから推論され新しい.04/45度等のmetadataを表せないため、研究用のCase alias 1行だけを数値の構造型へwidenする。descriptor型・実関数・protocol・64条件・旧出力は変更しない。新entryは旧計測/analyzerを委譲し、production物理を追加しない。

3入力の全pairが旧matchedAmountAndDirectionを満たし、late20とp50/Trefが同じ順で厳密増加し、隣接2pairが旧timeShapeCandidate（p50差>=.05 OR late20差>=.05）を満たすことを採用条件とする。10cm以上のlarge bandは別に報告する。候補があればそのID和集合だけをdense640/半step2500で再確認し、旧40全行の不必要な再撮影を避ける。nominalは全40/780/9880を保存する。

新harnessは現Native/WB Source pinを正本にし、旧V156/V158基準を現Coreで全161標本まで厳密再読する。旧Core hashとの同値を装わず、基準から変更されたSourceはV161のLivePitch/既存contact plannerだけと記録する。Chromeは156.0.8078.48。caseを1件ずつ4MiB上限、全分析を16MiB上限で搬送・保存する。private JSONは使わない。
