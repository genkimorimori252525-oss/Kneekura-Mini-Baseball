# V115 taken-ball対照の契約監査

- 日時: 2026-10-24 JST
- task: `MB-20261024-V115`
- 委任: 主担当から既存roster taken-ball FAILの原因監査、凍結V113による同入力再現、JSON証拠・判断記録の作成を依頼。製品・既存testは変更しない。
- 対象: `LivePhysicalRosterV1.test.ts:65` の ON/OFF対照。`liveMatchFixture(2468)`、`bad_ball_hitting` の `LEARNED` ON/OFF、`batting:'take', managedTeam:0, pitchType:'auto', location:'auto'`。

## 原因

これはV115のathletic controls接続で発生した差ではない。同じfixture構造とmeasured clipsを凍結V113の実埋込Coreへ渡すと、旧testの `a.frames===b.frames` と `zoneJudgment` 全体一致の双方が既に成立しない。

Hostの `LiveBaseballMatchV1.ts:209,224` は管理対象が攻撃側の場合、投手の球種・狙いをautoとして渡す。今回の `managedTeam:0` は1回表の攻撃側なので、投手側の狙いは自動である。単にcommandのlocationだけをzoneへ変更しても、このHost経路ではautoへ上書きされる。

V111の配球plannerは `LivePitchTargetPlanV111.ts:106` で相手のraw `badBallControl` をchase領域の接触コストへ反映する。ON/OFFではこの値が `.83 / 0` となり、同じseedでも候補コスト・僅差候補集合が変わる。`LivePitchV1.ts:189–191` が採用位置を実targetへ渡すので、実際の投球初速・球筋も変わる。これは公開ランク変換・能力buff・見逃し球への直接的な物理補正ではなく、自動配球が相手技術を評価した帰結である。

`zoneJudgment` 全体も同じ球に対する同じ誤差という意味ではない。今回の判断誤差と標準偏差はON/OFFとも0で同一だが、観測した実球位置が異なるため `observedForecastPosition` と `estimatedPosition` が異なる。

## 実測と対照

凍結HTML SHA: `aab69cc021aa07958a65982a70b480609adbf241df291a5c857c7abe390f6205`。
凍結Core SHA: `3d0ef3a2477816a3157e59f9a8235e1459913fa35f74f791541c8cee8e885a37`。

| 元のHost auto条件 | ON | OFF |
|---|---:|---:|
| requested x (m) | -0.14961106697701212 | -0.211582 |
| requested y (m) | 0.5592279320332683 | 0.7245 |
| 僅差候補数 | 68 | 72 |
| 最終tick | 1476667 | 1476380 |
| swingOffered | false | false |

両方46フレームで公式分類はcount。初回フレームから実球velocityが異なり、全ball frameも異なる。plannerの `futureSourceUsed:false`、同じcount・walkCost・batterThreat・command sigmaは維持される。原FAILは保持し、修正済みPASSとは扱わない。

別対照では、同じraw playersとON/OFF rosterを凍結Coreの `buildPitcherWorkbenchInputV77` へ渡し、同seed・origin、fastball・zoneを固定した。試投はtakeを強制する。この投球inputの差分は `batter.badBallControl` の `.83 / 0` のみで、全フレームとzoneJudgment全体は完全一致した。auto状況contextは渡していない。これは「同じ投球commandに対してbadBallControlだけで見逃し球の物理を変えない」という元の独立性を、配球選択を混在させずに直接確認する対照である。

入力一式SHAは実行前後とも `e429bbabb07ecbcbf85428b984ba971765b86b29e6bb2ffc402b78da8a6ce460`。凍結HTMLも実行後に再hashして不変を確認。4球の計算部分は約279ms、CCGの全実行は1750ms。

## 最小のtest契約修正

1. 現Host testは「ON/OFF内部値をHostへ渡し、takeを守る」契約に絞る。両方のraw値、`swingOffered:false`、無接触・無守備継続、同一判断誤差／標準偏差／stream／basisを確認する。球そのものが異なるため、フレーム全体とzoneJudgment全体の一致は要求しない。
2. 元の厳密な非干渉検査は固定commandのPitcherWorkbench対照へ残す。input差分が `batter.badBallControl` のみであることを確認した上で、全フレーム・zoneJudgment全体の完全一致を要求する。
3. 自動配球の相手技術参照はplanner側の契約として別途扱う。今回の特定targetや最終tickへtest期待を合わせる必要はない。

この分割なら厳密一致の検査を失わず、相手に応じるV111配球契約とも衝突しない。plannerからbadBallControlを除外する案、takeなら相手の技術評価を消す案、同じseedだから球筋は不変と仮定する案は採用しない。

## 証拠・復旧

- JSON: `docs/verification/releases/v115/taken-ball-audit/report.json`
- 再現probe: 同folderの `probe.mjs`。新規reportへ排他的に書き、既存証拠を上書きしない。
- 正式receipt: `docs/ai-continuity/verification-receipts/MB-20261024-V115_a701e42d17944effb87ff8dcaaca7e55.json`（対応logを含む）。これは原因監査harnessのPASSであり、元test全体のPASSではない。
- 原roster FAIL: `MB-20261024-V115_3052b0c3aa8d4a949ce2825649848742` を保持。
- 初回の原因監査時点では製品・test・入力・dist・公開HTMLを変更していない。監査自体の復旧は追加資料のみを除外すればよい。以下の追加委任でtest契約だけを修正した。
- 限界: 合成fixture1件の因果切分。配球コストは未較正の予測モデルであり、この監査は一般的な選択品質や野球統計を証明しない。

## 追加委任によるtest反映と凍結

主担当が上記の証拠に基づく分離を承認し、`LivePhysicalRosterV1.test.ts` のみの編集と正式検証を委任した。元Host対照はraw値の伝達、双方のtake、無接触・無守備継続、判断誤差／標準偏差／stream／basisの非干渉を検査する。具体的なauto target・tickや結果へ期待を固定していない。

追加の固定fastball／zone試投は、入力の差が `batter.badBallControl` だけであることを先に検査し、双方のtake、全フレームとzoneJudgment全体の完全一致を要求する。元の強い非干渉検査をこの独立した対照へ維持した。製品コード・raw能力・fixture値・公開HTML・distは変更していない。

正式検証: `LivePhysicalRosterV1.test.ts` 全37件PASS（Node24、1 worker）。receipt: `docs/ai-continuity/verification-receipts/MB-20261024-V115_39a9ee75c3fc4d578dbad46dec2932a8.json`、対応logを保持。検証後は同testを凍結し、主担当がcandidate2で全source snapshotを採取する。復旧時はこのtest契約変更だけを戻し、原FAILと凍結V113監査証拠は削除しない。
