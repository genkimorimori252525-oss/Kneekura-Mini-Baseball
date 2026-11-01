# 個人判断による守備V118 — 実装判断

2026-10-25 JST / Task `MB-20261025-INDIVIDUAL-DEFENSE-V118`。

人間指示: 6工程計画に対する「よし。やってくれ」。サイトは参考で、状況・能力・個人認識とログに説明があれば異なる守備を優先し、固定命令によるpattern化を避ける。AUDIT.mdを再読し、中央役割/情報漏洩/9人traceの3所見を対象化。画像収集は追加の本人指示でLunaへ限定依頼し、ローカル参照用にする。

方式: 既存の実物理・捕球・送球・身体・走者・公式裁定を保持。個人の認識・候補・通信・採否をLive adapterで分離。legacy/shadowは内部検証用、通常とメーカーには同Coreのindividualを接続。新しい必須JSONや公開能力、別UIを増やさない。

根拠/代案/影響/検証/復旧は元計画と docs/verification/releases/v118/PROGRESS.md に逐次記録する。基準V117と原入力/FAIL/UNKNOWNを凍結、別名次版を作り、必要ならV117へ戻せる。共有reset/clean、他担当の巻戻し、commit/push/merge/deployを行わない。公開判断は正しい既存PR380へ私的情報を除いてまとめる。

結果: 3HTML/6sidecarを別名配置し、Source169pinと旧データを保全。詳細は `docs/verification/releases/v118/RESULTS.md`。判断要約は実在public PR380 comment6390004370へ保存してreadback一致を確認。Source commit/pushなし。開発開始前の性能予算未固定、peakheap未測定、全画像目視未実施、頻度未校正は限界として記録。
