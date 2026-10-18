# v47 実装単位と検証方針

人間の追加依頼: 多段中継、ベース旋回を通常HTMLへ接続。公開能力11を維持し既存能力と任意詳細で個性を調整。元計画は維持。

1. 純粋な中継経路予測: 実野手・空力送球・受手到達・持ち替え・手の準備・方向精度を比較。direct/carry/relay/holdから選択。最大2中継者、経路8候補に限定、捕球やアウトは生成しない。
2. 実プレー接続: 指定中継地点へ身体を移動し、actual glove contact→secure→transfer→new plan→actual releaseを繰り返す。新たな受球前に次段を実行せず、同じ対象への訪問済み中継者を除外。最終塁の支配・身体タグだけが裁定根拠。
3. 走塁経路: C1なline/arc、塁中心通過、速度・加減速・曲率制限。停止先だけなら旧直線の停止走行、先の塁が安全なら停止する前に進塁をcommitし旋回する。再計画で位置・速度を保持し、不可能な曲線は旧停止計画を保持。
4. 既存public走力・守備・肩・精度・反応と既存判断設定を使用。任意詳細に旋回半径と横加速度を追加。後者の既定は個々の加速度×1.5、明示編集は保持。公開分類は増やさない。
5. Observer: 各hopのissued targetとactual recipientで追尾。Hostは現在のanalytic runner velocityを観察し、future frameの中央差分を使わない。既存UI・配球・PNG/font・連続打者視点と4px/55msを継承。

検証: 純粋planner/曲線の単体試験、実2/3送球・各secure/transfer・最終force/tag、直送有利な能力差、移動中受手、複数走者占有、途中塁の非ゼロ速度と最後の停止、再計画連続性、unsafe停止、メーカー旧JSON/編集/表示fallback、Host転写、通常HTML規定9回、PC1200/390、全体tsc、Source pins/配布ZIP/原FAIL保持。

各塁中心への足の着地点をbase_touchとする既存proxy契約を維持する。完全な歩行・スライド・リード、全能力・特性、公式H/E、残るルール、Native認証連続世界、実選手校正、新100試合、実機は別残件。係数・経路探索は未校正、global optimum保証をしない。
