# 最新の再開入口 — 2026-10-20

現在は **メーカーv75／通常試合v75／調整室v75**。既存branch `jolly/tbd-lad-native-browser-core-2026-10-14`、[Draft PR #380](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/380)で継続、main未マージ。

- [HTML・保存方法](../demos/releases/v75/README.md)
- [実装・暫定係数・検証・限界](../reports/2026-10-20-v75-technical-traits.md)
- [検証索引と原FAIL](../verification/releases/v75/README.md)
- [元の全要求・計画](2026-10-15-mini-baseball/00-START-HERE.md)

追加6技術：走塁/bunting/advanced_fielding/bat_to_run_transition/slow_ball_charge/low_zone_command。profile.source.effectScale0〜2を専用動作へ一回、旧7/default20/物理SI/公開能力/カメラ/UI/元実測記録は保持。従来catalog呼出7、includeTechnical:trueで13。0/offはruntime省略でv74との初期6球exact。通常254球95接触の技術入り9回完走。最終Source39tests/TSC、maker実保存/比較・普通game/lab1200/390、旧215凍結物/union124照合。

公開resolver単独の未知profile黙認を独立レビューで修正。原FAIL/中間成功を削除しない。旧Core replayは拒否、設定JSONは互換。技術係数は未校正、ローカル作成設定をNative習得認証と混同しない。残る技術・心理・故障・盗塁・身体ブロック/こぼれ球・100試合分布・実機・Native連続world等はCURRENT/原全計画から継続。ユーザーAGENTS編集を除外、原CharterHOLD/旧FAILUNKNOWNを維持。
