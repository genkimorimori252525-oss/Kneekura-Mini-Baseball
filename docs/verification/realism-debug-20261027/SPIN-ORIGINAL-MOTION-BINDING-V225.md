# 元練習動作の保存・再読

2026-10-30 JST。BACKSPIN / TOPSPIN の元練習を記述する binding を各1件、新しい所有コピーへ保存し、接続を閉じた後の正規再読まで確認した。次球への適用・4技術の物理制御・完成版配送は未完。

## 利用可能になったこと

正常 Mastery と各3件の正常 V224 motor evidence を結び、元の release に基づく neutral anchor と保存 target の正確な対を保持する。技術名から目標差を生成せず、元資格・旧 DTO・元練習を変更しない。

新 Owner の Source / snapshot / fullref は別 version。`ORIGINAL_PRACTICE_DESCRIPTION_ONLY` と `futureTransferProven:false` を保持する。rule enum は導出方法の識別子であり、資格や次球への権限を与えない。独立した ProducerRule registry は追加しない。

## 新たな検証

- 最終 pure 3件 `f71da80b`、focused strict `8b4f463dc25d484aadc622cdef6342cf` PASS。変更後 genuine SQLite N01 `4b103ad4b5934d35ba3ed284be4ebe40` と hidden alias N03 `a599e022` PASS。空 read / schema 非作成は以降無変更の `069341cb` を再利用。
- 独立 Sol review で全4ファイルの凍結 SHA、正常原本の結合、両鏡像の alias、insert 後再導出と rollback、providerless 再読を確認。重大な具体的指摘なし。
- 新しい所有コピーへの実登録は `af34040b30f74998b34549fa847c2781` PASS / 30,500ms。command は `node tools/verification/check-spin-motion-binding-owned-copy-v225.mjs work/spin-motion-binding-owned-copy-v225-01`。
- 元 Actor / 2資格 / 6元 motor evidence を正常 Reader で再認証し、BACK / TOP を各1登録。fullref の4 field と close → providerless reopen の全値一致を確認した。
- 新 `world_spin_motion_bindings_v225` の2行だけを追加。旧全 table の row / rowid / schema / head は不変。元 DB と baseline は開かず、main / WAL / SHM 等の全ファイル不変。caller transaction / query_only / authorizer、Source / bundle / 既存 artifact の終了 pins を保持。
- 新 gate の pure 2件 `2298f99f`、strict `32924dac`、構文 `3b763d2d` PASS。元6練習の再生成、新 practice / contact / Mastery write は0。

実行 log SHA `048e7abaa7f5feefdea7f83334f067942352ea101841ebb4dfef931915bd2b6c`、report SHA `88ed2ab1765d10b4e3ff197ec539b79a4ca0170fa63394fa2444de5aaabb1e9e`。詳細と private DB は `work/spin-motion-binding-owned-copy-v225-01/` に保持する。30.5秒はこの登録・再読診断全体の所要時間であり、試合性能の主張ではない。

## 残ることと過去の失敗

配達済み観測から neutral plate / contact-depth crossing と時刻を決め、明示 aim を既存 motor へ渡す新しい試行経路が次の作業。旧0g / air0 / Rの練習を通常重力の成功域へ昇格せず、新しい実接触 → exit spin → 既存空力で検証する。通常試合への採用には、その新しい資格・適用域の根拠も必要。

`96b95d505d9e434fb4139e81f57a8f6d` は Worker 異常終了の FAIL、一次原因 UNKNOWN を保持する。別に発見した read-side mastery mirror alias 漏れは RED `7d5a5fba` → 修正 → 対象検証 PASS だが、Worker 異常の原因解消とはしない。旧 suffix の終了 pins UNKNOWN、4技術 / 3・4種保有 / 自然 Gold / 生産用校正 / 公式終端 / 全体性能も未解決のまま。
