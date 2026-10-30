# cut11からfield/裁定へ必要なwitness V196

2026-10-29 JST / `MB-20261027-REALISM-DEBUG-PLAN`。全goalは進行中。

正常cut11から既存field/live-ball/official経路へ進むため、保存済みの入力をreadonlyで確認した。`37516ae4cb854e8db5ef24b1f124d406`はPASS22094ms。これはinventoryの実行成功であり、field-rootや公式終端の成立を意味しない。

## 保存データの認証結果

| component | 結果 |
| --- | --- |
| participant body/posture | 正常body10件、posture coverageを認証。currentTick34054636 <= validUntil42765369 |
| field geometry/model/response | 該当namespaceが存在しない |
| fresh field calibration/field-root | namespaceは存在するが当該enrollment/pitchのscoped locatorは0 |
| plate assignment/OfficialPerson/live policy | 当該投球の受理済みoriginal inputsとして未提供/未受理 |
| catch work | namespaceが存在しない |
| initial live-ball status | `unknown(initial_live_ball_owner_missing)` |
| field-rule/venue coverage | `owned_active_field_cut_required`。legacy venue-policy namespaceも存在しない |

body10件が利用可能でも、field modelの受理まで済んでいるとは扱わない。official inputsは正常live-ball/catch recordの`originalInputs`だけを候補とし、仮想registryやPlayerPersonからは構成しない。候補はLIMIT3で未検査tailを検出し、認証上限2。namespace不存在・scoped locator0・query拒否・getter拒否・複数候補/未検査tailを区別し、限定探索を全件不存在へ拡張しない。

## 検証と非消費

- 新entryと依存のstrict型はrecord union/narrowingの`c24cef33` FAIL9061msを保持し、guard修正後`9c79793e979e432baa28a14a5492f132` PASS2359ms。
- 新mjs構文検査とcritical入口/終了の静的reviewで重大な欠陥なし。
- 実Node pinned entryによるreadonly inventory `37516ae4` PASS、791 Source/bundle/harnessの開始終了pin一致。
- OSreadonly/query-only/caller transaction/savepoint/authorizer、main/WAL/journalのbytes/SHA、catalogと訪問7rowid locatorが不変。raw SQLは候補locatorだけで、正常getterを認証に使う。
- Writer/新物理/practice/旧Native scenario再実行は0。旧launch前DBもこのinventoryでは開いていない。

private DB/start-manifest/inventory/raw reportは公開しない。新ts SHA-256は`b832fbe0dd1283540d8610c306d28c460662d84f8408f5b74b9a2e1621017ad6`、mjsは`48712c8e3ef5b7d582db82eeeee10a8a636ea873c988fe26485a777cceef03a8`。

## Source上の接続条件

正常field-root入口は存在するが、明示geometry/model/response-modelの3 refs又はfresh field-calibration、commands、physics、coverage内のthroughTickが必要。fresh校正は元action/postureと同じviewを要求し、新規受理ではその旧viewのcurrent next-pitch basisを再検証する。cut11へ参照を書換えたり、post-contactで新規受理できると仮定しない。

3 refsも独立して新設するAPIではない。geometryの新受理は実Original flight、modelは実contact、response-modelは実first-fielder-touchに併設される。同fixtureの既存historical校正の再利用経路であり、SamePA resolutionをOriginal flightへ代用しない。

また、8項目のground/flight parametersだけのlegacy field経路は自由飛行が重力のみで、spinを空力へ作用させない。Goalに使う継続は**対応予約Source version＋明示`AeroGroundBallPhysicsV1`**とし、`resolution.contact.exitSpin`3成分→連続球道→SourceFreeBallKernel→AerodynamicPitchTrajectory→BaseballAerodynamicsを保持する。default aeroの注入やgravity-onlyとの同等扱いはしない。

LiveBallStateは正常`field_active`とfield-rule evidence、独立したplate assignment/OfficialPerson/policy、playにはvenue legal coverage/pitcher plate/実投手状態を要求する。既存Outcomeの`count_terminal / untouched_foul / fair_catch`はcut11のcontact1だけでは証明できない。foulは実dead-ball evidence、catchはcatchWorkと実catch end、さらにofficial policy/scheduler witnessが必要。これらはcode-onlyの限定調査であり、当該DBで受理済みとは主張しない。

## 次の一件

旧V193-01の`launch-right-ready`保存地点をreadonly正常Ownerで再認証し、元action/posture viewのcurrent性と未launchを確認する。成立すればprospective fresh校正を正しい時点で準備して初launchへ続ける候補になる。6practice/2TAKEを作り直さず、未知のright/fullrefは推測で認証しない。今回の2Sourceはfreezeし、旧FAIL/TIMEOUT/UNKNOWN・他の全scopeを保持する。
