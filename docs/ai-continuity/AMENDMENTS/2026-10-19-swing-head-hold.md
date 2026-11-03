# v57 スイング開始で打者の頭の向きを固定

人間の最新要求: 振るまでは投球を追ってよいが、振る瞬間に頭のカメラ移動を止め、スイング中に見逃し特有の動きや滑るような向け直しを行わない。遅く振るほど、それまで投球を追った姿勢で固定する。

添付の設定Bを採用: enabled=true、aimLiftMeters=.30、swingMaxDownRadians=.20、hitFollowDelayMs=300、aimReleaseMs=70、pitchTrackingGain=.26、pitchTrackingDeadbandRadians=.02。

実バットの登録済みmotor onset `referenceStartTick` で yaw/pitch を固定し、`referenceThroughTick` まで保持する。投球の感覚遅延を自分の動作開始へ加算しない。見逃しとバントは対象外。身体に付いたeye位置、実測バット、物理、能力、AI、裁定は継承する。

頭を固定する方式では予定打点へ向け直さない。高さ/俯角の2値は互換JSONに保持し、調整室では非適用を表示する。待機300msはスイング終端を短縮せず、打球の認識後と終端の両方を満たしてから70msの目標移行を開始する。開始後に遅い観測で再固定しない。

通常HTML/調整室へ反映し、fractional onset/終端/待機境界、左右/見逃し/空振り/バント、seek/rewind、元の12球Source/バット不変、実canvasと保存を検証する。従来モードA・旧JSONを保持する。原全計画・未達・FAIL/UNKNOWN/Charter HOLDとmain未マージは継承する。
