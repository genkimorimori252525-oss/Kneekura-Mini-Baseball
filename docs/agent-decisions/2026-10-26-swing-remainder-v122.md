# V122 残計画の継続判断

日時: 2026-10-26 JST。Task: `MB-20261026-SWING-REMAINDER-V122`。

根拠: 本人の「ありがとう。残っている計画を進めてくれ。」。V121で保存したSWG/BAT/DIR/選球眼/質量計画の未接続部分を継続する。同scopeを再承認待ちにしない。DRAFT32、実測値の捏造、公開ランクからの性能逆流、Source push/merge/deployは含めない。

対象と方針:

1. V121の出力・証拠を保全し、旧入力のrecord回帰を固定する。新機能は明示Sourceのある入力だけ有効にする。
2. Reference Batの同一サンプラーに、任意のC1補間と速度・加速度の上界を追加する。原測定キー・hashは維持し、補間結果を測定値と呼ばない。個人のSI限界は明示入力とし、生成曲線の証明上界を選手能力に流用しない。
3. 既存Communication/ExactCommunicationを監督指示へ接続する。未配達/未認識のHardも実行しない。Soft採用度と通信品質は分ける。
4. 既存Workload Recovery/Pitch Fatigue ExecutionをBrowser Hostへ接続する。履歴再生は初期化時、採用済み活動の加算はO(1)。名目狙いを計算した後に実行時疲労を適用し、逆算補償を防ぐ。打者の未知の疲労係数は追加しない。
5. 独立した事前の球種×コースBelief、方向のAIMED/REACTIVEを既存Decision/Motorへ接続する。観測Evidenceと明示priorだけを使い、捕手の秘密call、隠しArsenal、未来の球道から事前信念を作らない。実打球は既存Contactからのみ算出する。
6. 新SourceをJSON・通常Host・Worker continuation・再生・メーカーで往復させる。新旧を同じ物理入口で検証する。

不確定境界: 打者疲労から筋力/加速への実測写像、監督への信頼からSoft受諾への校正式、公式half-swingの幾何一律閾値は確認できていない。既存Sourceを再利用できるところまで実装し、未接続を明示する。半スイングの停止動作と公式裁定を混同しない。

検証: RED→GREENの境界/因果試験、旧入力hash、有限差分と解析微分、補間キー一致、公開能力不変、未配達情報の不使用、JSON往復、同じSourceでの物理/再生一致、Worker継続一致、PC/390pxの表示、型検査、関連回帰、統合試合。未実施や失敗は維持する。

復旧: V121 `outputs/_candidate_v121_20261026_10` と `docs/verification/swing-pitch-v121-2026-10-26/integrity.json` が前版。V122は別の候補出力へ生成し、前版を上書きしない。共有のdirty treeをresetしない。

分業: Sol二名を既存Referenceサンプラー、純粋な通信/疲労adapterに限定。Host/Decision/JSON/UI/build/最終検証は主担当所有。複数writerが同じファイルを変更しない。

結果: V122候補のSource・通常HTML統合と検証を完了。146 tests、型、PC/390px、3球の実Worker再配送、673試技、最終Core9回259球/50守備がPASS。統合証跡 `16119becd4a6451595d8820e6fa5f1ca`。詳細は `docs/verification/swing-remainder-v122/RESULTS.md` と `integrity.json`。全SWG/BAT/DIR/CATCH・実測校正はIN_PROGRESS。Sourceの存在・単体試験・通常HTML統合・実測校正の完了を区別する。

GitHub判断要約: https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/380#issuecomment-6405402106 。公開repo・対象branch・head90dba70を投稿前に確認し、本文readback一致を確認。最初のAPI要求はschema不一致で未実行、正しい引数で1件のみ投稿。Source pushとは区別する。
