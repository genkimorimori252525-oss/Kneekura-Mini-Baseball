# v83要求：全体FPS・画質・人間らしい移動（設計確認待ち）

人間の最新依頼: 全体FPSを2倍、画質1.2倍。投球/打球等の既存個別倍率を全体倍率へ乗算して継承する。車のような発進・ローラースケート状の制動/切返しを改善し、軽量な二足の制御に移動処理を差し替える。人間の運動に不明点があればWeb研究を参照。

2026-10-20、この記録作成時点では**読取監査と設計提示のみ**。人間が提示したAGENTS.mdの大変更前確認ルールにより、次の2問を非同期提示済み。承認や選択結果を推定しない。製品コード/生成物/設定/lockfileは未変更。

1. 全体の目標描画頻度2倍、同構図の空間サンプル密度を縦横1.2倍（4px→10/3px相当、画素/セル数約1.44倍）、既存PNG/色/UI維持、軽量な接地/制動のlive移動置換と予測・回避の整合、通常/lab/makerへ反映する案。別選択肢は4pxを維持してFPS/移動のみ。
2. 投球の現行実効2.5倍を維持し、打球の旧追加2倍も有効化する案（推奨）か、打球は現行実効1倍のままとするか。

## 監査で確認した境界

- 現行v81通常/lab、v82maker。通常cadenceは55/3ms、自由投球22/3ms。全体2倍なら55/6ms、自由投球22/6ms。単一RAFと処理時間が上限。目標頻度と実測FPSを分ける。
- 古い投球2.4倍/打球2倍の宣言は残るが、現行liveは旧再生を停止する。現実働は2.5/1であり、旧値を実効値と誤記しない。
- backing Canvasは1200x864、論理600x432、transform2、論理4px格子。backingを2.4へ増やすだけでは世界の細部は増えない。格子細分化は全layer/深度/遮蔽を同時変更し、整数セル番号から境界を求める。物理位置・ボール寸法やカメラ構図の倍率へ流用しない。
- 今回の意図的な画質差はv81の4px/画素一致規約への例外として承認後に記録する。画質1.0の旧画素一致は別に保護する。既存cache/全673/全scene同時刻は継承。個別の球のみ描画しない。
- DefenderMotionは一定aの速度ベクトル追従でlive callerのb=a。走者は一定a/巡航/一定b。v40 actor表示はspeed>0で時刻固定2ポーズで距離と非同期。
- DefenderMotionはNative/hostでも共用、パラメータ完全一致や定加速度segmentの証拠契約がある。無条件に共用Nativeを置換せずlive専用helperを明示接続する。予測/実移動/停止距離は同じprofileを参照し、少数速度帯の解析区間を優先。intercept各候補への高精度再シミュレーションは負荷が増幅する。
- role ETA、intercept ETA、runner advance/retreat、LiveFielderAvoidance、run-through/フェンス停止を連動させる。ETAからOUT/SAFEを作らず、実際のtouch/保持から既存裁定が判断する。
- 一塁駆け抜けと塁上停止を区別。新規pose/artは追加せず、既存足画像の移動距離同期を表示側で扱う。既存topSpeed/acceleration/reaction/旋回半径/横加速度/技術による個性を残す。

読取監査の主なsource: `presentation-cadence-performance-v81.mjs:6`、`maker-match-renderer-v81.js:99`、`DefenderMotion.ts:134-190`、`LiveFieldPlayV1.ts:462-501,777-792`、`LiveRunnerMotionV1.ts:146-175`、`LiveFielderAvoidanceV1.ts:45-46,133-157`、`v40-live-actor-animation.js:62-77`。`.codegraph/`無し。

研究参照（係数を実測校正済みと主張しない）:
- Morin et al. (2015), Sprint Acceleration Mechanics: https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2015.00404/full
- Effect of Approach Distance and Change of Direction Angles (2020): https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2020.594567/full
- Ficklin et al., running through/sliding/stopping comparison: https://pmc.ncbi.nlm.nih.gov/articles/PMC6188574/

## 承認後の検証案

倍率/表示時計/継承倍率の機械試験。描画設定のみなら同seed/Core history不変。新移動は意図的に接触時刻/結果が変わるため旧history完全一致を求めず、速度/位置連続、支持/制動/横加速上限、ETAと実接触、駆抜け/停止/反転/旋回/フェンス/安全距離、実touchのみ裁定を検証。通常9回完走と保存往復、各視点/左右/捕球境界/逆seek/resize、画質1.0旧RGBA一致と1.2全layer整合、PC/390幅・DPR1/2の実FPS/負荷を確認。

元Charter独立承認HOLD、Native認証・100試合校正・実機等の未完/旧FAILUNKNOWNを保持。dirty AGENTS.md/AGENTS.md.bak/.agents/旧dist等に触れない。

後続の明示依頼により、v83通常HTMLはHR見送り時間の限定修正へ先に割り当てた。FPS/画質/接地移動の2問は未回答のまま保持し、その実装と次版番号は回答後に扱う。HR限定変更をこの大改修の承認とみなさない。
