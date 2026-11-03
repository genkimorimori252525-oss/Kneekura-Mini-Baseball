# チーム判断から選手移動への接続

`SamePlateAppearanceTeamMotorSelectionV1` は、元の SQLite owner が再導出した
field prefix に対する内部検査である。Source の認証を代行しない。

`defender_motion_v1.selections[].decisionReference` が
`defender_actor_selection_v1` を参照する場合、全9人を同じ最新の
`defender_team_selection_v1` から採用する。部分採用、重複、旧個人判断や
catch response との混在、別チーム判断の混在を拒否する。
各選手の元判断・観測・actor selection は最新でなければならない。

actor selection の生成後に許すのは、同じチームの兄弟 metadata と、
選手の全 primitive curve を保持した、イベントのない自由球の時間進行だけ。
metadata は物理時刻・world・保持者を変更できない。
捕球、送球、別動作、新観測、新判断、新チーム選択、物理境界をまたいだ
古い assignment の発行は認めない。移動開始は既存の整数時刻・first-step
期限・身体曲線 coverage の検査を通る必要がある。

Native Action owner は現在の dispatch member、calibration、nominal model、
binding、Person、元 posture の身体と self を既存処理で認証する。
チームの選択候補・目標・schedule を明示的に support motor へ渡す。
旧 generic motor の対応役割や、旧 Source の計算結果を変更しない。

Live-work census は metadata だけでは判断を消費しない。
新 motor が実行された時点で、actor selection が参照する元の判断を
consumer に結び、選択意図・目標・移動開始 schedule の一致を検査する。

検証: 関連3ファイル39テスト、TypeScript 検査合格。計算試験のモデル読取は
模擬している。1件の候補 Source 保存・状態更新・cold reopen は別の真正な
SQLite 証拠で確認済み。全19件の候補／team／actor Source と9人の motor の
真正な保存・実行は未完了であり、混合9回・公式結果の合格ではない。
新しい空力 root の actions は、別の対応検証まで未対応として拒否する。
