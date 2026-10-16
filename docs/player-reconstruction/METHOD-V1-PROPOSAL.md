# 選手再現部 — 再現・校正・品質検証プロトコル v1

> **状態:** METHODOLOGY PROPOSAL / QA CHECKLIST / NOT IMPLEMENTED / NOT CALIBRATED（2026-10-16）。
>
> 本文が具体化するのは [ユーザー指示で確定した原則](PRINCIPLES.md) の実務手順。閾値、年数、推計方式、係数はEvidenceと再現試験で決定する。計測なしに完成能力値を宣言しない。

## 1. 再現対象の定義・環境

1. `playerID`、正式名、投打左右、主ポジション、球団/時代、全盛期タイプを明記。
2. `variantID` を付ける。初期主対象は `PRIME_COMPOSITE`（複数年の全盛期代表・OB固定）。特定年1つを厳密に再現する `SEASON_SNAPSHOT` は別目的であり、ユーザーが明示的に要求しない限りPrime Compositeに混同しない。
3. その選手の成績を生んだ `competitionRuleVersion / gamesScheduled / park / playing-time opportunity / league-season opponent context` を保存。数字だけ移植して同じ勝負環境だと主張しない。
4. 現役ペナントへOBを加えたときは、元リーグと同じ球質・得点環境を仮定できない。**選手能力は固定しても、異なるリーグ環境では史実成績を再現できなくてよい**。校正を先に当時相当の環境で実施し、その後にCross-league転用を測る。

## 2. 史実Evidence台帳（必須）

| 項目 | 何を集めるか | 誤りやすい点 |
| --- | --- | --- |
| 基本 | 年度、球団、リーグ、規則、試合数、打席数、打数、安打、四球、敬遠/故意四球、死球、犠打飛、三振、長打 | 分母を誤ったまま「率」を平均する |
| 外部環境 | 打席機会、球場、リーグの投手水準/球場環境、使用球、守備/シフト、時代 | 1964と1974を同じ無調整条件にする |
| 打者のStyle | 監督の証言、打撃映像、技術解説、打球傾向、方向狙いの本人発言 | 実打球7割PULLだからIntentも7割と断定 |
| 打撃Source | 球種・速度/高さ別の見極め、contact skill, bat speed, launch transfer, zone recognition | 四球の多さをすべて選球眼へ割り当てる。敬遠を無視 |
| Context | 打順、相手投手、プレーの意図、チームの状況 | 打点/タイトルを原因技能として入力 |
| 不足 | 見つからないデータ、時代による計測不在、資料間の不一致 | 証拠がない項目をSと決めつける |

各元データ: 出典URLと見出し、取得日、対象年、資料年、出典の強さ、補正履歴、単位、confidenceを記録。スカウティングの推定/説明からの推測は `INFERENCE` と書く。

## 3. 全盛期の年選び — 「よい年だけを平均」問題への解

**目的:** 全盛期における**典型的な強さ**と、突出した一季節の**到達可能性**を同時に推定する。

- `Prime Window Candidate`: 成長・最盛期・低下傾向を考慮して**可能なら連続した複数年**を先に指定。切り出し根拠と境界の前後数年も保存。
- `Primary Sample`: 指定全盛期の各年を、事前に記録した選定規則で採用。悪い年を「都合が悪いから」と除外しない。怪我/出場数激減は別の機会要因として注記し、排除するなら事前の基準と理由を記録。
- `Sensitivity Windows`: 全盛期の近傍年を加減して同じ計算を繰り返し、能力が年選択にどれほど依存するか確認。窓で大きく変わる場合は確信度を下げる。
- `Peak-Tail Check`: 最高シーズンを代表値へ強制加算せず、同じ固定Sourceから実測最大級成績が有意に到達可能かを**別**のシミュレーションGateで確認する。
- 何年が最適かを「3年固定」「歴史上上位5年だけ」で機械的に定義しない。選定対象のキャリア・時代・資料の充分さによって変わり得る。

### 数字の集約 — 方法の原則

```text
Season raw count:
  PA, AB, H, 2B, 3B, HR, BB, IBB, SO, HBP, SF ...
            ↓
correct denominators / season context
  AVG = sum(H) / sum(AB)   (not average of annual AVG)
  HR/PA = sum(HR) / sum(PA)
  BB/PA = sum(BB) / sum(PA), with IBB separated for skill inference
  SO/PA = sum(SO) / sum(PA)
            ↓
league/year/park and playing-time opportunity normalization
            ↓
skill-informed prior + finite-sample uncertainty
            ↓
candidate TRUE player batting/cognitive/motor sources
            ↓
actual same-era league-profile baseball simulation
            ↓
distribution of season outcomes + tail reachability
```

- 数式は集約の例で、具体的な公認統計指標定義/公式成績記録に従う。
- データを強引に一律1年へ換算する前にPA/ABやサンプルの偏りを調べる。
- 「好成績」だけで候補窓を選んでから最も良いシーズンだけ再採用するとselection biasが生じる。Peak Tailがそこに届くのは望ましいが、典型年の期待値が最高年になるよう校正しない。
- 得点・打点・敬遠等は相手戦術や同僚打順の影響を含み、raw選球眼/ミート/Powerへ直結させない。
- 現役とOBのリーグ水準比較は`02`の真のLeague Referenceを用いる。固定OBカードの表示Contextは選定時Snapshotで保持し、動的現リーグ比較は別表示案（まだContract未Freeze）。

## 4. 史実 → 選手能力へ逆推定

公開ミート95／パワー100などの「目標表示値」から試合結果を補正してはいけない。

