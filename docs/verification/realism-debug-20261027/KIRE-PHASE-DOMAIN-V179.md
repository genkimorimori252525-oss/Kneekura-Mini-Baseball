# V179: 2球種の姿勢比較と不成立

2026-10-28 JST / `MB-20261027-REALISM-DEBUG-PLAN` Task4。

実行receipt `3cb32be7e112492595ce667e4a749a49` はPASS19485ms。これはSource再利用・正規Ownerとの一致・runtime/記録整合のPASSであり、キレ3段階の成立ではない。

最終prepare02 `f9b51d5bb4e544328109ab8b6379419b` とpacket SHA `e7072d8120c2d7a9a5a1f265f926c1fcdcb4ae6f1cc63e87d7f1f1daa63d69aa` を一度実行。Native216/9904009bとWB193/784b6eaaのCore03、Chrome156.0.8078.49を固定した。

- slider/splitterのscale .04/.02/.1・gyro30は保持し、材料phaseだけ8値ずつ比較した。
- 48入力のうち保存済み6入力を再利用し、42入力だけ新しい共有SourceKernelで計算した。Main/実Worker/JSONの126 Kernel計算、正規Owner2入力の12 Workbench呼出し。
- 全6件の親descriptorを新Source計算前にChrome上で厳密照合した。通常Owner対照ではdescriptor、own時計、common/own各641点、net観測が厳密一致した。
- 54capture/168record/266check。自身のWorker blob1要求、外部通信0、page error0、全pin一致。旧V176/V177/V178実測、成功済み型/build/UIの再実行は0。

| 球種 | 全組合せ | 両時計の近量・方向Q | 共通Q/P/D/L成立 | 共通+own候補 |
| --- | ---: | ---: | ---: | ---: |
| slider | 512 | 9 | 0 | 0 |
| splitter | 512 | 4 | 0 | 0 |

両球種とも選択結果はnull。絶対量2cm・相対5%・方向5度、p10増加・10–90%幅短縮・終盤20%比増加、commonとownの条件、事前rankは変更していない。旧A screenも参考値のまま保持した。

保存結果だけのgate診断では、全512組のcommon P/D/L成立はslider113/115/102、splitter99/98/57。ownは106/108/102と99/100/57だった。Q成立9/4組に限定するとsliderはcommon/ownともP0/D0/L1、splitterはすべて0。逆に両時計PDL成立45/38組は、すべて両時計の量差2cmを超過した。全組がavailable/withinで、ground/classification除外は0。単に観測不能だった結果ではない。

この結果は「固定scale/gyroの3状態にそれぞれphaseを割り当てる今回の領域」での不成立を示す。あらゆる物理入力で不可能という証明にはしない。V177の万能recipeを完成扱いせず、保存結果のgate別診断から次の入力設計を決める。Source/UIはこの検証では変更していない。

その後の入力監査で、V177の2–10%低回転は元の球種を保つ保証がないことも確認した。普遍recipeの採用を撤回し、低回転入力の役割を並べ替えて採用する案も採らない。次は `../../agent-decisions/2026-10-28-kire-base-preserving-v180.md` により通常PV/全spinを保持した材料姿勢の限定研究へ是正する。旧Source/候補/局所成立例は履歴として保持し、旧保存の意味を黙って変えない。

原全値・全512組×2・false・q/PV/spin・全曲線・入力pinは `kire-phase-domain-v179-01/`。準備01/02と旧V178のfalseも保持する。
