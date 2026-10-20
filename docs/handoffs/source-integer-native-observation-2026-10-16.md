# Source integer checkpoint → Native observation → single calibration

Full goal は継続中。本証拠は free/stationary Source の時刻接続と observation 1件に限定する。Native の9人 body、capture/custody、throw、runner、rules、official/scoring の受入完了を意味しない。

## 1. 真正 checkpoint

詳細は `source-field-dynamic-body-seam-2026-10-16.md`。新 family `same_pa_field_step_aero_ground_integer_boundary_v1` / action `source_integer_boundary_checkpoint_v1` で、元 ground の `0.2793662989158183` から `0.279367` へ `7.010841816534885e-7` 秒を実 Source kernel で進めた。整数 tick は両方 `34334003`。

原 owner admission `ede7cb0460064b5e9d2de1e5c89b6972` PASS113.968s、別 process callback なし cold reopen `95bc81fa331043b884ba21e75ee115f7` PASS54.235s。Source `4e840577332b231acfc01bfca4f5670afbb1932a42459f5b807625132a85d4b7` / snapshot `58ed4f9cb894ac45190bece898ff94200eaf65edad8e3315cce6885dc7a59da4`。新 step1行/headCAS1件以外は保持。

独立 SQL 比較 `MB-20261016-INTEGER-INDEPENDENT-ARCHIVE-INTEGRITY-V2_b578dcfa79c14b179a8548131e485aba.json` PASS0.202s は、316 schema entries（index/trigger 等も含む）、108 tables、849 old rows、415 old Source entries の不変を確認した。Source/header/snapshot JSON の文字列 bytes も旧行比較に含む。初回 `4c0cd0ce05ae4cd6b9978cb404930617` は SQLite row の null-prototype と plain expected の比較差だけで FAIL、比較対象値を正規化して修正、元証拠は保持した。

## 2. 旧 green snapshot に固定した O1

Root 指定 ZIP `outputs/にーくらMINIbaseball_変更ソースと検証.zip` SHA `b16cb68c644e6525fe19f287455031b2228ea478a3a2297ec3c6e485894ffbeb` と `git archive df61388b -- src` を新 directory で合成した。checksums の913 entries /188 source 全 SHA を照合し、編集中の `src` tree はコピーしていない。新 helper の誤 import による build-only FAIL は `../native-source-integer-metadata-v1/build-import-failure.json` と元 `frozen-source/` に保持。helper import だけを直した `frozen-source-v2/` を使用した。

実行 entry は `../native-source-integer-metadata-v1/entry-v2.mjs` SHA `d1cc9b7232c890fe7c267b0587ff030ab3960b4314d245a4427da4cb2b3e423c`、750 inputs の build 前後 SHA 一致。これは per-record clone 修正前 green Source による単件 proof であり、後述の修正版全体を Native で検証したとは扱わない。

| 実検証 | 結果 | 時間 | machine receipt suffix |
| --- | --- | --- | --- |
| 原 root/checkpoint/historical view readOnly | PASS | 39.328s | `d3488845570c48d0965bc2fccf32ff91` |
| 正真正 lifecycle cut14 prefix/TOTAL/view | PASS | 203.625s | `9cfb06bf5a2f41d4a859f863c3399fe4` |
| original unprojected calibration32 → cut14（9 observation は exact clock projection） | PASS | 90.703s | `46b2bcc214ef44cd9a78a24413990fdd` |
| INTEGER version observation metadata1件 | PASS | 120.235s | `83f0e75c36a34940b1750386ea096233` |
| 別 process / accepted Source callback なし原 reader cold reopen | PASS | 54.610s | `50a9a98687964a93b06c65d158e5eac4` |

receipt は `docs/ai-continuity/verification-receipts/MB-20261016-NATIVE-INTEGER-METADATA-*.json`。

- O1 player: `p2`。SourceId `source-integer-metadata-v1:observation:0`。
- O1 Source SHA `5d996e392d9d3385559b7729e39aac112a7745dbfe2ac11a95acb937d9aa691b`、snapshot SHA `3c1dce1cb2356582b91a579be971b0f8d5d9d9e0e1335fb5ba93494cf04b3a20`。
- field、timeline、evaluationTick、solver evidence は元 checkpoint と完全一致。side/outgoing の same-kernel position/velocity を観測へ渡し、spin は元 physical record に保持する。
- immutable closed DB/Map は `../native-source-integer-metadata-v1/run/closed-cold-reopen-50116/manifest.json`。DB SHA `e78786d6106b08e622c85a53a435b067b354d05d1b2b0ce273e8c09a27b07772`、Map SHA `931fac82fd0b59b25773c39d7a44734c8d1bd6d46969fb2cd776bc1b54f820a1`。
- ここでは lifecycle view はまだ cut14/checkpoint を指す。O1 を指す current view と偽装しない。既存 calibration は cut14 の32件で、新 cut15 の alias ではない。

