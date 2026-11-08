# 設計室v26 軽量化と本塁打曲

出力: `outputs/球場設計室_v26_軽量本塁打曲版.html`。build: `node tools/ballpark-studio/build.mjs <label> --light-theme`。保存キーは `kneekura_ballpark_studio_v26`。v25は上書きしていない。

## 軽量化

- 観客3コマのうち1コマ目だけを先に描いて応答し、残りは入力の合間に描く。途中の編集で打ち切る。`inspect().firstFrames` が先の応答、`renderCount` が全コマ完了を数える。
- `stadium-mesh.mjs` の三角形走査は行ごとの範囲外を飛ばす。範囲内の判定式は変えていない。

v25との比較は5球場×4視点×3コマの60画像すべて完全一致（ヘッドレスChrome）。

同色の点を1パスへまとめる案は、アンチエイリアスが変わり最大80階調の差が出たうえ速度もほぼ同じだったので採用しない。

## 本塁打曲

`architecture.homeTeam` は任意項目。無いJSONも従来どおり読める。タンボフのプリセットだけ `TBD`。`homerun-theme.mjs` の規則は `release/game/parts/016-audio-runtime-v100.js` と同じ。音源は `assets/homerun/`（gitignore）で公開repoへ入れない。

操作は「本塁打」ボタン。隣で回とサヨナラを選ぶ。

技術的なPASSであり、本人の採用判定ではない。
