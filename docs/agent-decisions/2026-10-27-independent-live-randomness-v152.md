# V152 用途別乱数と再現可能な一球介入

2026-10-27 / root / MB-20261027-REALISM-DEBUG-PLAN。V151は実Source/実ブラウザ検証を伴うprogress。現在もstep-007/全goalはACTIVE。

## 変更前の不整合

LivePitchの旧rはフォーム→球種menu→球速→コース→制球誤差→motor timing/aim/sweetSpotを同cursorで消費し、分岐で後続誤差が変わる。directionTrialSeedV79もV122のbelief/commitment/direction全3drawを変え、方向だけの対比較にならない。下流の認識/通信/投球target/spinもseed routingが必要。守備と走塁は旧field seed/fielding phaseを共有する。

## 決定と共有契約

新しい任意 `randomnessV152` はversion/sourceId/scope/任意の用途別uint32 overrideを持つ。scope MATCHは試合group root、PLAYは当該論理投球とその守備・走塁のgroup root。MATCHからPLAYへ、各overrideを既存の全体投球連番式 `(seed + imul(ordinal,0x9e3779b9)) >>> 0` で派生する。同ordinalの再実行/順不同job/Worker再開では同じseedとなり、再生回数で進めない。

13domain: pitchChoice/pitchTarget/pitchExecution、batterForm/batterBelief/batterDirection/batterApproach/batterPerception/batterExecution、communication/catcherPerception、fielding/baserunning。domain内も用途keyで分け、既存下流APIのactor/opportunity/tick等のkeyを保持する。投球前の捕手targetはpitchTarget、捕球用の捕手認識はcatcherPerception。方向commitment/choiceとbelief抽選を分離する。

旧入力の省略時は同じ旧r/seed/消費順/出力を保持する。新しいMaker候補は明示policyを採用する。旧個人profile/保存JSONを暗黙変換しない。方向のseedは意図を変えるもので、実際の打球方向を上書きしない。実行誤差のseedも運動/接触の前に使用し、出力を後補正しない。

通常HostのcommandへPLAY policyを渡す場合は明示された検証介入Sourceとして記録し、MATCHから派生したoverrideへ当該球のoverrideを重ねる。入力scopeを取り違えない。これを打者の知識・監督の心理・Native権限へ渡さない。旧directionTrialSeedV79は新版でdirection domainだけの互換aliasとする（新しい明示domain overrideがあればそちらを優先し、traceで区別）。

seed/用途key/このwrapperのuniform消費数をpure traceへ残す。委譲した下流API内部の消費数を計測したとは称さない。validation後のcanonical policyはproperty順でbindingが変わらず、config全体のV150所有/継続拒否を維持する。

## 検証と復旧

RED→GREENで用途独立性、方向介入でbelief/振り方/認識/投球/実行誤差/フォーム不変、実行誤差介入でIntent/通信/認識/投球不変、menu分岐による無関係cursorの非移動、受理/未採用/再開のfullrecord一致を確認。事前固定の一意uint32 seed群を用い、正重みの分布とゼロ重みの非選択を検査し、全員均等の人格profileや方向交代を作らない。守備と走塁も実Sourceで別rootのpositive drawを確認する。

Source/時間刻み/探索予算/能力/裁定は変更せず、新policyを省略または旧別名候補を使えば復旧できる。原JSON/原PNG/スイング/V133/旧候補/全FAIL/TIMEOUT/UNKNOWNを保持。本人goalと通常判断の記録方針のscope内で進め、Source未commit/push/merge/deploy。球種分類/人的校正・方向戦術・ニッチロー接触・キレ・SPIN/SIGN基盤と旧残件・性能B/9回・最終配送は継続する。
