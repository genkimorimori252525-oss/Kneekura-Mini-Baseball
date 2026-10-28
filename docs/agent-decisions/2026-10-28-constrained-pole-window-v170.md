# V170: wall-support後の有限no-contact window

2026-10-28 JST / `MB-20261027-REALISM-DEBUG-PLAN` Task5。最新V148の未完である同円形fence/constrained wall-pole/near-zero control cutを進める。旧free-flight/V147 Native/認証DBの検証は再実行しない。

## 確認した欠落

`LiveFieldPlayV1.ts` のwall-support採用後は `createGroundWallRollingCurveV1()` を使い `freeScope=null`になる。poleあり・非保持のconstrained motionは、遠方poleでも現在時刻の `constrained_pole_motion_not_supported_v148` へ無条件停止する。既存V148 pole testにwall-support後のconstrained caseはない。これは公式法的規則や実測球場寸法を待たずに局所的な物理windowとして検証できる。

## 実装境界

対象は実rolling curveのcell/boundaryを使った有限な「poleへ到達しない」windowだけ。free-flight descriptorへの偽装や、未検証の接触/拘束反応は作らない。実arcについて保守的な距離下界を得られる場合だけ短い正のwindowを採用し、近接/曖昧/境界競合では従来のunresolvedを保持する。原clock/積分格子/ground消散・実actor/control/event順を維持する。

まず担当workerが実cellの形式・利用可能なbound・最小反例を限定読取し、計算式/対象window/既存保証を提示する。その根拠が確認できるまでSource編集しない。根拠確認後の最小Source/test追加は依頼範囲内の通常判断で進める。

## 読取後の実装判断

GroundDynamicsでは滑走velocityが一次式、rollingは一定方向の減速、restは0であり、cellは相転移で分割される。接線速度の絶対値には端点と既存消散項の上界を使える。各cell/poleのL∞距離下界から半径和・速度上界×時間幅・位置丸め予算を引き、全gapの下界が正の場合だけno-contact windowを通す。

計算は距離/gapをnextDown、時間差/移動量/半径和/誤差予算をnextUpへ向ける。追加位置予算は既存Coreの256EPS数値モデルに、circleのradius/center・初期位置・ground移動尺度を含める。端点world normだけではoff-center相殺を覆えないため、その値へ新保証を無条件に載せない。任意JS実装の厳密数学保証やNative認証とは称さない。同じCore/Chromeの数値モデルに基づく局所windowであり、非有限/overflow/不明は旧unresolvedを保持する。

この限定方針でSource実装を開始する。遠方pole/正の同tick window、近接/境界gap=0の拒否、off-center・大radiusの数値budget、先行actor/control/groundのevent順を限定testする。V171測定はまだ開始せず、両枝のSourceが安定してから最新Coreを別buildして使用する。旧V168結果は旧版証拠として保持し、関連する実経路以外を再実行しない。

## 所有・検証・復旧

workerは該当rolling curve/pole window helperと限定test、`LiveFieldPlayV1.ts`の該当branchを所有。Rootは記録/統合/全体状態。新1caseを先にRED、近zeroの正window・同arc前後状態・先行control/actor順・近接拒否を限定GREENで確認する。意味のある数学boundを得られなければ実装せずUNKNOWNを記録し、chord近似や固定速度で証明を捏造しない。

Native DB/schema/権限/原input/旧HTML/共有distは変更しない。held→release/実pole接触時の拘束反応・Native legal/moving/custody・公式HR・全SPINはこのwindowだけで完了扱いにしない。復旧は新optional proof経路を外して従来unresolvedへ戻せる。

## V173実行時のruntime更新（2026-10-28）

通常公開APIのChrome初回実行00943452は、実Chromeが156.0.8078.48から156.0.8078.49へ自動更新されていたため、version確認でFAIL。capture0/物理比較未起動、旧結果を保持する。再実行の理由はruntime変更と新失敗で、同じ成功試験の再読ではない。新harnessは全経路と旧V168実binary対照を同じ現Chrome.49内で実行する。過去.48とのcross-build厳密同値を主張せず、旧研究/全型/Source/buildをこのために再実行しない。
