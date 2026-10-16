# 王貞治 — OOTP資料参照・Mini完全独立パイロット

> **2026-10-16 USER CORRECTION / CURRENT PRIORITY: NO OOTP GAME LAUNCH.**
>
> **STATUS:** 五年史実基準と時代リーグ集計・Mini独立比較スクリプトを作成済み。**真のMini能力値は未校正、試合Coreへ未接続、フルシーズン検証未実施**。
>
> **優先指示:** OOTPはデータ資料のひとつであり、**実行・購入・起動・選手Editor操作をしない**。Mini Baseballだけの物理試合で王貞治を再現する。王で方式を確認したらユーザーが指名した人物だけを作る。全NPB選手の個別査定・一斉校正はしない。
>
> **旧計画との関係:** このファイルに以前あった「OOTP26を起動」「Commissioner画面で王のRatingを読む」「OOTP Editorへ成績を入力」は**すべて撤回**。後続の本人指示が優先する。

## 1. 何がOOTPに保存され、何が保存されていないか

- [OOTP Historicalの説明](https://wiki.ootpdevelopments.com/index.php?title=OOTP_Baseball:Screens_and_Menus/League_Menu/League_Settings/Historical_(only_for_Historical_Leagues)) によれば、OOTPのHistorical Gameは**過去の打撃・投手などの成績から能力Ratingをゲーム内生成**し、1/3/5年参照や年次Recalcをする。第三者歴史`.odb`に本人の完成済み`Contact / HR Power / Eye`一覧が格納済みだと確認できていない。
- [OOTP NPB Historical](https://github.com/lebronisbest/OOTP_NPB_Historical)に存在する`historical_database.odb`は主にMaster/Batting/Pitching/Fieldingなどの史実データを含む。`era_modifiers.txt`はOOTPの時代別ゲーム調整値であり、王の個人Ratingではない。
- [OOTPDBTools](https://github.com/sleffew80/OOTPDBTools)ならOOTPの実行ファイルなしに`.odb`からCSVを抽出可能（READMEでは17〜26対応）。これは**元成績の抽出**であり、OOTPエンジン内部で生成されるPlayer Ratingsの再現ではない。
- 外部modはREADMEで **personal, non-commercial use with OOTP** と指定。Miniにmod全DBや素材を無許可で転載しない。研究用の統計比較は小規模の集計にとどめ、Miniへ保存する事実データは使用可能な独立ソースを優先する。

## 2. 実際に確保できた王の独立ベンチマーク

- [王1972–1976 五年集計](cases/sadaharu-oh-1974-ootp-editor-input.json): `G640 / PA2744 / AB2062 / H657 / HR230 / BB638 / K235`。打率`.319`、出塁率`.480`、長打率`.693`、130試合換算46.7HR。
- [同年代セ・リーグ6球団×5年集計](cases/sadaharu-oh-1972-1976-league-reference.json): 1972–76 `stats/Teams.csv` からの研究用少数集計。リーグ打率約`.250`、HR/PA約`2.82%`、BB/PA約`7.81%`、K/PA約`13.93%`（犠打等を含まない打席数近似）。
- 王のリーグ相対比: 打率`1.28×`、HR/PA`2.97×`、BB/PA`2.98×`、K/PA`0.615×`。これは統計上の**再現ターゲット**であり、Miniの真の能力値・OOTPの生成済みRatingではない。
- [Mini専用のオフライン比較計算器](../../tools/player-reconstruction/compute-oh-mini-benchmark.mjs): `node tools/player-reconstruction/compute-oh-mini-benchmark.mjs`。OOTPを一切起動せず、上記の相対値を再計算できる。**比較ツールであって試合エンジンや能力値推定器の完成品ではない**。
- [元の王OBケース](cases/sadaharu-oh-prime.md)と[能力一覧](PLAYER-CAPABILITY-TRAIT-ATLAS.md)は維持。前の仮値`ミート96・パワー100・選球眼99`はOOTP由来でも最終決定でもない。以前のJSON内`ootpEditorProposedInput`は履歴であり今後は使わない。

## 3. Miniを唯一のゲーム本体とする設計

```text
NPB / OOTP-mod-related historical factual references
    -> observed Oh vs observed 1970s CL population benchmark
    -> one Mini historical player skill seed generator (NOT YET IMPLEMENTED)
       - recognition + plate decision, contact precision/timing
       - bat speed, contact transfer, launch control
       - pull intention separately from pull-side technique
       - running and fielding sources, unknown where unmeasured
    -> existing Mini True Player state
    -> authoritative Mini physical pitch/bat/ball/fielding/rules
    -> actual play / official record
    -> compare with historical benchmark if legally/physically connected
```

- 禁止: 昔の出力HR率を直接HR確率Buffにすること。OOTPを裏で走らせること。史実データから測定していない球速・バット運動の正確な真値を捏造すること。選手ごとの特例パッチ。
- **実装する側のコードベース:** [より進んだNative Coreブランチ](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/tree/jolly/tbd-lad-native-browser-core-2026-10-14)にはAerodynamicPitch、SwingKinematics、RigidBatContactなどの実物コードが存在。文書ブランチのP0しかないと決めつけて別エンジンを作らず、**最新ローカルと照合して既存のNative身体運動へ源能力を接続する**。
- **未完成の境界:** [Nativeの10/14 receipt](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/blob/jolly/tbd-lad-native-browser-core-2026-10-14/docs/implementation/2026-10-14-tbd-lad-native-aero-rigid-and-official-nine-inning-receipts.md)には、58打席/9回の物理K/BB終端実行があるが、接触後の実打球/野手/公式処理を通したフル試合は未接続と明記。**今この状態で王が49本/55本を打ったと検証済みにしない**。
- 王の金特`引っ張り屋`は第一候補、広角打法は保留。狙いのPULL 100%と実結果の逆方向打球0%は無関係。方向意図と実球の接触結果は独立。

## 4. 次の最短工程と合格条件

1. **済:** 王5年とリーグ5年の実測・概算分布を比較し、OOTP不要のMini研究用Tool/JSONへ登録。
2. **次:** 手元の最新Native実装を確認し、既存のバット・投球物理と個人の技能入力の間に**共通変換器一個**を作る。王の真Source初期値はMini独自の校正、OOTP内部実Ratingと同じだと主張しない。
3. **次:** 王をNativeの**実物Contactを伴う1打席**で動かす。Contact/方向/空振り/見逃し/バット速度が個人のSourceの差を反映するか。物理から結果が出ることを守る。
4. **次:** バット接触後の守備/Runner/Ruleの全経路が本当に接続されていれば、少数のシーズンを同じ本人能力で試す。未完成なら`NOT CONNECTED`と明記し、架空の満塁HRイベントでテストを通さない。
5. **王が十分に再現できたら:** ユーザーが個別に注文した長嶋などの人物だけ、同じSource Generatorを再利用。**全選手を一人ずつ校正しない**。

**3つの不変条件:** (A) 王のOB True Skillはペナント年次で固定、(B) 同時代の全盛期実績が再現可能でも毎年固定結果ではない、(C) Mini自身の物理が結果を決め、OOTPはゲーム本体にならない。

**現況はBenchmark作成まで。** 王の公開ミート/パワー/選球眼・非公開スイング源能力の最終決定とMiniでのフル実戦検証は未完成。
