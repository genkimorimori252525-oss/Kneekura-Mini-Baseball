# V178: 自動recipeの球種適用域を新入力で確認する

2026-10-28 JST / `MB-20261027-REALISM-DEBUG-PLAN` Task4 Step5/7。V177/7ddd82e8は右curve prototypeの一致と順序を実証したが、leafは回転基底から同じrecipeを作るため他球種の段階順序をまだ保証しない。この不足をラベルや既存PASSで隠さず、先に球種を固定して新測定する。

新対象はfastball/slider/splitter。元V176 baseline trialから、現Coreの正規 `createPitchSnapshotFromPresetV78` で各設定例を生成してselected pitchを置換する。各球種の通常＋自動3状態、12普通入力を最新V177 Core02のNative/WB×Main/実Worker/JSONで比較。再現seed/速度・能力・狙い・球物性/Source刻みは入力に保存し、新しい係数や手入力recipeを作らない。旧curve/旧研究の再実行ではない。

返却された実Workbench samplerを保持し、3gradeの最小own時計と、通常球を含む最小own時計を区別する。共通641点/各own641点、Coreの新net observerと実ground履歴、量・方向・p10・p90-p10・late20・到達時刻・減速・通常比の副作用をraw保存する。絶対量差2cmかつ相対5%/方向5度とP/D/Lを変更しない。旧A=.05は参考、知覚閾値を新設しない。

PASSはruntime/control/記録/pin整合の意味とし、球種別のQ/P/D/LやNOT_APPLICABLE/FALSEを品質結果として別に保存する。順序が成立しなければ未実証域の具体的な反例として残し、入力の差替え/探索拡大/閾値緩和/後処理で合格へ変えない。現段階のcurve限定実証を全投手/全球種/Native習得へ昇格しない。

準備担当は新harnessと新outputだけを所有。Source/UI/旧harness/型/buildを変更・再実行しない。Chrome実行はRootのみ、同Chrome156.0.8078.49で一度行う。UI受入は独立した実表示/保存の検証で、domainの品質結果を先取りしない。
