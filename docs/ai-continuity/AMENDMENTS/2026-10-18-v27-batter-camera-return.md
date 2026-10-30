# 2026-10-18 打者カメラのlv27基準への復元

人間の最新要求: 見逃し後の微動を止め、Downloadsのlv27 HTMLの打者カメラ・見逃しを参考に戻す。スイング軌道・位置・打者仕様は最新版を維持し、打球へ向くのはスイング終了0.7秒後とする。

同Downloadsと承認baselineはSHA c613574b377afd19060d89100c1bd7c1fa693efd42361c77ed7ab21943670f1fで一致。新しいv50表示のみのhelperで、lv27のeye/opticsと165ms制限角の見逃しを使い、捕球後のreturn-readyと角速度積分を使わない。実球のプレート近傍への到達で開始する。予定打点を有限実測軌道のreferenceThroughTick+700msまで保持し、その後は既存field observerへ戻す。実走者の身体追従eye、最新バット/能力/守備走塁/他カメラ/UIを保つ。Native/Core真実を変更しない。

検証: 基準構図・左右・見逃し静止・実測終端+700ms・停止Source時計・巻戻し・prefix因果性、実ブラウザ1200/390、v49と実Core/バットSHA一致。元全計画はIN_PROGRESS、原FAIL/UNKNOWN/Charter HOLDを維持。既存ブランチ/Draft380への保存承認を継承しmain未マージ。
