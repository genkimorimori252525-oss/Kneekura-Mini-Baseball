# V154 失敗した名目運動の同Core診断

2026-10-27 / root / MB-20261027-REALISM-DEBUG-PLAN。前turnはV153実装・実検証が進んだprogress。全goal/step-007はACTIVE。

次の固定ケースは公開obp-190_7/R/seed31/CENTER/inside、V151/V152/V153、max50/target30/motorLatency.04、標準physics、timing/aim/command誤差0、default compact-localの4level比較group。拒否levelは未同定で、level1単独Node実行は成功した（74dc2b05の旧期待FAILを保持）。元groupでの既存有限候補例外をd1478785で確認し、levelを推定せずsidecarから同定する。上限・seed・元clipを替えず、準備/arc/回復のどこで有限候補が拒否されるかを一度分解する。

既存motionはpre/post証明を計算済みだが合成maxしか残しておらず、LivePitchの最終例外にも候補入力がない。この診断口不足を修正する。ReferenceBatEnvelopeの既存証明・端点・実clockをread-only区間metadataへ添える。pure候補のcertificateへそのmetadataを渡し、失敗時のErrorに名目入力と実際の各候補診断を凍結したsidecarとして付ける。propertyは書込不可・再定義不可・通常列挙外。callerのraw inputやWorld状態をfreezeしない。

演算順・sampler・合成max・探索予算・seed・速度/加速度上限・接触/裁定は変更しない。sidecarは主観p/v/aと自己clip/物性の名目値のみで、実kernel/実spin/実接触結果を入れない。成功Canonical recordへ失敗sidecarを追加しない。診断をNative権限や能力測定値へ昇格しない。

同一Chrome上の現在Coreで固定例外を一回取得し、同Source constructorで各区間の解析速度・有限差分・sample maxと証明、距離/角度/利用時間を照合する。サンプルが50未満でも証明超過のgateを緩めず、証明の保守性と実運動の成立を区別する。CDP CPU profileも同ケースで保存。旧V153実bytesとの物理data比較と限定unit/typeを使い、既存成功の長い全試験を理由なく反復しない。

本人の高速で正確なdebug要求と通常判断の記録方針のscope内。新しい見た目/依存/計画外の世界エンジンを作らない。元JSON/原素材/共有dist/旧候補/全FAILを保持し、復旧は診断sidecarの除去または旧候補の使用。Source未commit/push/merge/deploy。診断後はTask4のキレ時系列へ進み、全残件を保持する。
