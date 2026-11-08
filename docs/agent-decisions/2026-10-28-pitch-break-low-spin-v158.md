# V158 実行前固定：既存Sourceの低回転64条件

2026-10-28 JST / root / MB-20261027-REALISM-DEBUG-PLAN。V157の一次資料の部分読取・QAはprogress。全goalを保持し、Task4 Step5内で既存法則の適用範囲を先に確認する。これは同モデル内の検証で、人体のキレ知覚・新測定モデルの採用・一般不可能を認定する試験ではない。

## 固定した入力と因子

基準はV156-02の公開curve/level4/seed3/zone/誤差0の保存input/contextとoriginal Source descriptor。元PV、origin/horizon、重力、ground、風、係数、保存seam/spinDecayを保持する。元選手JSON/元スイング/共有distを変更しない。基準を別seedや狙いで再選定しない。

64条件は `spinScale=[.02,.1,.3,1] × gyroDegrees=[0,30,60,85] × materialPhaseDegrees=[0,90,180,270]` の全直積。gyro0は相対風速に垂直な平面から測る。元spinを相対風速の垂直面へ射影した方向をtransverse方向とし、その方向cos(gyro)＋相対風速unit sin(gyro)を新軸にする。元spinの大きさにscaleを掛ける。元spinと相対風速が平行/ゼロならこの基底は未定義として拒否する。

材料位相はcase軸のworld quaternionをsaved材料q0へ左積する。phase0では元q0を保持する。これは既存球の姿勢を回す制御であり、thesis位相0を実Sourceへ同定した操作ではない。従って原図の位相や回転向きとの一致を主張しない。

共通nominal stepは元Sourceのseam-resolved step（1083tick予定、実値はresolverから取得）、全caseの実効step一致をassertする。物理半stepはfloor(step/2)。次の3runを固定する: (160観測区間,元共通step)、(640観測区間,元共通step)、(640観測区間,半step)。観測密度と物理刻みの効果を分ける。元nominal5000対lab1083は異なる宣言入力であり、旧V156と同じくbit完全一致を要求しない。

## 比較と判定

共通Trefは元Workbenchの到達時間 `.5208445873798196` 秒（実値厳密照合）。主比較は同PV・同Trefのairless-gravity差。副比較は各球の同じ本塁planeに対する共通gravity差。実kernelのground境界、未到達、非単調、微小量は生値/理由を保存し、percentを捏造しない。

全64caseの2016対を、両基底で量差**絶対2cm以下かつpair平均に対する相対5%以下**、方向差5度以下として分類する。V156のmax(floor,相対値)と混同せず、絶対/相対/方向の個別booleanと差を保存する。相対分母が微小なら不適用とし、量の打消しを大きいキレへ昇格しない。

候補screenは分類可能な近量/近方向対の `abs(Δp50/Tref)>=.05 OR abs(Δlate20)>=.05`。両基底の両case量が全て10cm以上かをlargeAmountBandとして別に報告する。割合の候補、10cm以上の候補、物理キレの完成は別。閾値は事前screenであって実験校正・人の知覚閾値ではない。全候補を保持し、seed選別/後選択で閾値を変えない。

## 実行と検証

Source kernelと既存V155 observerだけで飛行を計算する。新solver/力のtimer/結果buffは追加しない。referenceは保存inputから同ChromeのWorkbenchで再計算し、元descriptor/Tref/planeと元161samplesに全値一致させてから使う。

Main/実blob WorkerとJSON復元のcaseごとの全記録を厳密比較する。64case×3runを1巨大payloadにせず、caseごとにNodeへ保存しSHA/byte数を記録する。小さいcomparison配列から全pairを解析する。3runの全caseの感度と候補IDのintersectionを報告し、候補分類一致だけを収束認証/STABLEとは呼ばない。

factoryとpair基準を独立fixtureで先にRED→GREEN。関連型検査と既存V156/観測試験も実行する。旧Source/aux tool/候補/元JSONのpinsを保持する。新しい研究toolは別bundleへ追加し、既存V155 Makerのbytesを変更しない。

root所有は新factory/observer/analysis tool、protocol/記録とintegration test、runner担当は新V158 runnerのみ、別test担当は新V158 unit testのみ。共有workspaceで他者変更を戻さない。新依存なし。復旧は新研究tool/outputを外すだけでgame Source/旧snapshotへ影響しない。

測定profile側の不足（参照force条件・完全q0・欠損/周期端・lateral DC）は別担当が取得済み一次資料だけで限定確認する。未支持domainを黙って埋めない。Task2/3・V154・SPIN/Native・旧V122/V148・性能B/9回/同版配送・SIGN命名のペナント延期は継続し、全goal ACTIVE。
