# V178 球種を広げた実Source検証と不成立

Task `MB-20261027-REALISM-DEBUG-PLAN` Task4。`72494b92e9c84ccbaff074c048adb10b` PASS40234msはruntime/記録整合のみ。品質3段階のPASSではない。

新fastball/slider/splitterの設定例を正規Coreで生成。各通常+3autoの12入力/72 actual Workbench callsを最新Core02の2Core/Main/実Worker/JSONで実行した。21capture/117record/167check、全Source/manifest/pin一致。元V176/177研究の再実行0、返却samplerを保持して共通/own全641点を観測。3grade時計と通常を含む比較時計を分けた。

| 球種 | 近量方向Q | 初期遅延P | 区間短縮D | 終盤比L | own P/D/L |
| --- | --- | --- | --- | --- | --- |
| fastball | false | true | true | false | true/true/false |
| slider | false | false | false | true | false/false/true |
| splitter | false | true | true | false | true/true/false |

slider強p10=.13767863702606495秒が中=.14324048233254738秒より早く、幅も長くなった。splitter強late20=.3583118484334965が中=.3619157765696315より低い。全入力はAPPLIEDだったが、3段階の意味はこの球種範囲で不成立。選択ラベルや実行成功を物理的な段階差の証明へ転用しない。

次はV179事前protocolでslider/splitterのmaterial phaseだけを各8値、spin scale/gyroは保持して比較する。元6状態の実記録を再利用し、新42 Sourceだけ測る。fastballは本人の変化球キレ/family breaking_ball_qualityの対象外で、通常回転を保持する対照へ是正する。ほかの変化球・左・球速・狙い/知覚・実測・最終配送の未完を残す。

原全値/副作用/Source/nominal q/spin/PV/全曲線/判定falseは `kire-preset-domain-v178-01/`。rawを丸めず、旧A screenと旧候補も保持。限定候補V177を全球種の完成版として配送しない。
