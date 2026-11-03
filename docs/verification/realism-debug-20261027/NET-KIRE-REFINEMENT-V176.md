# V176 固定net3入力の細分・通常Owner実証

Task `MB-20261027-REALISM-DEBUG-PLAN` Task4 Step5/7。`f90c5070aec44750af32d7214fe7c92b` PASS27563ms。同Chrome156.0.8078.49、最新V170 Native214/Workbench191、25capture/157check、Source/入力/manifest/codeの終端pin一致。

## 固定入力と再利用

V174で一度選んだ `.04/30/225 → .02/30/0 → .1/30/270` を保持。4保存refinementは親receipt/record SHA/descriptor/PV/Trefと重要Sourceを照合して再利用し、phase225のdense640/half2500だけ2件を新計算した。最終準備packetは `net-kire-refinement-v176-preparation-03/preparation-packet.json`、40eb4cfe PASS。01/02は実行前harness修正の履歴で、使用していない。

固定PVのnominal/dense/halfすべて、共通時間のp10増加・p90-p10短縮・late20増加、共通時間とown endpoint両方の絶対2cmかつ相対5%/方向5度を満たした。旧A screenは3runとも未達のまま。固定PVのown全時系列は保存欠測のため未測定を保持し、通常側の測定へ付け替えない。

## 通常の狙い補正と実Source

公開 `simulatePitcherWorkbenchV77` のV168名目plan→既存逆算→再現誤差/workload→同じSourceを使用。2Core×Main/実Worker/JSONの10入力、60 actual Workbench callsを比較した。名目planは直接V78設定とSource/sampleが一致。labelだけ変更した2対照は物理不変、null復帰も実Live出力とsampleが一致。保存inputの明示null1fieldだけは省略との差をraw保持した。

同じtargetを狙った3球は実release velocityが異なるため、固定PV研究とは別評価。実返却samplerを保持して試投を増やさず、3球の最小own到達時刻まで共通641点と各own641点を取得した。方向比較は異なるU/V基底を混同せずworld normal vectorを使用。直接V78の全共通/own系列とnet観測も厳密一致した。

通常側も共通Q/P/D/Lをすべて満たし、own全時系列でもCLASSIFIED/P/D/Lが成立した。共通時刻の最大量差.008253653350464463m、最大相対差.0060616460609804095、最大方向差1.7426388313460675度。新observer自体のMain/実Worker/JSON一致もこの実行で確認した。

| 入力順 | net p10秒 | p90-p10秒 | net late20 |
| --- | --- | --- | --- |
| .04/30/225 | .15324235222198532 | .3398835221171935 | .34896389991289345 |
| .02/30/0 | .16025310080116992 | .3330755306392368 | .3512057290129914 |
| .1/30/270 | .16559662452772378 | .3279999160319721 | .3578493865428758 |

## 適用範囲と次の実装

p10は最終偏差の10%到達指標で、無力期間・力の開始・知覚時刻そのものではない。これは現モデルと固定prototypeにおける実入力3組の証拠。実測投手/知覚校正・任意の選手/球種/球速/targetでの3段階・Native技能認定・3選択UI/選手保存/通常Matchは未完。

次は3選択から既存の名目spin/qを自動生成するversion付きrecipeを最小差分で実装する。元q/左投げ/既存plannerの名目方向とwind/ゼロspin/旧保存の扱いを先に固定し、球の物性・空気・seam係数や打者/打球結果は変更しない。未指定は元設定へ戻す。数字手入力を利用者へ戻さず、選択→実Source→保存/再読/試合の接続までを完了条件にする。

全raw/descriptor/PV/own到達時刻/全曲線/差分/pinは `net-kire-refinement-v176-01/`。原V171/旧基準/旧A/FAILと旧候補は保持。Source production/test/既存Core graph/共有distの変更とSource commit/pushは行っていない。
