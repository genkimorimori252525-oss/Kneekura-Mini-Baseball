# 保存Ownerの不足評価に使う診断基準

2026-10-30 JST / mini-baseball / MB-20261027-REALISM-DEBUG-PLAN。

対象はV230新Ownerのgenuine所有コピーでの受理・再読検証。現在のV228閉集合は正常認証済みTOP試行1件であり、適用資格は発行しない。

正常Mastery.calibrationの数値は`synthetic-v127`由来で、旧minimumIntentionalContacts=3、方向成分0.001 rad/s、成功率0.5。旧件数・率の分母はcontact、新評価はmissを含む独立pitchであり、同一意味の校正移管にはならない。

Rootは今回の診断Sourceに限り、独立pitch最低3、方向成分最低0.001 rad/s、成功率最低0.5、missを失敗分母、未解決・未分類をHOLDと明示する。数値は正常旧Sourceを出典にするが、新しい分母への適用はproject診断の仮定であり、実行domain・人間の校正や製品既定値ではない。コードへ既定値を追加しない。SourceVersionとprivate provenanceへ診断用途、正常calibration refと全数値、意味差を残す。

本人の最新指示「確認待ちを増やさず、依頼範囲内で判断して実装と検証を続ける」と、Astraのproject宣言基準は正規受理入口から使えるという判断を根拠とする。既存MODEL_VERIFIEDを新domainへ引き継がず、Raw hashを承認へ置換しない。

検証は固定cohort1件からINELIGIBLE / applicable=falseの評価1行を新tableへ保存し、接続を閉じて再読すること。資格成立、3件以上の反復、通常AIへの適用を主張しない。旧Mastery / V225 / 原DBと既存全行は不変。生成Sourceと新評価は新しい所有コピー内だけに置き、元の接触・練習は再実行しない。

復旧は新規検証コピーとSourceだけに限定する。既存DBやSourceへの移行・上書き・削除は行わない。実結果はV230のreceiptへ別途記録する。
