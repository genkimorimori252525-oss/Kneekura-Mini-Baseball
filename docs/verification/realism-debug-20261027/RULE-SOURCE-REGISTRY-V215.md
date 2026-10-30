# Project rule Source Registry V215

2026-10-29 / `MB-20261027-REALISM-DEBUG-PLAN`。ゲーム内で明示したfair-pole規則の出典を、実SQLiteへ登録して正常に再読できるOwnerを追加した。登録後のRoot採用、球場への適用、公式裁定の接続は後続作業。

## 実装と適用範囲

`RuleSourceRegistryV1` は `EXPLICIT_PROJECT_RULE_MODEL` のSourceだけを受け付ける。Source ID/version、モデルのscope、既知の解釈、利用可能日、inlineの定義本文を保存する。互換対象の `npb-2026` / revision `2026` は通常の `getRuleProfile` から読み、profile hashと解釈契約を再導出する。これは公式NPBのpole条文を確認したという意味ではなく、`VERIFIED_OFFICIAL_NPB_SOURCE` 等の注入も拒否する。

`SqliteRuleSourceRegistryStore` は実table `rule_source_registry_v1_sources` を所有する。正常read・full referenceによるread・close/reopen・同値retryを実装し、同IDでの置換や同scopeの別ID aliasを拒否する。空registryのreadではschemaを作らない。未提供のSourceはpending、改変・不正なprofileや解釈・部分schemaはエラーとして扱う。

SQL列とSource / snapshot JSON双方のidentity・scope・hashを照合し、通常のread transactionを使う。受理は事前導出→write transaction内の再導出→1行INSERT→readback→commit。余分なtrigger writeや所有境界の違反はrollbackする。

既存Core・Root parser・field clock・通常runtimeへの接続変更は0。登録だけでterritory・HR・custody・公式factsを生成しない。後段ではfresh Rootのfull reference、対象surface、geometry / material、cut、適用日を別に認証する。

## 検証

最終関連5files **88 tests** は `c767c81b7d4b41ed9fee00cd4079a304` PASS9264ms。うち新規32件で、fresh SQLiteの実登録・close/reopen・同値retry、alias、再hashした偽公式Source、両JSONのscope claim、trigger rollback、read phaseを確認した。strictは `6ed35b5a5ba844a69bb9942f524cfc71` PASS8375ms。独立reviewは最終4 SHAと契約を確認しReady。

`b50349dd8bb44b9e8f7dff33af73bc5a` PASS38969msで、V214開始manifestと806個のSource / code harness pinsの不変、および既存runtimeから新Registryへの参照0を確認した。既存DB・Native・Chromeの実行は0。新Storeの実SQLiteテストを、通常試合やNative接続の証明へ広げない。

RED `8bc42153` FAIL9250ms、初GREEN `4a2da874` PASS9406ms、初strict `06e2efdb` PASS8702ms、並行作業前の独立性確認 `85deabee` PASS139msは原記録に保持した。

Source SHA-256:

| file | bytes | SHA-256 |
| --- | ---: | --- |
| `RuleSourceRegistryV1.ts` | 4293 | `d8ff5878d1f0eb99c6e35169b1b0758cc33bfdaac5baf4e25f386c8ef0c61325` |
| model test | 3488 | `96544d89df115c8b476edab5c009b3d9be74803ecbb79b7c120a18ca18a317b1` |
| `SqliteRuleSourceRegistryStore.ts` | 10696 | `a3099928c72f3b0b05ecd765e3964ed0b03685acde2da030f39e9eda0fe83668` |
| Store test | 11801 | `aa4f86cdd21cbe250b9e7095721aa219328a79f6925235a6a1d20c4c5cfb9bf7` |

全goal・正式rule adoption・実球場/NPB Source・同版最終配送は未完として保持する。
