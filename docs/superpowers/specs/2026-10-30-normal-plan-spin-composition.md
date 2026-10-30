# 通常の打撃計画を保持するSPIN XY合成

2026-10-30 JST / MB-20261027-REALISM-DEBUG-PLAN。全Goalの範囲・受入・配送を維持する。V236 raw-aimの事実と旧失敗は変更しない。

## 問題と採用判断

本人L／obp-23_5のV237実接触は4指定すべてで成立したが、BACK／HOOKは要求とは逆方向だった。現raw-aimは通常のnominal中心・prior混合時刻を置き換えlate correctionも止めるため、差をXYだけに帰属できない。Astraは通常能力への採用をHOLD、明示試行としての限定Readyを維持した。

通常SPINは本人の方向／AUTO／心理計画に合成する。現版は別の明示raw試行として保持し、新版を厳密なversionで区別する。同じper-pitch request経路と既存Ownerを再利用し、資格移転・新Ownerは作らない。

## 実装契約

- 新版はsubject、技術、同一clip id／SHA／左右、座標系／正常plane、明示XY差分を持つ。深度・時刻の変更は今回含めない。旧版のcontactDepthZやraw計画の保存形式は変更しない。unknown key／不正値を拒否し、未配達／域外／clip違いはNO_TARGET。
- 通常planを確定し、方向・心理を含む通常の運動へXY差分だけを合成する。元の誤差適用順序を保ち、誤差を二重に加えない。非ゼロ差分の合成位置は誤差前のplanを基準にし、ゼロでは元の計算経路をそのまま使う。ゼロ加算や相殺でsigned zero／浮動小数を変えない。
- desiredContactTime、Z、判断・実行clock、13 RNG trace、clip、通常late observation／correctionは維持する。raw予測でprior／認知biasを消さない。late処理が差分を上書きした場合も宣言だけで適用済みと扱わず、要求差分と実行差分を記録する。
- 合成後に既存の速度・latency・acceleration制約を適用する。実行可能性のために結果spinを上書きしない。技術名は識別と運動選択だけに使い、接触・空力の結果補正へ使わない。
- authorityは明示未校正試行、earned=false。Hostの現在打者照合、request保存再開、実Worker配送、roster不変を既存経路で保持する。Native資格fullrefの転記をLive motorへの資格成立とみなさない。

## 受入単位

通常／合成delta0／固定4probeを同入力で比較する。まずPULL／CENTER／OPPOSITE／AUTO、非ゼロprior／認知bias、L／Rの限定条件で、delta0のnormal reference、運動標本・clock・RNG・late correctionをbit単位で確認する。新しい診断／明示command欄の差は別記し、物理結果の差を除外して合格にしない。

非ゼロは同じ通常planからのXY制御を確認し、Z・予定時刻・誤差・制約・clipを保持する。未成立／miss／逆方向も保存。本人の実JSONは正常import／実clipで検証し、汎用fixtureを本人受入へ昇格しない。実Main／browser Worker・保存再開は同じCore／Chrome build／時間刻みで照合する。

この単位が通っても明示試行の範囲であり、4技術全domain・人間校正・獲得・自然Gold・最終配送の完了にはしない。深度／時刻差分は、この合成基準が成立してから必要な仕様として別途扱う。
