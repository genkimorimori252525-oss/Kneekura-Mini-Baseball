# V179: 不成立2球種の姿勢だけを有界比較する

2026-10-28 JST / `MB-20261027-REALISM-DEBUG-PLAN` Task4。V178/72494b92は21capture117record167checkのruntime整合PASSで、品質はfastball/slider/splitterすべてQPDL=false。sliderは強のp10 .13767863702606495が中 .14324048233254738より早く、幅も長い。splitterは強late20 .3583118484334965が中 .3619157765696315より低い。旧prototype/旧FAIL/falseを保持する。

## 次の物理入力と固定規則

対象はslider/splitterだけ。現3状態のspin scale .04/.02/.1とgyro30を保持し、各状態のmaterial phaseだけ0/45/90/135/180/225/270/315度の8値を比較する。各球種24入力、2球種48入力。V178の各状態の実release descriptorを元にqだけを変える。該当する元225/0/270度の6件は、親receipt/record/hashと時計が一致すれば再利用し、42件だけ新しい実Source計算を行う。球物性/係数/Source時刻/能力を変更せず、力のON/OFFや結果補正を入れない。

元名目逆算はseamを除いたmean airでqによるseam偏差を相殺しない。従って姿勢だけの変更は元状態のrelease PV/spinを保持する。共有SourceKernelによる新qの比較を使う場合は、現Coreの正規V168明示入力で少なくとも異なるphaseの2対照を実行し、descriptor/全sampleの厳密一致を確認する。別simulatorや仮の実球を使わない。

共通TrefはV178で保存した各球種3状態の最小own時刻へ事前固定。各own終端も分け、共通/ownの実Source641点とnetを観測、実ground履歴で分類する。単一の新Sourceで両時計を読む。元6件の時計/seriesが一致しなければ再利用と称さず、不一致を先に報告する。元のsnapshot/nominal入力・mean solver・material basisの関係を保存し、何を再利用したかを限定する。

各状態から1入力ずつ選ぶ全8³=512組/球種を評価。絶対量差2cmかつ相対5%/方向5度を両clock終点で維持し、共通p10増加/幅短縮/late20増加を別判定。own全時系列も取得可能なので、own P/D/L成立を候補条件へ加える（実測前の入口固定、後からの再選択を避ける）。順位は共通時計の最小の隣接p10遅延/幅短縮を最大→最小late20増分を最大→最大相対量差を最小→phase数値tupleの辞書順で一度固定。旧A=.05は参考で、新知覚閾値を作らない。own timingのraw順序も別記録する。

## 速球と今回の境界

本人依頼は変化球のキレ、familyもbreaking_ball_qualityである。fastballは本技能によって元の速球回転を変える対象ではなく、通常/3指定の物理が同じであるべき対照として扱う。この判断は無関係な非対応ラベルを増やして完成にするものではない。速球への現V177変換は是正対象、slider/splitterおよび残る変化球/左/球速等は継続対象。新しい球種別recipeを採用する前に元Sourceとの関係と通常Owner/保存/実測範囲を確認する。

準備担当は新aux/harness/outputだけ。production/UI/旧harness/Source/test/型/buildは変更しない。Source変更は現UI試験がterminalになった後に別の最小差分で行う。限定候補V177を全球種の完成版として配送しない。
