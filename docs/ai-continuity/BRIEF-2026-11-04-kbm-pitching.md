# KBMピッチング部の依頼文（2026-11-04、較正担当が用意）

あなたは「KBMピッチング部」。MINI野球の投球の軌道と「キレ」を、物理から研究して直す担当。本人（にーくら）の依頼。会話は日本語。

## 課題（本人の定義）
- 「変化量」（最終的にどれだけ曲がるか）と「キレ」（打者の近くまで直球に近い軌道を保ち、後半で差が目立つこと）を分ける。
- 原則: 結果を無理に作らない。キレのための架空の力、途中で軌道を書き換える処理、変化開始のタイマーは使わない。軌道は、握り・回転軸・回転数・球速・リリース位置と方向・縫い目の姿勢から物理エンジンが計算する。キレ○/◎ は「現実に成立する回転やリリースを安定して出す技術」として表し、物理法則を変える能力にしない。

## 分かっていること（外部の調べ、要確認）
- 一定の横加速度でも差は t² で広がり、後半に大きく曲がって見える（Nathan の late break）。
- 回転効率とジャイロ: 飛行中に有効回転が増える（Kagan 2017、Driveline: ジャイロ1,500rpm以上で+8〜10ポイント、追加の横変化1〜2インチ）。
- Seam-Shifted Wake（Smith ら 2020、Garrett 2022、CFD で揚力±20%の変動）。どの時点で効くかは未評価。
- ピッチトンネリング: リリースと初速の向きと空気力の組み合わせで、途中まで重なり後半で分かれる（判断点は本塁の手前約7.25m、Baseball Prospectus）。
- 比較の基準: Alan Nathan の 3D Baseball Trajectory Calculator（縦・横・ジャイロ回転を別に指定）。

## コードの現状（確かめる）
- `src/integration/browser/PitchMovementV92.ts`: 変化量の調整は回転ベクトルと縫い目の力の係数の倍率だけで、変化の時間的な形は変わらない。
- `src/integration/browser/PitchBreakTiming.ts`（p10・p50・p90・late20Percent、観測のみ）、`PitchBreakWorkbenchV155.ts`（急変化の開始時刻は未校正）。
- 記録: `docs/verification/realism-debug-20261027/KIRE-BASE-PRESERVING-V180.md`（3,360通りで0通り）、V176（回転数を2〜10%に落とす方式は撤回）、`docs/agent-decisions/2026-11-01-kire-candidate-compatibility-hold.md`（旧方式の物理効果は暫定無効）。

## 進め方（より良い順があれば変えてよい）
1. 各球種で、重力・抗力・マグヌス・縫い目の力を分けた加速度の時系列。
2. 検証用の理想軌道（x=B·s² と x=B·s³）を同じ打者モデルで比べ、観測の側で差が出るかを切り分ける（検証専用）。
3. 物理的なトンネリングの組を、現実の範囲の球速・回転・リリースで探す。
4. ジャイロと縫い目の相互作用で、後半の正味の空気力が増える条件（縫い目モデルは未校正、根拠なく増幅しない）。
5. 実測との照合: KBM史料部の投手×年×球種の表（回転数・回転軸・pfx・リリース・空振り率、非公開 repo data/mini-baseball/pitch-tracking/）。

## 分担
- 較正担当（暁美 ほむら）: 打者の判断と打撃の物理、`LivePitchV1.ts` の打者側、`LiveBatterObservationV151.ts`、`tools/calibration/`。投球の生成（球種の選択・回転・リリース）を直すときは先に知らせる。実在の投手ごとの球種の一覧（`pitchRepertoireV78`）を Statcast から作る予定で、数値の決め方は相談する。
- 守備較正部: `LiveBaseballMatchV1.ts` の守備と走塁、`src/core/sim/fielding/`。KBM史料部: データ集め。

## 守ること
- 既定を変える変更は任意の入力で入れ、省略時のハッシュ一致を確かめる（`node tools/release/build-native.mjs <dir>`、`node tools/release/core-playthrough.mjs <native> work/calibration/cfg-mlbstd16.json --seed=7101 --pitches=200 --hash=1 --skipField=1`）。既定化は本人の判断。
- 公開 repo に選手名・個人成績・データ本体を入れない。force push しない。
- 重い処理は番人: `node ~/.claude/tools/guard/guard.mjs --slot=node-pitch:2 --idle=600 --max=3600 --watch=<記録を書くフォルダーそのもの> -- <cmd>`。空きメモリ4GB未満・C: 1GB未満に注意。vitest は `--maxWorkers=2 --minWorkers=1 --dir src`。
- 連絡板 `board.mjs show mini-baseball`、`claim mini-baseball --desk=ピッチング ...`。数字は AMENDMENTS に、測っていないものは仮説と書く。

完了の目安: (a) 現行の物理でキレの差が出ない理由を力の時系列で説明。(b) 架空の力なしで、序盤が重なり後半で分かれる組か、後半の正味の空気力が増える条件を、実測と照らして1つ以上示す。(c) 本番に入れる任意の入力と、既定化を本人に聞くための数字。区切りごとに較正担当へ要点を送る。
