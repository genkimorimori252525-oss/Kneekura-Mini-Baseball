# V180: 通常球の全回転を保つ材料姿勢比較

2026-10-28 JST / Task `MB-20261027-REALISM-DEBUG-PLAN` Task4。receipt `fbe53dd7878b404c85eb3256f98215d2` PASS16922msはruntime/記録整合のみ。キレ3段階は今回の範囲で不成立、候補は両球種ともnull。

事前設計は `../../agent-decisions/2026-10-28-kire-base-preserving-v180.md`。prepare01 `06d5655626624dd68895b63aed4b1251` PASS1359ms（Chrome0/Source0/18比較exact）、packet SHA `dc36b7d71f7b779bae42b9bc7ed413243f4d7cace4b5e371194cdd0068dd767b`。設計/実装の独立read-onlyレビュー後に一度だけ実行した。

## 実行範囲

Native216/9904009b、WB193/784b6eaaのCore03とChrome156.0.8078.49を固定。slider/splitterの通常release PV・全spin・物性・profile・風・Source時計/horizonを保持し、q0*Rx(a)*Ry(b)の16姿勢ずつを比較した。a/bは各0/90/180/270度。identity2件は通常球の保存own641点を再利用し、qを再正規化しなかった。

新30入力のうち先行2入力をcacheし、正規Owner2対照（12 Workbench呼出し）でdescriptor・own時計・common/own各641点・netが厳密一致した後、残り28入力へ進んだ。共有SourceKernelのMain/実Worker/JSONは90計算、旧identityは新計算0。38capture/120record/219check、全pin一致、page error0/外部通信0。旧成功試験/型/build/UIの再実行0、Source/UI/物理係数変更0。

共通Trefは通常球のown時刻でslider=.45599650272497944秒、splitter=.46571708444211724秒。各候補のown時計も別途観測し、commonTimeFollowsOwnPlaneを保存した。common延長は同Sourceの同経過時刻であり、捕球後の実世界軌道ではない。

## 判定

通常を第0段階とし、通常→○→◎→金の4段階を判定。全6pairの両時計Q（量差2cmかつ相対5%、方向5度、分類可能/実groundなし）、common/own双方のp10増加・10–90%幅短縮・終盤20%比増加を要求した。全3360役割列/球種、事前rankとfalseを保存した。

| 球種 | 全役割列 | Q成立 | 共通Q/P/D/L成立 | 共通+own候補 |
| --- | ---: | ---: | ---: | ---: |
| slider | 3360 | 336 | 0 | 0 |
| splitter | 3360 | 24 | 0 | 0 |

sliderは共通P/D/Lそれぞれの成立自体が0列。splitterは共通P202/D186/L162、own PDL64列だったが、Q成立24列ではP/D/Lそれぞれ0。条件や知覚閾値を結果後に緩めていない。

全16姿勢の通常比own終点raw診断も保存した。最大位置差はslider .1399432933723557m / splitter .16022027461020588m、最大到達時刻差の絶対値は .00029115180516664507s / .00030285458651935215s、最大速度差の絶対値は .030356772897590645m/s / .027881051901204046m/s。これは全姿勢の診断であり、採用候補の値ではない。Qだけを同じ到達位置の保証にはしない。

## 次の扱い

この16姿勢断面はSO(3)全体でなく、物理的不可能を証明しない。p10は各軌道の最終変位に対する10%時刻であり、力/知覚の開始時刻ではない。今回の有界研究で通常より終盤集中する3段階を得られなかった事実を、Task4のモデル/入力不足UNKNOWNとして保持する。

protocol通り追加gridは停止する。旧V177低回転recipeの普遍採用撤回も維持し、低回転の名札再割当て・係数増幅・任意timer・手入力への差戻しで完成扱いにしない。今回Source修正/製品採用なし。独立したTask5のラインドライブ測定→表示joinを次の一件とし、キレ3段階/全球種/左/実測/通常保存・Native/最終配送と全goalは未完。

原全値・入力/aux/Core pin・先行対照順序・全3360列×2・false・全曲線は `kire-base-preserving-v180-01/`。prepareと旧V178/V179のfalseも保持する。
