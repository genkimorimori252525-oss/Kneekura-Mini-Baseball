# 通常試合の方向おまかせ: 限定実装条件

2026-10-31。既存 V149/V161 は明示AUTOを受けた場合に利用できるが、通常Hostは管理側の明示direction commandがないと方向requestを渡さない。現行のメーカー受入を再実装せず、通常試合の選択肢を実装する。family認識と人間校正は別の未完項目。

## 契約

- 明示opt-in方針をHostへ設け、現在の攻撃側に有効な明示direction requestがあればそれを優先。明示AUTOのsourceも変更しない。なければopt-in時に既存のAUTO requestを一球のeffective requestとして渡す。policy未指定は旧経路そのまま。守備側commandを相手打者の指示に使わない。
- 両軍へ対称に適用し、個人方針→既存sector→REACTIVE、観測不足、TAKE/BUNT、spin占有時の扱いは既存ownerへ委ねる。AUTO request送付を運動適用や実際の打球方向の証拠と扱わない。元commandを書き換えない。
- V151観測とV153 motorを明示policyの前提とし、未指定時の記録・乱数・時計・継続JSONの省略形を保つ。検証済みpolicyのbindingを条件付きで保存し、resume時の追加・削除・変更を双方向に拒否する。既存非opt-in保存はそのまま再開できる。
- 配達済み観測と既存記憶のみ使用し、真球種・未来球・実結果を判断入力へ戻さない。出所は既存診断で確認可能にする。本人JSONや旧入力を変更しない。

## 必要な検証

両軍の無指示／明示方向／明示AUTO、spin・TAKE・BUNT代表例を連続実行と途中resumeで照合。policy未指定の旧fullrecord・continuation・乱数・時計一致、binding追加／削除／変更の拒否、command不変、個人方針・sector・REACTIVE優先と不足fallbackを確認。続いて本人の事前固定・複数独立seedで初球以降を見送り／空振りも全分母に残し、Main・実Workerの全recordを比較。意図と実打球方向は別々に評価し、1例から一般的な偏り解消を主張しない。

設計レビューはHost接続／binding／両軍／spin境界に限定し条件付きReady。現batchの開始終了Source pinが確定するまでは共有Sourceを編集しない。
