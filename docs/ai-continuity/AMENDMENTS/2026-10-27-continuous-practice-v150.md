# V150 通常Hostの連続練習を接続

2026-10-27 / root / `MB-20261027-REALISM-DEBUG-PLAN`。

本人の同Core高速debug・連続打席・方向おまかせ要求に対し、既存Worker Hostを共用する小さなsession adapterと実Worker UIを実装した。既存の安全clone helperはmodule export1語だけ追加し、新しい一般clone制限や物理モデルを作らない。Makerの登録チーム/打順を使い、練習用の開始打者・相手auto投球を表示する。本人の通常判断記録方針と当該goalの実装scope内で進めた。

全config固定、preview非消費/一球採用、local capture復元、失敗時の旧session保持と設定raceを検証。関連14件・全型・実Chrome1200/390のWorker/通常Host全record同値、実JSON再開がPASS。原成果物・私的JSONを保全し、別名候補のみ生成。詳細とreceiptは [CONTINUOUS-PRACTICE-V150.md](../../verification/realism-debug-20261027/CONTINUOUS-PRACTICE-V150.md)。復旧は元V133を使用。

既存Sourceに観測familyのEvidence producerは確認できなかったため、前球自動学習は未接続と表示し、次工程に保持する。位置confidenceから分類reliabilityを捏造しない。step-007/全goalをcompleteにしない。通常方針/心理・独立乱数・接触幾何・キレ・SPIN/SIGN基盤と継承残件・性能B/9回・最終配送を引き続き実行する。
