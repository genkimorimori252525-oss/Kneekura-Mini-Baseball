# OOTP-first 王貞治パイロット — 最短のOB能力再現計画

> **2026-10-16 / USER-DIRECTED IMPLEMENTATION PLAN / NOT IMPLEMENTED**
>
> **最優先:** OOTPの能力値を出発点に、まず王貞治1人をMini Baseballで試す。**全選手の個別校正・全球場の再監査・大量Gateは作らない。** 王がうまく行けばユーザーが注文した選手だけ同じ共通手順で再現・軽量検証する。
>
> **Branch:** `jolly/core-foundation-plan-2026-09-17`。実装時は家のPCの未コミットコードと他ブランチを保護・先に確認。今回の計画作成はランタイム実装ではない。
>
> 関連: [OB固定原則](PRINCIPLES.md) / [王試作](cases/sadaharu-oh-prime.md) / [能力・得能カタログ](PLAYER-CAPABILITY-TRAIT-ATLAS.md) / [軽量チェック](METHOD-V1-PROPOSAL.md)。

## 1. ユーザーの方針と合格条件

1. **OOTPの歴史的選手Ratingsが初期値の第一候補**。王の独立査定をゼロから開始しない。
2. **まず王1人**。結果が十分なら、全選手の再査定を飛ばして共通Adapterを再利用。以後はユーザーが指定した選手だけを扱う。
3. **王は引っ張り屋第一候補・広角打法保留**。本人の引っ張り志向と引っ張り技術は別。流し狙い0でも逆方向打球は起こり得る。
4. **OBの基礎能力と固定カードは年次不変**。OOTPの年次RecalcをMiniへ持ち込まず、一度生成した全盛期スナップショットを固定。相手/球場/Condition/打席数/正史物理で年成績が変化。
5. **「55HR級の王」だが毎年55HRではない**。当時相当のリーグ環境・PAで全盛期へ到達可能、普通の年も成立。成績を事前抽選/直接Buffしない。
6. 完全なNPB歴代全選手・二軍・全年代の球場再現をPilotの前提にしない。既知の小誤りは一行注記・必要部分だけ直す。

## 2. OOTP実物の機能と参照元（2026-10-16確認）

