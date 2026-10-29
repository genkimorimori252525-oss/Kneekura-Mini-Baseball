# Pole-aware field再構築のpure adapter V218

2026-10-29 / `MB-20261027-REALISM-DEBUG-PLAN`。既存Core V145を再利用する、新しいNative field family向けのpure adapterを追加した。既存Root / parser / clock / Ownerへはまだ接続していない。

## 変更理由と契約

既存 `aero_ground_escape_v3` はactors / walls / basesだけをsolverへ渡し、pole cylinderを扱わない。一方、既存Core `deriveSourceBattedFieldMotionV145` はpoleを含む全colliderの初接触と材質反射を扱うが、旧Native V145はfree checkpoint専用でactionを拒否する。旧guardや版名を広げず、新しい `same_pa_field_root_aero_ground_pole_escape_v1` / 対応stepの明示型とadapterを別moduleにした。

入力は呼出側の正常readerが供給するRoot・previous・全historyという構造契約であり、このpure関数自体はNative受理の証明を作らない。元のcontact initial、profile / clock、equipment hash、連続ordinal、full reference、field / timeline / solver evidenceを照合し、Rootから既存V145 Coreで全prefixを再構築する。実solver名 `source_field_pole_contact_escape_v145` を保持する。

free checkpointと同cutの既存metadata5種だけを扱う。metadataでphysical horizonを増やさず、元のfield / timeline / evidenceを完全保持する。poleを除いた正時間queryを先に実行せず、初接触順と実outgoing moment / elapsedを丸め直さない。simultaneous / unresolved、custody、移動、混在family、偽cursorやevidenceは成功扱いにしない。

## 検証と範囲

新規8 tests `6e2d0fca` PASS7531ms、strict `f5c3c6eb` PASS8468ms。実Coreの再構築を使い、history / metadata / equipment / evidenceの保持と拒否境界を検証した。独立reviewは最終2 SHAを確認してReady。

開始前の `e30bebb4` PASS125msで新2pathsがV214 parent manifestの全keys / string refsに無いことを照合し、終了時の `d4c46db6` PASS171msでmanifestと既存806 code pinsの不変を確認した。既存成功テストの再実行、DB / Native / Chrome / Git操作はworkerで0。初期RED `d0cdf115`、negative testの非改変入力によるFAIL `23efd03b`、型FAIL `9f1320a8`は原記録に保持した。

| Source | bytes | SHA-256 |
| --- | ---: | --- |
| `SamePlateAppearanceSourcePoleFieldV1.ts` | 12938 | `958d44755739d41ff9a59c04a1df40f3e2d180981f07f6a681c845f163167973` |
| test | 15482 | `d40600e70c6a209ff925bfd17e36c0f8780dfd0d75b29f3d86e5b4a8fa9ca3fd` |

後段のfresh Root受理、正式equipment / project rule adoption binding、正規clock readerの新family対応は未実装。Registry登録やpure計算だけをRoot採用、実球場 / NPB条文の確認、HR / custody / 公式factsの証明にしない。既存Root / parser / clock / Core / helper / DBの変更は0。全goalは進行中。
