# 保存済み回転試行を資格評価へ渡す正常証拠

2026-10-30 JST。V226の真正TOP試行1件を、現行Native Ownerから再認証する読み取り専用DTOを追加した。接触の再生成や新しい資格の採用は行っていない。

## 利用可能になったこと

`src/host/world/NativeSpinTrialMotorEvidenceV227.ts`は正常resolutionのfullrefを入力とし、正常physical Readerでtrial commitment → 元inputと関連観測・V225を再認証する。本人、同じ球、lineage、Source・fullref、nominal / effective入力を照合し、元pair、transform、元/current domain、運動trace、実contact・exit velocity / spinを切り離して凍結する。

`earnedQualification:false / qualifiedTransferProven:false`を維持する。未接触はcontact / spin等のnullとして保持し、成功だけを後続評価の分母にしない。

独立性は`ONE_PER_PHYSICAL_PITCH`。career / player / personとphysical pitchのowner / sourceIdをprimary identityにし、完全pitch refとinput refは別のprovenanceとして残す。同じ球の別input・copy枝を別反復にしない。同じidentityでpitch hashが違う場合は、後続評価でCONFLICTとして扱うための情報を保持する。新table / registry / writer、既存MasteryやCoreの変更はない。

## 検証

- 新4テスト `05bf4bbd`、focused strict `c79d07b8`、構文 `af343301` PASS。Host DTO / testの独立Solレビュー、driver / entryのRootレビューで重大指摘なし。
- Rootが原DBと関連8DBのSHMを含む全ファイル終了照合を追加し、最終構文 `3a5f6eadf8fc4c7aa2899dd47c56599e` PASS。
- 実readonly gate `2cf77036e4004ba684bc4283254cbeb7` PASS / 6,625ms。commandは `node tools/verification/check-native-spin-trial-motor-evidence-v227.mjs work/native-spin-trial-motor-evidence-v227-01`。
- V226保存resolutionから真正trial 1件を再認証し、contact / trialEvidence / motorTrace / fullrefsが保存済み正常結果と全値一致。TOPSPIN `626.2489333765586` rad/sを保持。
- 原V226 DBと関連8DBは開かず、main / WAL / SHM等の全ファイル不変。所有コピーはread-only、全row / rowid / schema / head / data、caller transaction / query_only / savepoint / authorizer、Source / bundle / artifact終了pinsを保持。
- 既存V226 Source850件は現行と一致、新closureの追加は新Readerとentryだけ。新write / practice / contactは0。4分の元Native試行は再実行していない。6.625秒はこの正常再読gateだけの時間で、試合性能ではない。

log SHA `84e0d130a7dfd87cd58c540080dfdd81df3f9d7ea4b65180019e0c03cfd4aec4`、report SHA `5867136980b2ecdb4b4aca993da2923416624371cf027c015d76d2266c6c1689`。private証拠は `work/native-spin-trial-motor-evidence-v227-01/`。

## 残ること・失敗記録

新Source版の資格評価で、profileだけでなくaim実装・pair根拠・観測domainを資格単位にする接続が次の未完。新しい反復数・成功率・適用域の条件を満たした後だけ、earned consumerから同じaimを選ぶ。今回1件を3件へ増やさず、旧6接触や別技術の証拠へ付け替えない。通常AI・他技術・左右・Gold・最終配送は未完。

真正な未接触記録はまだ無い。null保持、foreign / nontrial / context mismatch、同pitch別inputのidentityはスタブで確認したもので、Native失敗例の実証とは別。初期RED `1d57e6b4`（module未実装）、初strict `ed5c1e38`（負例の静的型）は保持。旧suffixの終了pins UNKNOWN等も解消していない。
