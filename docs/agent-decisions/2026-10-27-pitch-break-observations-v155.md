# V155 実投球のキレ時系列観測

2026-10-27 / root / MB-20261027-REALISM-DEBUG-PLAN。Task4の既存計画に沿う通常実装判断。V154診断後も全goal/step-007はACTIVE。

同じ実Sourceの位置/速度/材料姿勢から、共通時刻の無回転＋元空力、空気なし重力、投げ出し接線の3基準を分離して観測する。実投球の本塁到達までを160等分した161標本を取り、時刻閾値は区間内の線形観測とbracketを併記する。これは物理刻みの変更や正史の代替ではない。Source descriptorと既存samplerは残す。

XY最終変位方向への10/50/90%と終盤20%増分、Z差、減速、区間平均加速度と瞬間空力force/重力を区別する。微小/非単調/groundは分類しない。無回転基準が接地するときは既存virtual air-only fallbackを明記。3基準とも同じ投げ出し位置/初速度で、同じ時刻と同じz断面を混ぜない。10%時刻を厳密な物理的開始時刻や人の認識閾値と偽称しない。

target/commanded/逆算済みnominal初速度を正確に観測するため、LivePitchへread-onlyの明示要求pitchCommandObservationV155:trueを追加。Workbench内部だけが要求し、通常試合/省略入力の診断形・実行は保持する。観測値を投球・打者判断へ戻さない。Workload等の実行前nominalと実行後releaseを分ける。新しいforce law・開始タイマー・得能Buff・乱数を追加しない。

計画はv78 UIを挙げているが、現候補の採用入口はv92。現行v92の固定metrics様式へ必要な観測表示を追加し、v78へ戻さない。見た目/画面構成の再設計はしない。既存保存は全metricsを保持するが試投結果の読込入口が無いため、保存input/contextを現在の同Coreで再計算する明示経路を整備する。過去観測欠落を0へ補完せず、旧結果を現在版の再試投と区別する。元roster/選手設定を変更しない。

実測: PBT pure10件、実Sourceとの一致/入力不変/旧metrics保持/force/JSON再計算のTDD、同Chrome main/実Worker純データ一致、現候補UIと保存再読を検証する。モデルの終盤集中を独立調整できると主張するには、同release/同targetと既存physical parametersの対比較・実現可能性確認を別に行う。未達を維持する。

原JSON/原素材/共有dist/旧候補/全FAILを保持。復旧は新観測呼出とUI表示の除去または旧別名候補。Source未commit/push/merge/deploy。分類/人的校正/通常戦術、V153準備証明・人体/SPIN/Native、旧残件、性能B/9回/最終配送、SIGN命名ペナント延期は継続。
