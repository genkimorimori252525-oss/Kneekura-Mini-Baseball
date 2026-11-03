# クラウドへの引き継ぎ: NPB較正の続き（2026-11-03）

本人がPCを使えない間、クラウドのセッションがこの文書から較正を続ける。経緯と数値は `AMENDMENTS/2026-11-03-npb-calibration.md`。

## 最初に（毎回）
1. 非公開 repo `Kneekura-eatenBUGsHouse` の `CLOUD.md` に従って準備する（NPBデータの抽出、`default-roster.json` の配置）。
2. 同じ repo の `boards/mini-baseball.md` を読む。ほかの担当が `作業中` で持つファイルには触れない。自分の行（`クラウド-<作業>`）を書いて push する。
3. 道具を用意する（このrepoのルートで）:

```
[ -d node_modules ] || npm ci
mkdir -p work/calibration
node tools/release/build-native.mjs work/calibration/build
gunzip -c <非公開repo>/data/mini-baseball/calibration/base-std.json.gz > work/calibration/base-std.json
node tools/calibration/defaults.mjs work/calibration/build/native.js work/calibration/base-std.json work/calibration/cfg-std.json
python -I tools/calibration/grid.py work/calibration/cfg-std.json work/calibration/cfg-npb.json work/calibration/npb-map.json timingStdSeconds=.0104 plateVision=70
```

`cfg-npb.json` が NPB 平均の標準リーグ。測定は必ず `EXTRA="--observe=lateLookByMeetOnlyV1:true"` を付ける（換算の表はこの条件で測った）。

## 測り方
- 試合: `PAR=2 EXTRA="--observe=lateLookByMeetOnlyV1:true" tools/calibration/games.sh <tag> work/calibration/cfg-npb.json 201 202 ... 209`。1試合約2分。クラウドは4コア・16GBなので同時2本まで。
- 集計: `node tools/release/core-stats.mjs work/calibration/rec/g-<tag>-*.jsonl`（リーグ）、`--by=batter`（打者別）。
- 走塁: `node tools/calibration/bases.mjs <records>`。打球: `node tools/calibration/ev-table.mjs <records>`。
- 換算の表: `grid.py` で18人に別々の値を配った混合リーグを18試合回し、`python -I tools/calibration/grp.py <map.json> "<records glob>" [index]` で値ごとに集計する。
- 9試合の BABIP の誤差は約±.02。差がそれ以下なら結論にしない。
- 新しい振る舞いは任意入力で足し、省略時は `--hash=1` で旧結果と一致させる。既定にするのは `release/game/parts/082-match-auto-direction-helper-v250.js`。

## やること（上から順に。AとBはファイルが重ならないので別セッションで並べてよい）

### A. 得点不足（守備・走塁。触るのは `src/core/sim/fielding/`、`LiveBaseRunningV1.ts`、走行の `LiveLocomotionV84`、芝の `BaseballSurfaceCalibrationV101.ts`）
- 現状: NPB平均の標準リーグで出塁率.310、得点2.0（NPBは3.57）。単打で二塁走者の生還38%（現実約60%）。一塁走者・2アウト未満のゴロの併殺が約56%（現実45%以下）。
- 見えている原因: 走者が三塁で止まり静止スタートで判断し直す。外野手が止まりかけた打球へ横に走って約4秒かかる（現実は前進して約2.5秒）。二塁→本塁が約7.4秒（現実約6.8秒、走行の加速帯が未較正）。
- 完了の形: 出塁率と長打率に見合う得点（NPB比で±15%）。生還率、併殺率を現実の目安へ。守備能力の差は残す。

### B. 長距離打者の三振過多（打撃。触るのは `tools/history/player-abilities.py`、`tools/calibration/`）
- 現状: 換算は三振→時間誤差、ISO→バット速度を別々に測った。速いバットは三振も増やすので、長距離打者の三振が現実の1.5〜1.9倍になる。
- やること: `grid.py ... targetSweetSpotSpeedMps=27,30,33 timingStdSeconds=.007,.0104,.013` の混合リーグ（9セル×2人）を36試合回し、三振とISOを両方の関数として表にする。`player-abilities.py` を2次元の逆引きに替える。

### C. 非力な巧打者の安打不足（打撃）
- 現状: 実在選手の検証で、非力な巧打者の BABIP が現実より.08〜.12低い。芯の誤差を小さくしても埋まらない。
- やること: 速度27〜28m/s・芯の誤差小の打者で、打球の速さ・角度・方向と、内野安打の有無を記録から分類する（`ev-table.mjs`、`bases.mjs`）。原因（打球の質か、内野の位置か、走力か）を測ってから直す。

### D. 二塁打の不足
- 本塁打の水準は合うが ISO が低い。外野の間を抜く打球と、走者の二塁到達を記録で見る。Aの後に。

### E. 実在選手の再検証（A〜Cの後）
```
python -I tools/history/player-abilities.py ~/kbm-data/npb-extracted 2023 > work/calibration/abil-2023.jsonl
python -I -X utf8 tools/calibration/real-league.py work/calibration/abil-2023.jsonl ~/kbm-data/npb-extracted/batting.csv 2023 work/calibration/cfg-std.json work/calibration/cfg-real23.json work/calibration/truth23.json
PAR=2 EXTRA="--observe=lateLookByMeetOnlyV1:true" tools/calibration/games.sh real23 work/calibration/cfg-real23.json $(seq 901 936)
python -I -X utf8 tools/calibration/compare.py work/calibration/truth23.json "work/calibration/rec/g-real23-*.jsonl"
```
2026-11-03 の値: 相関は本塁打.90、ISO.88、三振.72、打率.37、四球.32、BABIP.23。平均は打率 .268→.226、ISO .151→.095。

## 守ること
- 公開 repo（これ）へ、NPBデータ・抽出結果・選手名と個人成績・`default-roster.json`・`work/` を入れない。記録には型の説明と集計値だけを書く。
- 成果は `claude/…` の branch へ push する。作業 branch へは PC 側が取り込む。force push と hook の回避をしない。
- 描画（`release/game/parts/` の描画、`art-bank-*`、`build-artpack.py`）はデザイン部の担当。触らない。
- `lateLookByMeetOnlyV1` を既定にするかは、Bの表ができてから決める。画面での確認は PC 側で行う。
- 区切りごとに連絡板の自分の行を更新し、`next` に次の一手と branch 名を書く。
