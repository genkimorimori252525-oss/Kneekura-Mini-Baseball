# 非デザイン残件：未質問の政策・校正

以下の3群は未質問。**初期案は提案であり実装承認ではない。** 移動play完了条件は別途質問済み・回答待ち。個別の受理処理と自律生成の完成を区別する。

## 球場特則

例：屋根への打球、観客席への送球。現在は受理geometry・legal領域・policyで物理履歴を検査し、対応済みfoul等を解釈できる。新しい屋根規則や進塁権は入力だけでは実装済みにならない。元計画は物理事象→規則解釈→公式裁定を要求する。

**初期案**：最初の1会場・1RuleProfileについて、基準規則と明示的な球場特則を固定し、未記載事象は未解決に保つ。**未確定**：屋根・壁上端・開口の扱い、打球／送球のdead・award条件と基準時刻、妨害者の適格性・意図・結果、完全な境界geometryと接触material。

## 自律Career

例：翌日の給与・補強・試合前roster。現在は明示season/day、給与policy、レポート・選択・契約条件、合法候補・保持beliefから実行できる。元計画とcanon31/49はCareer／CPU判断の自律実行を要求する。外部入力は可能だが、毎回人がCPUの結論を決めるだけでは自律完成ではない。

**初期案**：共通実日付で1日ずつ処理し、未完試合・必須決済・必須判断／入力不足で停止。通知だけでは止めない。補強は既知レポート・既存予算／役割policy・提示済み条件、rosterは試合前の受理済みGame Plan候補から開始。**未確定**：Career開始日とseason対応、停止義務の範囲、候補順位・打診／見送り・再交渉規則、相手の応答、判断起動時点と観測／予測値の生成。

## 因果的な選手育成

例：代表戦の経験から練習し、定着した技術を次戦で使う。実参加・実repetition、受理appraisal／処方／assessment／policyによる学習、明示再測定値の能力更新は接続済み。元計画は実機会・身体・負荷・学習の因果接続と一部hidden profileの生成を要求する。外部評価者の受理入力でも前者は動く。全drillの自動処方や万能成長式は規定されておらず、任意の追加drill網羅も完成条件ではない。参加だけの加点は禁止。

**初期案**：既存実行familyで処方し、実消費・負荷・定着後にdomain別の受理再測定を反映。測定なしに増分を補わない。**未確定**：自律処方と本人appraisal、relevance／swingScore、身体・能力の測定／適応式、学習係数・閾値・確率・cooldownの校正。外部assessmentの受理は自動生成の証明ではない。

## 根拠

- [元9領域 §5](2026-10-04-nonvisual-implementation-checkpoint.md#5-残る確定済み非デザイン計画)、[球場policyの不足入力](../superpowers/plans/2026-10-05-venue-legal-evidence-contract.md#user-owned-policy-decisions)、[現在のrolling legal接続](2026-10-10-rolling-venue-coverage.md)。物理／解釈／公式裁定の分離は[adjudication正本 §§1–3](../game-design/07-world-first-adjudication-contracts.md)。
- [canon15 §2.1：日付とversioned profile](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/blob/44b9f5de7b9d87e649f12f1af78c202f2b5ab44d/docs/game-design/15-season-events-and-deadlines.md#L58)、[canon31 §§7–8：CPU補強](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/blob/44b9f5de7b9d87e649f12f1af78c202f2b5ab44d/docs/game-design/31-scouting-recruitment-system.md#L262)、[canon49 §§16–20：判断と予測](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/blob/44b9f5de7b9d87e649f12f1af78c202f2b5ab44d/docs/game-design/49-manager-architecture-v1.md#L614)。[受理day](2026-10-09-accepted-domestic-calendar-day.md)、[給与](2026-10-09-staff-wage-economy.md)、[Manager実行](2026-10-10-issued-roster-execution-producer.md)。
- [canon53 §2：因果原則](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/blob/44b9f5de7b9d87e649f12f1af78c202f2b5ab44d/docs/game-design/53-player-development-trajectory-breakthrough-v1.md#L49)、[§§8–11：appraisal・定着・校正](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/blob/44b9f5de7b9d87e649f12f1af78c202f2b5ab44d/docs/game-design/53-player-development-trajectory-breakthrough-v1.md#L272)、[§28.29：数値校正](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/blob/44b9f5de7b9d87e649f12f1af78c202f2b5ab44d/docs/game-design/53-player-development-trajectory-breakthrough-v1.md#L1012)。[能力更新の受理境界](2026-10-10-accepted-physical-capability-history.md#残る境界)。
