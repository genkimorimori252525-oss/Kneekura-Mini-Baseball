# 次担当AIへ渡す実装開始指示（そのままコピー可能）

Kneekura Mini Baseball の既存計画を引き継ぎ、TBD（ホーム）対LAD（ビジター）を正式な世界先行型 Match Core でプレイできる完成試合へ向けて、既存コードを保全しながら一括実装・一括検証してください。

**最初に**同ディレクトリの 00-START-HERE.md、01-USER-REQUIREMENTS-AND-DECISION-HISTORY.md、02-TECHNICAL-STATE-AND-EVIDENCE.md、03-INTEGRATED-IMPLEMENTATION-PLAN.md、04-ACCEPTANCE-AND-OPERATIONS.md をすべて読んでください。これらはユーザーの最新指示と約束・過去の取り下げ、現在の実装済みと未実装、今後の受入基準を網羅します。古い設計文書との衝突では最新ユーザー指示を優先します。

対象リポジトリ: genkimorimori252525-oss/Kneekura-Mini-Baseball。現在のNative+PNG作業ブランチ: jolly/tbd-lad-native-browser-core-2026-10-14、Draft PR #380、親: codex/current-nonvisual-owner-integration-2026-10-08。mainに無断マージしない。まず自分が実際に使うワークスペースの git status、HEAD、並行作業者、元Source ownership、テストとGitHubを照合し、前任者成果の重複実装や未コミット変更の破棄を避けてください。

守る原則: **一つのCoreで本物の野球物理を進め、選手が実際に走り・捕り・投げ、ルールが実事実を判定し、承認済みPNG Presentationが読み取るだけ。** 連続併殺／ホーム併殺／挟殺／送球先を個別シチュエーションif文で作るのは禁止。守備AIが9人と走者の観測・能力・時刻を使い、一般化した物理的候補・作戦を選ぶ。Native hostが現在ball_handler/holdしか受け付けない問題があるため、base_cover、relay、backup、deep_coverageのsource admissionと本人モーター・複数送球、ForceOutRuleとRuleEngineまでつなぐ必要があります。

以前の独立ブラウザのv23/v28通常9回は**正式Native9回とまだ一本化されていません**。v25/v28の別モードでは本物のNative投球・空力・剛体接触観測ができますが、実打球と9人守備と走者と公式結果を混ぜた9回完走は未証明。Nativeの9回物理178球／58打席はK/BBのみで、実打球・併殺を証明していない。旧独立試作400試合の監査結果を正式Core合格にすり替えないでください。Native original LAN01のrights/terminal合成はまだ未完です。

ユーザーの最新の追加修正を落とさないでください: 捕球成立で全視点の白球を即非表示、地面で本当にバウンド・転がり・減速、3アウトと打者自身のOUT確定tickでベンチへの歩行開始、木製バット提供画像から同じ3Dバットを打者・捕手視点へ投影し芯帯狙い、後方ファウル/観客席ファウル実測、ホームラン確定時の走者前方視線、投手視点から最大2秒後に実関与野手視点、遠近で変化する球サイズと本物のspin同期。**左上の回転拡大モニターは不要**、俯瞰の投球・送球は視認性維持、打球だけ遠く高くなるほど小さく。見逃し球の浅い追尾はユーザーが既に満足しているため変更しない。v23 PNG/B1原画は保持する。

最優先は 03 のPhase 0～5 の因果的な物理・走者・守備AI・公式裁定の接続。各所有者間のソース境界が成立してからPhase 6～9 のPNG統合、TBD/LAD実力校正、PC/スマホ単体保存・実機、100+シード監査に進む。並列ワーカーは所有ファイルを分離。ユーザーは一括実装→一括検証を強く希望しており、通常の継続作業ごとに許可確認しなくてよい。未知の球場法規／性格／LAD年度などを勝手に確定するのは不可。

最終的に、実コード・厳密な受入テスト・失敗時は具体的なblocker、保存された再現可能なsourceとGitHub PR、ユーザーが再開できる引き継ぎを提出してください。PASS/SKIP/TIMEOUT/FAILを分け、上位の統合を証明していない単体試験を「完成」と呼ばないでください。
