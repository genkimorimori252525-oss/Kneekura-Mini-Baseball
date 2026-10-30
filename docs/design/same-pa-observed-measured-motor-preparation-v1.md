# 初球の観測から実測バット軌道を準備する接続

2026-10-16。全体goalは作業中。MMDは使用しない。

## 変更

`BattingMotorPlanV1` に既存の打撃実行で使用していたモーター計画を抽出した。既存の実行処理と初球の準備処理が、同じ実測キー、座標登録、技術的タイミング、身体準備時刻、運動遅延、速度上限を使用する。

初球のNative操作列に `same_pa_observed_initial_motor_preparation_v1` を追加した。現在の観測予測、元の打者モデル、元の `batter_motor` / `batter_swing` 校正を認証して計画を保存する。実打球の未来軌道は渡さない。予測とは別に `swingScore` を捏造しない。

このSourceの `aggression` は研究用の明示入力。実行済みの判断や感情を表す値ではない。保存レコードは `scope: motor_preparation_only`, `motionIssued: false`, `physicalEffect: none`。実際のSWING採用・打球・公式イベントは生成しない。後続球用の既存ガードは変更していない。

## 実行した検証

- 打撃判断と実測打撃の既存45件に、新境界の5件を追加し、計50件PASS。全src型検査、検証ツールのstrict型検査PASS。
- 新規18人・重力/空気抵抗を含む初球・実測モデルが同居する保存DBに、7番目の操作として実測軌道の準備を追加。137個の元キーからの剛体軌道を保持。
- 不正な校正、予測以外の参照、実軌道の追加、古い操作列からの採用を拒否し、既存行が不変であることを確認。
- 別processで元ownerによる7操作の再計算、66tableのschema/全行、DB本体とWALの不変を照合。
- 型だけの修正前後で、実行済みhelperと現TSからの生成JSが同一であることも照合。

最新結果: `outputs/verification-observed-motor-preparation-v3/independent-readonly-readback.json`。実行コマンドとログSHAは `docs/ai-continuity/verification-receipts/MB-20261016-OBSERVED-MOTOR-*`。

## 監査で見つかった不足

1. 計画上の開始tickは10935197、投手制御の期限は10787305。約148msの不足を、静止・外挿で埋めない。現在の位置・速度と連続する次の動作制御が必要。
2. 感情・打撃判断・実行TOTAL/身体消耗・更新後校正・バットの実制御採用は未接続。研究用の計画生成を、それらの完了として扱わない。
3. 全軌道の身体との整合、手元の連続性、到達可能性を、採用時の実際の身体制御に結び付ける必要がある。単一の剛体変換が作れたことは、人体で実行可能な証明ではない。
4. 初球の速度/回転や18人のSI値は合成宣言値。NLB本人の実測能力、リーグ母集団、ファウル分布、実測投球への校正は未完了。

## SQLite証拠の扱い

先行artifactには1ページのWALが残っていた。DB本体だけをコピーせず、SHAを照合した本体+WALを私有stagingへ複製し、Native backupで一貫した検証DBを作る。SHMは読取ロックの一時索引として、永続内容と区別する。

また、既存の初期世界再読facadeは、readメソッドでも内部owner接続でjournal modeを調整し、WALを書き替えた。原DB本体のSHAと全行だけでは検出できなかった。旧結果は保持し、`independent-durable-readback.json` の `durableFilesUnchanged: false` を隠さない。最新readerでは原DBをOS読取専用で読み、facade照合にはschema/全行が一致するNative backupを使う。最新結果は本体とWALとも不変。

先行失敗、型検査失敗、ゼロ重力の試験用モデルでの旧greenは履歴として保持する。正式Coreでの実打球を含む9回完走、100試合監査、実機スマホ試験の証拠にはしない。