- [OOTP Wiki — Historical league settings](https://wiki.ootpdevelopments.com/index.php?title=OOTP_Baseball:Screens_and_Menus/League_Menu/League_Settings/Historical_(only_for_Historical_Leagues)) は歴史選手の実成績からのRatings Recalc、**1年・3年・5年**の参照期間、対象年の重み2倍、毎年再計算する設定を説明。
- [OOTP Wiki — Batting Ratings](https://wiki.ootpdevelopments.com/index.php?title=OOTP_Baseball:Screens_and_Menus/Player_Profile/Player_Ratings/Batting_Ratings) によれば主要評価は`Contact`（BABIPとAvoid Kを含む複合指標）、`Gap Power`、`Home Run Power`、`Eye/Discipline`、`Avoid K`、vs RHP/LHP。**OOTP数値はMiniのバット運動真値とは異なる**。
- [OOTP Wiki — Player Ratings](https://wiki.ootpdevelopments.com/index.php?title=OOTP_Baseball:Screens_and_Menus/Player_Profile/Player_Ratings) では1–100など表示スケールが選べる。Scoutingによる表示推定と実値は一致しない場合がある。Editor/Commissioner true ratingsが確認できれば優先、なければ表示は推定として記録。
- [OOTP Wiki — Defensive Ratings](https://wiki.ootpdevelopments.com/index.php?title=OOTP_Baseball:Important_Game_Concepts/The_Player_Model/Baseball_Ratings/Defensive_Ratings) はRange/Error/Arm/Turn DPと守備位置評価を説明。Miniの11個の真の守備技能に1対1で一致しない。
- [OOTP Wiki — Hitter Tendency](https://wiki.ootpdevelopments.com/index.php?title=OOTP_Baseball:Screens_and_Menus/Player_Profile/Player_Profile/Summary) のPull Hitter等はOOTP側の打球方向傾向。Miniでは**方向Slow Preference候補**として扱い、接触後のボールの軌道を書き換えない。
- [OOTP NPB Historical GitHub](https://github.com/lebronisbest/OOTP_NPB_Historical) のREADMEによると1936–2025の歴史データをOOTP 26で読み込める。実リポジトリの`stats/`には`historical_database.odb`、`Master.csv`、`Teams.csv`等が確認できるが、**完成した王の能力値CSVは確認できない**。`database/era_modifiers.txt`は時代ゲーム環境の係数であり、王個人の能力値ではない。
- mod READMEは**personal, non-commercial use with OOTP Baseball**と明記。今回の目的はOOTP上の一選手のRatingsを個人研究の出発点として**参照**すること。mod一式・画像・ゲーム資産のMiniへの無許可大量コピー/再配布とは区別する。必要のない権利調査で進行を止めない。

## 3. PilotのOOTP設定 — 王1人分のRatingスナップショット

| 項目 | 初期設定案 |
| --- | --- |
| 対象 | 王貞治、読売ジャイアンツ、左打者、一塁手 |
| OOTP environment | OOTP 26 + NPB Historical Databaseを利用できれば優先 |
| 代表開始年 | **1974年**を第一候補。1972–1976の前後5年に強い年と1975の落ち込みが含まれる |
| Historical Ratings | **5-year window**を初期候補、**Double weight current year = OFF**。OOTPが実際にどの年を用いるか、版/設定記録 |
| Scale | OOTPの`1–100`表示、上限超過値が分かるなら記録。Mini 0–100とは直結させない |
| Scouting | true ratingsを確認できるEditor表示を優先。Scout estimateしかなければ`OOTP_SCOUT_ESTIMATE`扱い |
| Current / Potential | **Currentを原則採用**、Potentialは別記。Prime作成時に成長潜在値を追加Buffしない |
| Ratings freeze | **一度OOTPで参照したスナップショットをMiniで固定**。OOTPの翌年Recalcは適用しない |

実行時はOOTPで1974年の歴史世界を起動し、**王の打撃Rating（5主項目+左右Split）・走塁・一塁守備・Hitter Tendencyだけ**を1件取得。CSVエクスポートが使えれば利用、使えなければ画面/Editorから手入力する。この1人分の設定・値だけ研究フォルダへ保存。全員CSV抽出は不要。

**重要な未検証依存:** 今はOOTP実機を操作していないため**王の実際のOOTP Ratingsはまだ取得していない**。アクセスできない場合は`OOTP_RATINGS_NOT_AVAILABLE`とし、架空のOOTP値は絶対に書かない。公開modの成績表を“OOTP能力値”と偽らない。

### 王の5年実績を集計、OOTPエディターへ入力できる数値を作成（2026-10-16作業済み）

[機械可読・王貞治1972〜1976年5年集計＋OOTPエディター入力](cases/sadaharu-oh-1974-ootp-editor-input.json) を作成した。これは**NPB史実値から導出した入力データであり、OOTPが生成した能力値ではない**。

| 区分 | 実測・集計値 |
| --- | ---: |
| 5年通算 | 640試合、2744打席、2062打数、657安打、230本塁打、638四球、235三振 |
| 加重打率／出塁率／長打率 | **.319 / .480 / .693** |
| 130試合換算の本塁打 | **46.7本** |
| OOTP Editorの打撃成績入力（130試合相当へ丸め） | **AB419 / H133 / 2B16 / 3B0 / HR47 / BB130 / HBP4 / SO48** |

OOTP Player Editorの[Batting Ratings Tab](https://wiki.ootpdevelopments.com/index.php?title=OOTP_Baseball:Important_Game_Concepts/Tools,_Functions,_and_Editors/In-Game_Editors/Player_Editor/Batting_Ratings_Tab)には、`Create Current Ratings based on stats` という機能がある。このため歴史modの自動Ratingsが読み取れないときの**同じOOTP内での代替**として、上記8入力値からOOTP自身にCurrent Ratingsを作らせられる。Editor操作にはCommissioner modeが必要。**本セッションでは実際にOOTPを操作できておらず、その生成後のContact/Power/Eye実数値は未取得。**

OOTPの`Contact`はBABIPとAvoid K'sからOOTP内で算出される。`Contact + AvoidK`を別々の命中率Buffにしてはいけない。

## 4. 1つの共通OOTP → Mini能力変換器

| OOTP | Mini既存Sourceの初期推定 | 注意 |
| --- | --- | --- |
| `Contact` と `Avoid K` | contact precision / swing timing / late adjustment | Contactは複合値なので二重に加算しない。三振率直接補正なし |
| `Eye / Discipline` | zone recognition / swing-take decision | 四球率そのものを加算しない。敬遠は相手戦術 |
| `Home Run Power` | bat speed / launch control / power transfer | 結果HR確率ではなく実運動へ |
| `Gap Power` | 実際の強い打球・ギャップ狙いのMotor適性 | 二塁打数直接Buffなし |
| `VS LHP/RHP` | platoon習熟・技術Sourceの初期Prior | 自動的に`対左A`等のTraitを付けない |
| `Pull/Balanced`等 | PULL/CENTER/OPPOSITEのSlow Preference | 技術`引っ張り屋`の自動認定でも、引っ張り結果強制でもない |
| `Speed/Stealing/Baserunning` | 実走速度、加速、スタート、判断 | 行動と身体速度を混同しない |
| `Fielding Range/Error/Arm/1B` | first step / route / catch / throw / position suitabilityの保守的初期値 | 細分化データ不足は共通Prioriで処理。架空の正確値をでっち上げない |
| `OVR / POT` | 表示参考のみ | Mini`☆`への直コピー・True Skillへの足し算禁止 |

Mini側の公開値・得能・隠し技術は、この**共通Mapperを通したTrue SourceのProjection**。1人ごとに独自の結果補正・コード分岐を加えない。王の引っ張り屋候補はOOTPの方向傾向だけで決めず、本人の打撃技術の既存Evidenceも併用。資料がない隠し技能は一般的な初期推定で十分。

推奨データ構造（**案、コード未実装**）:
```text
OotpHistoricalRatingsSnapshot (one-person + version/year/recalc/scout metadata)
  -> OotpToMiniSkillSeedAdapter (one shared converter)
  -> FrozenObPlayerSourceSeed (fixed ratings / source skills)
  -> existing one Match Core (pitch/bat/contact/fielding/rules)
  -> Oh pilot fixture and concise result
```

## 5. 実装順 — 王の成功後は注文された選手だけ

### A. まずOOTP王の数値を取得
- 現在のローカル実装、未コミット・他ブランチの成果を確認し保全。
- OOTP 26 + NPB Historicalから1974年王のCurrent Ratings等を参照（5年窓・重みOFF・表示Scaleを記録）。
- 取得できない項目は`NOT_AVAILABLE`として続行。ユーザーに全選手のCSVや巨大研究環境の用意を求めない。

### B. 共通変換器を一度だけ作る
- 既存`src/core`のPlayer source/Rating/trait ownersを再利用。`OotpHistoricalRatingsSnapshot`と`OotpToMiniSkillSeedAdapter`を必要な範囲で追加。
- Miniのミート/パワー/選球眼/バント/走塁/一塁守備と技術・方向Intentの初期Sourceへ変換。王は`引っ張り屋`第一候補、`広角打法`保留。
- 同じ変換を別人物にも適用可能な一般モデルにする。王専用の特別なスイングやHR計算は作らない。

### C. 最小限の王の試合環境と短い検証
- 1974年ごろの**セ・リーグ相当の大まかな投手水準、球場、試合数/打席、ルール**だけ用意。実在全選手Roster/全NPB球場/二軍の再現はしない。必要なら`GENERIC_OPPONENT_APPROXIMATION`を明示。
- まず単打席のContact/打球方向を確認。**既存の完全試合Coreが使用可能なら**同じ王・環境で少数（例3〜5seed）のシーズンを試す。未接続なら`NOT CONNECTED`とする。
- 本塁打・四球・三振・打率・PULL方向の偏りを**ざっくり**比較。1974年の約49HR/130試合、1964年55HR/140試合を無条件で同じ絶対本数へ換算しない。55HR級は**到達可能性**を重視し、毎年の達成を要求しない。
- 大きな違いがあれば**その原因と共通変換器だけ**を局所修正。細部が近ければ追加作業せず完了。

### D. 次からの個別注文処理
ユーザーが`長嶋茂雄`等の人物を指定したら、**OOTPでその人物の代表Ratings取得 → 共通変換 → 必要な個性/Traitだけ追加 → 少数の試合で破綻がないか確認 → 能力値/結果を返す**。 
**全選手を一括個別校正しない。** 既存の変換器を毎回再設計しない。本人ごとの資料集めは**目立つ個性や重大な矛盾がある時だけ**。

## 6. 6つの軽量受入（OH-01..06）

| ID | 最小限の確認 |
| --- | --- |
| `OH-01` | OOTPの本物の王Ratingsまたは`NOT_AVAILABLE`が記録され、出典/年/スケールがわかる。 |
| `OH-02` | **共通Mapper一つ**でMini技能に変換。OOTPのComposite ratingを物理/打率結果へ直適用しない。 |
| `OH-03` | 引っ張り屋技術/本人のPULL選好は別。広角保留。流し意図0でも流し打球可能。 |
| `OH-04` | MiniでOBの恒常Source固定。毎年OOTPからRecalcして能力上書きしない。 |
| `OH-05` | 実際に利用できる試合Coreで王の打席/代表年度を軽く試す。未接続は`NOT CONNECTED`。 |
| `OH-06` | 目立つ成績の問題だけを共通原因から修正。正常ならそれ以上の全選手/全年代査定を要求しない。 |

**成功判定:** 王が同時代に近い環境で**王らしい打撃/選球/長打/PULL傾向を生み、史実の最高年級も届き得る**見込みがあるなら、以後は指名選手の簡易移植へ移る。完全な統計的証明や全NPBの一括能力校正はPilot合格条件ではない。

## 7. 報告・禁止事項

- 実際のOOTP Ratings取得/未取得、OOTP設定・mod版、Mapperと王の固定能力、実動作/試合の証拠、重大なズレと最小修正を短く報告。
- **禁止:** 全選手の個別再査定、数千選手分の巨大データ変換検証、OOTPの年次Recalcを固定OBへ投入、王の55HRを毎年生成する専用結果Buff、古い球場誤記を口実に全件監査。
- [OOTP mod](https://github.com/lebronisbest/OOTP_NPB_Historical)は個人非商用かつOOTP向けの明記があるため、**参考数値の個人研究**と**mod素材/DB一式のMini転載**を混同しない。

**現状:** 王のOOTP能力の実数値取得、Mapperのゲーム実装、代表試合/シーズンの実走検証は**未実施**。本ファイルは実装計画であり、成果の完了を示さない。
