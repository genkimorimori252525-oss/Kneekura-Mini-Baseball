# 明示practiceの振る意思を一球入力へ保存する

2026-10-30 JST / MB-20261027-REALISM-DEBUG-PLAN。V239の全NO_SWINGを消さず、通常AUTOと元JSONを維持した別のcontrolled practice入力を追加する。4技術や獲得の受入条件を縮めない。

## 根拠と判断

V239の事前固定4組では、BACK／SLICEが全見送り、TOPが第2球接触、HOOKが初球接触だった。既存SwingInstructionV121はeffort／compactnessを調整するだけでAUTO判定を越えて振る意思を指定しない。本人の保存値には必要なswingPolicyV121もなく、hardeffort1を付けて解決したと扱わない。

Astraは「次の成功機会を選ぶ」集約変更より、preview前に保存できる明示practiceの意思入力を推奨した。投球・結果を見てmodeやseedを変更しない。

## 新しい契約

- version／sourceId／明示practice scopeと、AUTO／SWING／TAKEを持つ一球request。managed offenseかつ明示practiceでのみ使用する。
- `scope: EXPLICIT_PRACTICE`を持つstrict parse済みrequest自体が、その一球を局所practiceとして実行する明示宣言になる。spin motor policyの有無とは独立し、通常practiceで既存spinControlを無効化するdummy policyを付けない。通常試合UIからは付与しない。caller宣言はNative認証・実施歴・獲得資格の証拠ではない。
- Ownerはcohort開始時にnormal／trial双方へ同じmodeを固定し、command・機会fingerprint・captureへ保存する。同じ機会の結果を見てmodeを変え、新しい独立試行に数えない。
- SWINGは意思によるoffer部分だけを置換。現在の配達済みV151予測を必要とする。旧deliveredPredictionV151はprior-onlyでもtrueなのでそのまま許可判定へ流用しない。
- effort0、開始時刻、latency、motor実行可否、速度／acceleration／誤差／接触／空力は通常経路の制約を保つ。当たり・回転・打球方向を強制しない。
- 省略／AUTOは元の計算経路とRNG・clock・JSONを維持する。新request／diagnosticの追加差だけを別記する。TAKEは既存の見送りへ接続する。
- 初版はmanagerCommunicationV122との同時指定を拒否する。SWINGとbatting:'take'の競合も拒否し、暗黙優先にしない。通常managerの認識・通信遅延を迂回した指示として扱わない。
- 元roster／swingDecision／traitは書き換えない。従来offer、要求、意思適用後offer、blocked理由、後段motor可否を診断に分け、接触結果から意思を決めない。

## 受入

最初の単位は固定cohort→Host保存→paired実行→capture／resumeの一貫配送。現在配達済み時だけSWING、未配達／effort0／motor不能の非強制、TAKE、競合拒否時の状態不変、normal／trialの同意思、省略／AUTO不変を確認する。

今回の見送り、UNAVAILABLE、HOLDは過去の事実として保持する。controlled practiceで振るよう指定した結果を、本人の通常心理・選球能力の実証や、4技術の回転成立・資格・Goldへ昇格しない。
