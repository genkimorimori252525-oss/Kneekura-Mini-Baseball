# V161 明示AUTO/REACTIVEの観測対応

2026-10-28 JST / MB-20261027-REALISM-DEBUG-PLAN。全goal/step-007はACTIVE。共通CCG整備後に実装した限定工程。人体・Native認証・最終配送の完成ではない。

## 実装

`planObservedReactiveRegistrationV161` を追加し、V153の有限yaw/surface登録/最初の主観接触/木材応答/全運動certificateを共用した。目標角を渡さず、固定held→arc開始の最大grip/tip移動量÷準備時間が小さい実行可能候補を選ぶ。このcostは幾何的規約で、人体の努力量の実測値ではない。

LivePitchは明示AUTO＋REACTIVE＋V153 policy＋配達済み主観予測＋振る判断成立のときだけ接続する。TAKE/BUNT/SPIN所有、request/policy省略、手動/V122方向は従来経路。実行誤差は名目計画後。方向抽選・仮CENTER・実球未来・実接触結果の逆流・上限緩和は加えていない。旧test期待の変更理由は `../../agent-decisions/2026-10-28-reactive-registration-v161.md`。

## 本人の同じ連続ケース

原本SHA e0123a572d66bf6bd5fa92af6c9ffbe6fe47fbcf27d00135c9441bf95927b3ce不変、livePhysicalRosterのみ採用、1-b0/obp-23_5、seed20261019、全673clip/92,201frame、Chrome156.0.8078.48、通常5000tick。初球AUTO未採用→TAKE受理→次球AUTOを前版と同順で比較した。

| 場面 | V160 | V161 |
| --- | --- | --- |
| 初球AUTO/TAKE | 見送りball、0-0→1-0、記憶0→1 | それぞれ全record厳密一致 |
| 次球の名目方向 | REACTIVE/null角 | 同じREACTIVE/null角 |
| 次球の運動 | REACTIVE_NO_ANGLE_TARGET、不適用 | PLANNED、yaw5度、転送cost4.614193724835248m/s |
| 次球の実打球 | 後方foul、field/pull角146.8555054035843度 | live_ball、左打者の引張側30.147592107593237度 |

保存済dataの12対照も厳密一致。初球/TAKE全record、次球beforeMatch、clip、Source descriptor、観測/想起、全乱数trace、方向解決、timing/aim/sweetSpot誤差、振る判断は同じ。変更した運動と接触の効果を区別できる。再試行/seed探索ではなく、対照比較によるsimulation再実行は0回。

初球は見送りのため実打球方向は未実証。1例を全分布/全心理/全打者の偏り解消の証拠にしない。新しい実打球による打席/守備/次打者の遷移は通常Hostに従い、旧foulのカウントを強制保持しない。

## 実検証

| 対象 | 結果・receipt |
| --- | --- |
| core先行RED | 新API未実装5件、67d698e7903c4497a46c4a86dfb868d6 |
| integration先行RED | 2 FAIL/旧省略対照1 PASS、aa107480e73f4725857b181b6adbea5e |
| core既存14＋新5 | 19 PASS、d62f0098bfcb4fa29a117e1e7699cb20 |
| core最終新5 | 5 PASS、dfa360891da34d6291c98a0db403651a |
| integration/既存motor | 16 PASS、bcddfef89da04d469c086daa913bbd0a |
| npm run typecheck | PASS、4a7d0947780b41499724855e94164824 |
| 同Chrome本人連続/保存再読 | 26厳密比較、26.390秒、817916a3307f40e985587e8ffe25f24d |
| 保存済因果対照 | 12厳密比較、9cca9408577642789039dbec93337c1c |
| PC1200/390方向UI | 10cases/JSON/本人復帰/元roster不変・旧request省略2球full-record厳密一致、05c8b960ef994253983dc5ce019c3c4f |
| 最終Source/候補/原本整合 | PASS、82a29fda1e044ff69e2cd7c687d7b1d5、ゲーム再実行0 |

独立read-only reviewでも追加の阻害問題は見つからなかった。core19件は最終不正入力guard補足前、新5件と型/Chrome/UIは最終Sourceの証拠として区別する。人体校正/V154の保守boundは未解決。

途中FAILも保持。workerのundefined拒否文言の誤期待0486417a、Windows npm直接spawnのlauncher ad53db9b、旧Maker/新Core不一致の実guard拒否6473f8f1（試投0）を区別した。guardを緩めず新Makerを生成し、runnerへ `--maker <folder>` 選択のみ追加。原V160 harness/原FAILは保持。

## 候補と残件

- Maker `candidate-maker-reactive-v161-01/maker.html`、SHA f10fc2a3a3f4f947591f6673539787b3082a1cde15736dbc9a6fe3458cf2d434。
- Native 212inputs、SHA 7e65f1cad076305fd6a413f7b6121511dd01f62f549ea45e84fdb456d96558f2。
- Workbench 189inputs、SHA d62b888004ad9baa723c3f316200a39c815d50667f4d7def2521194773ed7201。
- 原本/full records/capturesはrepo外private cache。公開側の索引は `first-pitch-intent-v161-02/report.json`、`reactive-private-causal-v161.json`、`reactive-integrity-v161.json`。

V154/人体、分類/人的校正、通常戦術/心理、SPIN/Native、旧残件、性能B/9回、同版配送、キレ3選択Task4 Step7、最終最新設計GitHub照合は未完。SIGN認定/名付けはペナント時。今回Source実装は未commit/push。旧版/共有distは不変。