## 3. 9人履歴の安全な検証単位

従来 `cloneInert(raw)` は full history を1 objectとして数えたため、合法な大きさの各 record を並べただけでも合計100k nodes を超える。新 `SamePlateAppearanceSourceIntegerCheckpointV1.ts` は top-level plain/inert descriptors と dense history を検査した後、各 Source/root/previous/record に元の100k-node/64-depth制限を適用する。history512 / physical horizon256 の上限を追加し、Source authenticating owner と全物理再計算は省略しない。世界共通 `cloneInert` の上限を上げていない。

8 tests の最終 `MB-20261016-INTEGER-RECORD-BOUNDS-FINAL_8cf41d3625094d9f98aa87e95cba28f8.json` PASS19.000s。50 primitives（10身体×5role）＋9 observation/decision/candidate、team、9 actor-selection の Source-shape-valid structural prefix で、旧 whole clone のサイズ拒否を確認し、record 別再生で通した。各 result は original owner の stand-in であり、Native nine authentication/decision/body execution の証明ではない。getter、Date envelope、sparse/513 history、100001-node record、depth65 は拒否。旧 V3 と合わせた14 tests PASS `9442df132d354bbe9a1c27ea04699863`、whole TSC は別担当 `c5a49bd097184013bbe66f4d7e366c6e` PASS23.671s（descriptor型修正を含む）。

## 4. cut15 single API への再開

Root 指示で、旧 green の検証済み immutable tree に **Store 1 file だけ**を追加 overlay する。`SqliteSamePlateAppearanceLifecycleStore.ts` SHA `7b908d978a5a76554e4e8f689a277a84d99963c1a5e1414b81e17febce78a940`、既存テスト Source SHA `2862ac84198f9581065bb7c29753cdbaeb99a30c3f8c686c289dcafac48a32cd` を確認した。最新 c5a 全 Source snapshot という主張はしない。

新 fixed entry `../native-source-integer-single-cal-v1/entry.mjs` SHA `bcd1966968a12eaddc009233dbd933ac9d7e875fedb73aeb35219d933c058f22`、749 inputs SHA 固定。Source composition receipt `240d2d0a9e064852be4c7a8998cb73d9` PASS。new helper `source-integer-single-cal-entry.ts` は original O1 player `p2` の observation calibration **1件だけ**を `acceptDefenderExecutionCalibrationV1` で採用する。元 cut12 の未変換 calibration を明示参照し、projection の連鎖を避ける。

新 single API composite の原 root/O1/historical view readOnly は `6fcc677e5a0543d791d7026c38fe8ce1` PASS44.046s。次は genuine cut15→本人 observation single1行→別 process cold read。cut15 の同 view に既存32件を再宣言せず、別 SourceId alias を作らない。Native driver は既commit calibration をそのまま読み、残りの未実施 stage から再開する。cut15 未校正の残 route、37新 metadata/実9 decision、owned motor/body、rules 等は未証明である。


cut15 の genuine original-owner lifecycle admission は `MB-20261016-NATIVE-INTEGER-SINGLE-CAL-CUT15_d9dadbeac69947ca96791bb5fc4acf9f.json` PASS268.109s。view SourceId `source-integer-single-cal-v1:cut15:view`、Source SHA `fa7265550ded10bb0bb9c5e826e86bce4ed8015393c22c015a40f79c12ddfdf6`、snapshot SHA `b0438faec9f53334efe540aeca9caa5de5d0408a0545c45d164664d95b04b69e`。現在の physical operation は上記 actual p2 O1。閉じた中間保存は `C:/Users/genki/Documents/Codex/2026-10-15/new-chat/work/native-source-integer-single-cal-v1/run/closed-advance-50428/manifest.json`、DB SHA `a43156d596db4d6d2fdd1a5b763d9a2a6d012e49cc11225fabbe857149c0a360`、Map SHA `e6f4b4292bb4352f997ac6663a827187e783383c2752dc778fcb1fbbdaecf6ca`。元 O1 input DB/Map hash と全旧 rows/Source は保持した。新 single calibration の admission と cold read は別 stage として記録する。

