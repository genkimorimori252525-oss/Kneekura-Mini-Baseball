# 誤差幅を考慮した回転選択の固定ケース結果

2026-10-31 JST / MB-20261027-REALISM-DEBUG-PLAN。打者に事前に与えられた誤差幅と配達済み予測だけを使い、9つの有限scenarioで通常と候補を比較する明示実験。実際に引かれた誤差・未来の球・実contactや結果を選択へ渡さない。有限scenarioは実際の成功確率・人間校正・Native資格ではない。

本人1-b0／左／obp-23_5、従来と同じ固定4技術×各2機会・V246予測・必要成功2/2、Chrome156.0.8078.76／同Core・Main／実BlobWorker。TOP d4bd9fc8 PASS 2/2、HOOK 5527dc1a FAIL 1/2、BACK 337c5212 FAIL 1/2、SLICE 4a5d8dec FAIL 1/2。全caseで操作・full record比較・打席終了・保存再開・通常tail・始終pinsを確認し、各11artifactとreceipt/log実SHAを照合。失敗も全分母に保持する。

新旧8slot保存結果を追加simulationなしに比較した b32da5f6 PASS7.842sでは、全slotの選択delta・実contact・outgoing ball moment・field・rulesがV246版と完全一致。比較は固定8slot（異なる投球6）のみに限定し、一般的な無効や学習結果とは断定しない。集計した記録上の探索は、名目200回／16434 gap samplesに加えscenario 666回／56030 gap samples。この数は対象8slotの各一球診断の合算で、検証全体や1試合の実行時間ではない。

この固定集合では成功数や実打球の改善がなく追加計算があるため、V248を製品defaultへ採用しない。比較結果を残し、他のユーザー向け機能の完成に優先度を戻す。2/2基準・全4技術・自然な習得・Gold・キレ物理・完成3HTML配送は未完。

旧Browser d44b（Chrome版更新で開始前停止）、ca684（2回目前にbrowser終了、原因未確定・report保存後に自分のidle子を終了）、比較script f5a6290d（file未作成で起動前FAIL）も原receiptに残す。
