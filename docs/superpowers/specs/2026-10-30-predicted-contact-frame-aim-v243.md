# 配達済み予測の接触面から4回転の運動候補を選ぶ

2026-10-30 JST / MB-20261027-REALISM-DEBUG-PLAN。Root採用判断: Astraの限定reviewに基づき、新しい明示opt-in版だけ上限付きfull3D接線aimを扱う。旧V238 worldXY/Δz0と通常経路は保持。本人の固定HOOK2試行は0/2のまま。新候補の狙いを既存の実接触・摩擦・空力へ通す。

## なぜ新しい座標系が必要か

接触法線nについてδ·n=0とδz=0を同時に課すと、一般には1自由度しか残らない。world−XをHOOKと同一視せず、予測飛行基底の目標スピン軸sと予測法線nから2自由度の接線面を構成する。ただし並進δの符号がトルクの符号を保証するとは扱わず、有限候補を既存Coreの予測接触応答で評価する。

## 最初の実装単位

新しいstateless plannerと既存V153の予測接触Coreを使うadapter。新Ownerや記録蓄積基盤は作らない。この単位だけではMakerの4回転完成としない。次の単位で同じ候補をLiveの名目登録後/aimError前へ一度だけ合成し、既存episode Ownerの新明示motorとして保存する。旧fixed XY motorの意味は書き換えない。

- 入力は現在cutoffまでに配達されたp/v/aと原clip・bat/ball形状・既に選択済みnormal登録/yaw/clock。実future球・実contact・実exitSpin・結果は選択へ渡さない。
- 元normalの予測接触normalと予測responseのflight frameを変位前に固定。BACK=-right、TOP=+right、HOOKはR:-up/L:+up、SLICEは逆。飛行forwardを目標spin軸と混同しない。
- 候補は投球前に固定するversioned policy。最初の診断policyは最大2cm、半径は上限の1/3・2/3・全量、接線の±2基底/±正規化対角の8方向とzero reference（25点）。seedや実成否で候補/上限を変更しない。人間校正値とは称さない。
- t1=normalize(n×s)、t2=n×t1を候補生成の基底にできるが、正負どちらも評価する。||δ||上限とδ·n≈0、有限性を検証。退化、配達不足、基底未定義、探索未解決を理由付きNO_TARGETにする。候補で見つからないことは物理的到達不能の証明ではない。
- 各候補は測定スイングの配置をδ移動し、原heldと接続するpreparation/recoveryを既存createReferenceBatKinematicsV1で再生成して既存first contact探索/resolveを実行する。全poseのwrapper並進で原heldを動かさない。元yaw/clock/rawclip/身体/運動制約を変えず、接触時刻を合わせる再登録をしない。 探索範囲は配達済み予測のavailableTickから、元の正常motionのmotionThroughTickV133（無ければ元clip最終Source tickのworld時刻）までの有限範囲とする。基準運動のnominal contact tickで並進後の探索を打ち切らず、実結果に合わせたclock/終端延長も行わない。予測contact不成立や既存制約違反をspinの大きさで救済しない。
- V153の入射spin0は未観測のモデル仮定を保持し、結果に明示。観測/校正/資格/実成否の保証へしない。
- 評価は既存observeBattedBallSpinV123の同じ成分を使う。normal予測対候補予測の正成分と改善を、事前宣言した必要値で判定。認証できた適格候補の中で要求成分の大きい順、同値では小さい変位norm、最後に固定候補ordinal。選択範囲をCERTIFIED_ELIGIBLE_CANDIDATES_ONLYと明示し、global optimum保証はfalse。未解決候補の数・理由と、明確な制約超過/非closingの除外理由を保存する。未解決候補があることだけで他の認証済み運動を全拒否せず、適格候補が無い場合は理由付きNO_TARGET。未来実績やseed探索で選び直さない。
- 無指定/zero/NO_TARGETではnormalをそのまま保持し、RNG消費・誤差・late correctionは後段の通常経路のまま。接触・摩擦・空力Coreと結果spinは変更しない。

## 受入と次への境界

傾斜法線でnonzeroΔzを含む接線性/上限、両打席・複数飛行方向の4技法軸、外積の符号と並進非保証、退化/未配達/未接触、固定policy決定性/安定tie-breakを検証する。既存予測Coreを使うadapterではnominal登録/yaw/clock/rawSource保持と有限探索、同cutoffで未来actualを変えても入力/候補/選択不変を確認。関連失敗を保持してからLive/Owner/Main実Workerへ進む。

Live配線、Maker選択、実normal対trial接触/弾道/空力、4技法の成立・反復・Native資格・Gold・最終3HTMLは次単位の未完。局所plannerのPASSを配送へ昇格しない。

## 2026-10-30 実装レビューでの整合

V243初期14testsは通過したが、実Coreの非zero選択は未達だった。a55ba3bc／e5d0125cの失敗を保持。独立Solは、既存V153が未解決候補を残して認証済み候補を選ぶのに対し、新adapterがlimit拒否までUNRESOLVEDへ潰して全候補を拒否する不整合を確認した。また元nominal contactまでしか探索せず、並進によって遅く接触する同じ原clipの運動を評価対象外にしていた。上記2点を修正する。これはuserの4回転成立・必要試行数・正成分・改善等を緩めるものではなく、同じ有限運動の予測範囲と順位の保証範囲を明確にする実装判断。未来実測の逆流/seed探索/数値閾値の引下げは行わない。

Astra新実装レビュー: whole-pose wrapperはheld自体を動かし、元の証明値を引き継ぐため予定Liveと異なる運動だった。原held/recovery終端poseと時計を保ち、transform.translation+δから既存referenceを生成して全証明を再計算する。同入力のpositiveでも旧wrapperの結果はLive適合証拠にしない。
