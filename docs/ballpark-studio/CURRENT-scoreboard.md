# 中央スコアボード checkpoint

後続更新: 2026-10-25に本人が球場デザイン完成を確認。芝生ロゴ0.8倍の採用と最新成果物は [CURRENT-accepted.md](CURRENT-accepted.md)。以下の未承認表記は当時の状態として保持する。

2026-10-24 JST / MB-20261024-BALLPARK-SCOREBOARD / IMPLEMENTED_AND_VERIFIED（設計室）。本人が生成イメージを明示承認し実装を依頼。実装後の外観確認はまだ未取得。原判断はPLAN-scoreboard、入口はREADME-scoreboard/STADIUM-AUTHORING。旧記録はCURRENT-logo-lodに保存。

## 実装と範囲

本人の最新指示: 壁面ロゴが距離で消えるのは過剰。明るさ/目立ち方を保って少しぼやける程度にする。生成画像は「最高。その球場で作って」と承認。承認画像をreferences/scoreboard-approved-v1.pngへ保存（SHA76d8606e082abb5be74c07d8863024972496c7da8731d275b7b57d84bf059088）。

- 中央上部の既存金色狼、横長の紺色表示、金框/背面/側板/支柱、赤青の側部をworld座標で構築。文字もCanvasで一度だけ素材へ描き、mipmap/透視補正UV/局所光点/shared depthを通す。PNGや文字を画面へ直接重ねない。屋根に収まる高さ/縮尺を席の高さから算出し、確認視点もgeometryに追従。
- 1〜9回/RHE・BSO・球速を表示。Rは各回の和から導く。設計室の「表示見本」として編集、エラー、履歴、JSON、明示保存へ接続。公式試合成績と偽らない。optionalなarchitecture.scoreboard、旧JSONは無追記fallback。表示盤/狼は独立toggle。表示盤OFFでも狼を残し、カメラを飛ばさない。
- 壁面狼の深度による減光を撤回。contrast1/brightness1.45/glow.08を維持し、深度のfilter footprint増分を最大15%だけにする。細部の補間と投影サイズによるLODは保持。芝生/PNGは不変。
- 「スコアボード」確認カメラを追加し合計9視点。内野/白線/球場の物理境界/既存観客1,920区画は固定。通常試合/Core/他chatのsrc/dist/メーカー/共有CURRENTは変更しない。

最終HTML: outputs/球場設計室_v3_局所密度版.html / 45,851,256 bytes / SHA `e092666bfdf103d01892acb9cd622b39dff345a9524b7dd20039d7f9eb585882`。
復旧先: outputs/球場設計室_v3_スコアボード組込前.html / SHA `72eb3584a2d74a59e9b88127c0c336235b77e4ff1e9ebdb1a458aa06dbbbd5fd`。元V114/v1/v2/旧ロゴ案/原FAILも保存。

## 実検証

固有receiptはdocs/ai-continuity/verification-receipts/MB-20261024-BALLPARK-SCOREBOARD_<ID>.jsonと対応する原log SHA。索引はevidence/scoreboard-receipts.json。

- unit44/44 PASS `0b52cd00314f41e59e677d4313fee49f`。集計/空回/独立default、入力境界、旧JSON、立体筐体/狼と表示共存/屋根内収容、1000人3層・12万人5層・25万人6層、減光しない軽いぼけ、従来モデル/群衆/芝生。
- final build scoreboard-a5 PASS `237510b0e539472ba65dbae44aaa71c4`。Core不変・コピーrenderer script1つの差分・完全逆変換・構文/入力安定性。22 SHA読戻し PASS `428548152ae249d7a8571443b34ccc82`（18入力+元V114/v1/v2+製品）。
- スコア編集Chrome PASS `426e8883f44d40d5a35f64be0edc52b5`。evidence/scoreboard-scoreboard-a5/。各回入力→R再集計/画素変更、名前/H/E/BSO/球速反映、undoによる画素復帰、表示盤OFFでも狼/カメラ保持、狼だけOFF、無効O=3で直前有効表示/入力保持/sectionエラー/保存停止、JSON/保存再起動、旧JSON無追記、390/320幅。近遠0.5/1/2でcontrast1/明るさ保持。正面寄りの完成画像を目視済み。
- 9視点/回転/屋根/建築設定/保存/群衆と空席/芝生画素一致Chrome PASS `1beff892635343a1b5734cc1cae4b033`。evidence/architecture-scoreboard-a5/。精密点2856 samplesの独立ray/triangle漏れ0。固定geometry/旧renderer基準画素も保持。
- 既存dome編集等Chrome PASS `703e55090f4e418ba25f0c25d41aa434`。群衆の発光/占有率/屋根/保存/芝生比較Chrome PASS `7f965e6e23614ca1a0c298ebe8b5f1af`。
- 設定/視点変更後の3画像cache生成を含む待機は162〜1385ms（4つのChrome検証を同時実行、待機100ms等込みの単発値）。静止観客再生ではscene再構築0。FPS/単独実行速度/端末横断性能の保証にしない。近景の細分/素材sampleをさらに軽くする余地はある。

## 保持するFAIL・候補

- `c4fdd90289e74fe09c96d9d656541d46`: 旧unitが全facade素材を96枚と固定期待したが、スコアボードの赤青側部2枚を追加したため98。旧96枚の外装（y16開始）を範囲指定して検査するよう更新。建築を削ってテストへ合わせない。
- `fee80e6c27f844349297bdc1c832fee9`: スコア表示OFF時に可視wolf profileが必ず2個とする新テストがFAIL。背面/画面外を含む実geometryには2個残るが、視点から見えるprofile数は一致しない。また確認カメラが表示OFFで俯瞰へ戻る実装を発見したため、表示ON/OFFで同一targetを返すよう修正。試験は可視wolf>0とカメラ不変を検証する。
- a1の画像は表示盤両端が客席と干渉し暗く見えたため採用せず、支持位置を前へ移して素材文字coverageを調整。前段のdistance減光も最新人間指示で不採用として履歴に保持。現在の軽いぼけは新しい暫定値で、唯一の正解としない。
- 旧「遠距離でcontrastが下がる」unitは新指示と衝突するので、contrast/明るさ保持・filter増分最大15%へ期待を変更。旧原log/旧HTMLは削除しない。旧HTMLへJSONを渡す比較では、新optional scoreboard項目を除いて旧validatorの契約を維持。

## 次と境界

本人が9視点/スコアボード視点で実装の見た目を確認することが次。**DESIGN_ONLY_NOT_MATCH_CORE_ADMITTED**。現在の数字は編集可能な表示見本。新球場の通常試合のスコア/公式状態/壁/屋根衝突・守備・HRへの接続は未実装。実機スマホ/Safari/全設定組合せ/長時間性能は全保証していない。

最新の自己改善方針はSTADIUM-AUTHORING、追加機能はREADME-scoreboard。旧深度減光を現行として復活させない。専用CURRENT/固有receiptでcheckpointし、他taskのCCG CURRENTを上書きしない。判断は既存PR380へ集約し、ソースcommit/push/merge/deployを行わない。

最終監査 PASS `903a66beb90744a2aac51d0368d0ff35`。evidence/scoreboard-final-audit.jsonで最終製品/復旧hash、内野model/PNG/芝生/群衆/renderer patch/Core不変、全入力pins、44件unit原log、9視点/独立depth、原FAIL2ログ保持、承認イメージSHA、GitHub本文一致を確認。判断記録は既存PR380 commentへ同期済み。ソースcommit/push/merge/deployは未実行。UI再表示はqueuedで、表示済みとは扱わない。