O1 原 proof の入口と閉保存先は絶対 path で `C:/Users/genki/Documents/Codex/2026-10-15/new-chat/work/native-source-integer-metadata-v1/manifest.json` と `C:/Users/genki/Documents/Codex/2026-10-15/new-chat/work/native-source-integer-metadata-v1/run/closed-cold-reopen-50116/manifest.json`。b16 green ZIP は Root が同 bytes archive へ保全する予定。上記 fixed bundle は実行 phase に ZIP を再読しないため、配布 ZIP の後続更新を本 proof の Source と混同しない。


## 5. cut15 single API 原 owner admission・cold reopen 完了

| 実検証 | 結果 | 時間 | machine receipt suffix |
| --- | --- | --- | --- |
| cut15 genuine lifecycle adoption | PASS | 268.109s | `d9dadbeac69947ca96791bb5fc4acf9f` |
| p2 observation single API 原 owner admission | PASS | 103.937s | `4f351946e68e48599e6f3236d6423c55` |
| 別 process callback なし原 calibration reader cold reopen | PASS | 30.672s | `d74557ee2b5b4d7eafdb691c17e1300d` |
| 閉 DB/Map hash・旧461 Source 保持・driver ingress 整形（SQLite openなし） | PASS | 0.093s | `de80aad8078b4b04a51f4c079d5aa429` |

新 calibration は `source-integer-single-cal-v1:cal:p2:defender_observation`、Source SHA `8817735150a18ef2f7da889510e086946218a32f22460949ae4d0f30f45b4e3d`、snapshot SHA `1d15f1fbb1a784dbd64580854ec8da357d695eba5e6a2be90b0e8fab8368de32`。元 owner は `acceptDefenderExecutionCalibrationV1` の通常 Source/clock/transaction/exact-delta 検証を通り、別 process は accepted Source callback なしの exported original reader で同じ値を再導出した。この current view の calibration は observation 本人1件だけであり、batch32 を再宣言していない。

閉じた最終証拠: `C:/Users/genki/Documents/Codex/2026-10-15/new-chat/work/native-source-integer-single-cal-v1/run/closed-cold-reopen-4172/manifest.json`。

- DB: `checkpoint.sqlite` SHA `7c58201aa50a50760a298a88458b868de25599f516e0b6d561c577fb51d04527`。
- Map: `accepted-sources.json` SHA `57c291e9201d73c448d3519097a681a3392c3598c212d3e48b29d3f274c5bc7d`。
- 全 stage で元 O1 入力 DB/Map hash と全旧 rows/Source を保持。校正 stage の新 row は calibration1件だけ、cold read の row delta は0。
- 時刻 `originTick=34054636`、`elapsedSeconds=0.279367`、`evaluationTick=34334003`、side `outgoing`。球の Source initial/profile/basis と既存50 actor curves は不変。
- 元 first-ground timeline SHA `c60e48c6999ab6a4d7167399b82081a4e07250ab4ba6ec6403f8dfc2da8c0fbf`、field SHA `6e8fe4a1235041126846320ba1abc0152968570f0a5070556bb4815195f718a1`、solver evidence SHA `cdca8e0e8dac2b1f931f4ee95289b2a50f3b1bb459a5126514536ee0a1993592`。

後続 driver 入口: `C:/Users/genki/Documents/Codex/2026-10-15/new-chat/work/native-source-integer-single-cal-v1/driver-ingress.json`、SHA `20c2f95c28d336df761d49d455768a8aa07c8093b8a36a9f4ff5effd8bc4cbaf`。`make-integer-driver-ingress.mjs` は既完了原 proof と閉ファイル hash を検査し、SQLite を開かず参照を束ねるだけで、新 Source authenticity を付与しない。原 closed DB を編集せず、driver は別 copy へ移す。

次は既存本人 single calibration を再利用し、残り route と37件の新 metadata を original owner で採用する。先行 O1 は9新 observation の1件として二重計上せず、本人の新 observation は previous observation に O1 を明示する。decision/locomotion の旧 temporal fields は実測 clock 根拠 UNKNOWN のままで、自動1000倍変換を行わない。Native9 body・capture/custody・throw・runner・rules・official/scoring は本 proof で未採用。full goal は未完了のまま継続する。
