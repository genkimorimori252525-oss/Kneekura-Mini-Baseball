# Source field acquisition / release audit — 2026-10-16

元 full Core/Host/render `/goal` を継続するための境界監査。実測スイングの参照は OpenBiomechanics に切替済みで、MMD を新しい動作・能力の根拠に使わない。この工程は通常試合・Native 九人・九回・裁定の受入完了ではない。

## 採用した捕球境界

`SourceBattedFieldMotorMotionV1` は実際の単独 glove contact を `capture_candidate` として停止できる。candidate 自体は保持ではなく、cursor と carrier は null。失敗した retention は元の応答速度・spin を持つ自由球で継続する。未解決接触と candidate 後の別 free/motor action は拒否する。

`SourceBattedFieldAcquisitionV1` は元 initial と全 motor actions を再生し、元の sole candidate から既存の `BattedWorldScheduledFieldAcquisition` を再構成する。入力に保存済み plan/cursor/保持結果を受け取らない。吸収中と tick fence 待機中は無保持、エネルギー吸収と競合接触の実行後にのみ `secured`。保持中の球は glove の実加速度曲線に拘束し、空力自由球の Source descriptor を付けない。途中の壁などとの接触は `interrupted` で、保持へ昇格しない。

Host の明示 version は `same_pa_field_step_aero_ground_acquisition_v1`、solver は `source_field_acquisition_v1`。認証済み MOTOR prefix の最後の candidate から `capture_checkpoint_v1` でのみ入り、同じ candidate の後続 capture checkpoints に限定する。過去 progress/field/evaluationTick/evidence/timeline は全再計算して照合する。完了・中断後は未対応 consumer への進行を拒否し、旧 version に戻らない。原 first-ground timeline を保持し、OUT/SAFE や公式記録は追加しない。

Native owner の原 Source/ref/hash/current view/lineage/本人モデルの認証は別途必要。Host 試験の祖先・nominal adapters は mock fixture であり、実 Native 九人・Native 捕球の証拠へ格上げしない。

## 実検証

- Core capture/motor/scheduled/integer 4files **54 PASS**: receipt `MB-20261016-SOURCE-ACQUISITION-REPLAY_bcdc0d5b6ad14ad1802541b0c1c47852.json`。実動 glove、原 Source incoming、吸収/fence/保持、失敗 retention の反発、競合壁、partial/atomic 一致、cursor/plan 注入等の拒否を含む。
- Host Acq/元 motor/関連旧仕様 10files **70 PASS48.391s**: `MB-20261016-SOURCE-HOST-ACQUISITION-REGRESSION_0feaf38ac5364bab8187ff07db86ec0e.json`。元9 rated motors と原 first-ground event を持つ構造 fixture。
- whole TypeScript **PASS22.546s**: `MB-20261016-SOURCE-HOST-ACQUISITION-TYPECHECK-FINAL_16f1e21f137a4ab69bf80d158eb70514.json`。
- 主担当による Host helper/prefix/dispatch/version/evidence/test の独立読取 review で actionable finding なし。元失敗の receipt は EVIDENCE_INDEX に保全する。

## 未採用の送球試作と発見

既存 `BattedWorldScheduledFieldThrow` は保持中の transfer を実行するが、release 後の free continuation は旧方式。新 Source 枝へ接続するには、実 release でのみ新しい物理 basis を作り、その後も元 air/ground kernel と接触検索を使う必要がある。既存 launch は回転を生成しない。能力値・MMD・測定されていない手の軌道から spin を捏造しない。

主担当は original Source capture → scheduled transfer → release → Source flight の試作2filesを作成し、関連3files **39 PASS / 1 FAIL** を観測した。FAIL は `Source field throw cannot adopt unresolved contact`。捕球の拘束輸送が保持した球/glove 間の微小な負 signed gap を、自由球 query が `persistent_contact` として正当に拒否した。単なる観測時刻や新 Source basis は、この重なりを無視する権限を持たない。

試作は `../source-throw-release-study-20261016/` に移し、採用 `src/`・Native bundle・完成物から除外した。元 production の guard を変更せず、初回 RED `defdfc1361674633a4d00949cd9aaa81` と実行 FAIL `fdc49dc507b54fe09d5eedb2f6da81bb` は保全した。これは Native worker failure ではなく、新しい純 Core 送球試作の未解決境界。

独立した研究再現では、元 candidate・確保 fence・release の signed gap はいずれも `-8.243405957841787e-15 m`、相対 offset は byte 一致、release の外向き速度は `4.9969055033853405 m/s`。fresh query の sole glove contact が continuing / persistent_contact となる元エラーを再現した。report SHA `8ebf527a858e4e4172adc82d6ea009c1cb500357aac7b6cda10b24514eccdeb9`。この7チェックの研究成功は、新 departure 証明の安全性・実送球成立の成功ではない。

次の設計では、glove から throwing hand への拘束輸送、実 release position/velocity/spin、および原 capture witness と全 held transport から導く release 専用の数値境界証明を扱う。既存 impulse の証明を偽装・再利用せず、generic epsilon、位置 nudge、時刻の微小ジャンプ、捕球者 collider の除外で通さない。新しい校正の時刻・回転・身体値は、宣言 fixture と実測本人 SI を区別する。

## 本線の次工程

真正 Native integer checkpoint と metadata O1 は original owner admission と別 process cold reread を確認済み。current cut15 への lifecycle 更新は `d9dadbeac69947ca96791bb5fc4acf9f` PASS268.109s、本人 p2 observation 校正1件の admission は `4f351946e68e48599e6f3236d6423c55` PASS103.937s、別 process cold reader は `d74557ee2b5b4d7eafdb691c17e1300d` PASS30.672s。閉保存 `../native-source-integer-single-cal-v1/run/closed-cold-reopen-4172/manifest.json` は旧461 Source と全旧行を保持し、新校正1行だけを追加した。

この current cut から、同一 clock/current-view の新9観測・9判断・9candidate・team・9actor（37 metadata）を採用する。9人の movementStartTick と各 integration coverage を守って実 motor へ進める。時刻の原出自が未宣言の decision/locomotion tick 値を自動変換せず、実測反応時間と呼ばない。

その後に Native capture、release/throw、走者・裁定・公式記録、同世界の描画、実打球混合9回、100試合以上と改ざん監査、オフライン PC/実機スマホへ進む。メーカーや局所試験だけを元 goal の完了に置き換えない。通常 v31 の Native/実測 motor adoption と実 NLB 本人 SI/リーグ母集団は依然未証明。
