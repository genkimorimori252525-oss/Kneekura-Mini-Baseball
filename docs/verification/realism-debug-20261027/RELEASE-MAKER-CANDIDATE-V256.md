# 新Source構成のメーカー候補

2026-10-31。r6 は V248 を明示 opt-in の診断として含み、無指定の既定へ採用しない。親 Workbench と２つの埋込ゲームの Native を新 bundle へ交換し、旧 Maker と元の素材を別途保持した。元 UI に存在する固定download名は元のまま、本人 raw JSON を build 入力に使っていない。元 roster・素材を含むため local-only 候補であり外部公開範囲は未確認。

選手名表示を追加した候補 `work/maker-contact-name-v257-candidate-02/maker.html` SHA-256 `996407dbdbf193e22369f01466fe1750493df524df20158fbf20460b9e2145cf`。名前は現在の catalog を参照し、保存 record の player ID は変えない。保存済み record にも現在登録を参照する旨を表示する。名前を取得できなければ ID を表示し、入力された文字はHTMLではなくtextとして扱う。

本人 JSON を環境変数から通常 import し、固定seedの実Chrome 156.0.8078.76・実Workerで、練習画面の手動 PULL とおまかせ AUTO の受理、AUTO の REACTIVE 診断、実接触１件と参考帯外表示、local report の公開 API 経由保存・再開、新sessionと390pxを確認。receipt `20ca4cd0c71b4d5cbd81fd15415bc6ff` PASS、24.686秒、report SHA-256 `be16dbec75e7a3207e7f52b345319f6a7cd154089c0a9aee95441869972957f3`、11 artifact・log・画像・終了pinを照合した。

この保存再開は `PUBLIC_API_EXPORT_RESTORE_NOT_FILE_GUI` であり、ファイル選択画面の操作とは区別する。旧V248のUI保存ファイル実物は確認できず、新stampでの再開は `NOT_TESTED`。元Makerの保存経路を維持し、診断artifactから保存ファイルを再構成して本人のものと称しない。埋込ゲームはhidden rendererで、GUI検証していない。キレの３名称はUI上の確認であり、元球種を保つ物理３段階の実証ではない。

初回のstamp構造不一致 `c4a8627317c54c2abf4e2430ef0b62b5`、同名代入の複数候補 `5eb45de1c8044f7eb7a1d0ad7d48da03`、旧UI固定download名の誤検出 `11abe47b78fc44a58c1501bc232220f6` はいずれも出力前 FAILとして保持。旧stampや実際にユーザーがV248保存を保有するかは未確認。Maker・通常HTML・調整室の同版最終配送、全９回・４回転・キレ物理は未完。