1. 推定する候補Source（bat speed/control、zone recognition、pitch anticipation、pull-side execution、swing approach、directionIntent、守備/走塁など）を一覧化し、同じ史実結果を複数Sourceで二重説明していないか検査。
2. 出典から分かる傾向・動作と、結果成績から推測しかできない値を分離。Direction Intentの0%は本人方針の証拠がなければ推定値として保持し、observed sprayと同一にしない。
3. Sourceに適用する試作値・不確実性・推定根拠を保存し、固定したリーグ/相手/球場/PA/規則で正史シミュレーションする。
4. 基準年の成績分布・年次変動・最高年到達率・特徴的な打撃行動を同時に比較。失敗時は技能モデル、実行環境、Opponent Model、PA等の原因へ戻る。
5. 同一Sourceから公開0–100/G–S、Trait、☆を**Projection**する。Target yearの数字を後付けするTraitや人気補正は加えない。

モデル間の補正・本人のレア度・毎年のピッチング/打撃環境により同じベースでも成績が変わることを許す。

## 5. 安定型と単年突出型の比較

| | 長期安定した超一流（王貞治を例） | 単年突出（2025年カル・ローリー型を検証題材） |
| --- | --- | --- |
| 基礎True Skill | 固定、非常に高い | 固定、個別校正 |
| Window | 複数年の連続全盛期から通常値とPeak Tailを推定 | 突出年と前後・通常年を同時参照 |
| 通常のシーズン | 高い水準で出やすいかをEvidenceと多seedで確認 | 他の年が低水準でも自然に発生し得るかを検証 |
| 最高のシーズン | 最高級の年度成績が到達可能 | 突出年も到達可能、毎年強制しない |
| 不調の説明 | 打席機会、相手、技術発揮、環境、通常のばらつき | 同要因＋必要なら長めの技術発揮状態を検討 |
| 禁止 | 毎年55本に固定する | 2025年だけ魔法Buff/2026年だけ魔法Debuff |

**事実の扱い:** カル・ローリーの2025年60本塁打は単年突出の教材に使えるが、その選手を「歴史的に一発屋と確定」したという意味ではない。前後年の実績と将来の推移の解釈を区別する。

## 6. 固定値と不確実性の出力

全OBテンプレ:
- `Frozen Ability Revision` と `sourceEvidenceVersion`。
- `Season-context/projection` は検証条件を必ず添える。
- 自信の高いSourceと低いSourceを同じ完全確定表示にしない。
- 既存Profileのミート・パワー・選球眼等のUI数字は、ラボ内でのみDraft試作として置き、テスト・資料不足なら `PROVISIONAL`。
- 生成Sourceを実Career内で年ごとに破壊/上書きせず、runごとのTransient StateとEventログで再現性を保つ。

## 7. 軽量チェック — 全選手の14項目監査は不要（2026-10-16改定）

能力再現の品質を判断する最低限だけ確かめる。**毎選手・毎年度に14個のGateを強制して作業を遅らせない。** 同じエンジン・手法を使うなら、最初の代表選手の検証結果を他の選手へ使い回してよい。

| 項目 | 最低限すること |
| --- | --- |
| **REC-01 出典と数字** | 使用年・本人・重要な打席/打数などの分母に間違いがないか、手元の資料で簡単に確認。全サイトの二重照合は不要 |
| **REC-02 代表能力** | 全盛期を都合よくベスト年だけ選ばず、複数年の実績から大まかに導出。詳しい年次調査は疑問が出たときだけ |
| **REC-03 実戦再現** | エンジンが使える場合、代表選手の通常年・突出年が起こり得るか軽く確認。まだ動かせなければ `NOT RUN` と記録して次へ進む |
| **REC-04 根本の不変条件** | OBの基礎能力が年ごとに勝手に変化しない。成績を直接Script/Buffせず、技能と試合から結果が生まれる |

歴史的な些細な間違いが見つかったら**該当項目を一行注記して、必要なら置換して続行**。世界中の資料に同種の間違いがないか調査し直すことを要求しない。全16項目の旧ENVチェックは[環境モデル](NPB-HISTORICAL-ENVIRONMENT-MODEL.md)で撤回済み。

個別の統計・計算が複雑になってから追加の検証を行うことは可能。ただし**必要になった理由があるときだけ**増やす。
 
## 8. 関連文献・一次資料

- [NPB: 王貞治年度別成績](https://npb.jp/bis/players/81383808.html) — 公式ベースの年度別GA/PA/AB/H/HR/BB/K、試合数。
- [MLB.com: Cal Raleigh](https://www.mlb.com/ja/player/cal-raleigh-663728) — 年ごとの本塁打/PAなどを同じSnapshot時点で要検証。
- [FanGraphs: How Good Is That Projection?](https://blogs.fangraphs.com/how-good-is-that-projection/) — 複数年情報・観測誤差・真能力の時間的変化。
- [FanGraphs: Regression Toward the Mean](https://library.fangraphs.com/principles/regression/) — 少数サンプルの一時的突出を真の能力の直接値にしない理由。
- [Baseball Prospectus: PECOTA weighting](https://www.baseballprospectus.com/news/article/15992/reintroducing-pecota-the-weighting-is-the-hardest-part/) — PAと複数年の重みづけの概念。

これらは参考資料であり、MLBで校正した統計係数をそのまま1970年代NPBや現行Miniの投球分布に輸入しない。ユーザーが承認したのは固定OBと全盛期の複数年平均・最高峰到達可能性という**原則**で、未校正の具体的推計式ではない。
