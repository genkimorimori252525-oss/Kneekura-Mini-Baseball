# 資格付き経路と不足時fallbackの実装

2026-10-30 JST。資格付きcommitmentのコードと候補判定を実装し、真正な保存データでは資格不足fallbackを確認した。**資格付きNative受理・実Producerへの採用は未完成で、production採用を証明していない。**

## 変更

新capability `same_pa_physical_qualified_spin_aim_v233` は固定qualification fullrefと元pair / assessmentを参照する。正常headerのboundsをReader再入前に検査し、資格end<=commitment.before<commitment.afterを必要とする。headerはmetadataだけで適用権限ではない。その後にV230の現在適用可否、旧Mastery保有、本人・model / equipment / profile、正常precommit domainを認証する。

V226の正常joinをauthority-neutral componentsへ分け、旧wrapperのauthority / false / 返値は保持した。新qualified側はfake未校正Sourceや未来recordを作らず、同じ配達済みforecastによるpure aim計算を使う。静的actual physicsはdomain比較だけ。旧v1 / v123 / V226 trial / NO_TARGETは変更しない。

`selectQualifiedSpinAimCandidateV233` は候補不足・非適格・対象やdomain違いを通常経路へ戻す。破損したSource / hashを黙って正常fallbackに変換しない。実際のProducer入口への配線は未完。

新Host / test / Core testと既存8Sourceの変更を固定し、`work/v233-consumer-baseline-01/reverse-proof.json` SHA `d61a7c83093181f7569f315ff17df374fbc66b45cdc39049eaddeb6bb53907e1`で各編集前全bytesを復元できる。worktreeとGit親は別保存。

## 保存順序と採用保留

qualified branchは、commitment rowとphysical headを追加した直後にはWorld eventがまだない。その2段階だけ全owned rows accountingをq1 proof内で行い、event追加直後のfull reproof、COMMIT前の最終正常Reader、COMMIT後proofは必須とした。旧branchesの順序は不変。新q1 toggle / ownership tokenは追加せず、既存`BattingInvocationTransaction.proof()`のowned phaseと復元を使う。

Sol静的レビューは重大問題なし、Astraは同transaction内でrow / head / event対を完成してから正常再認証する設計を採用可能と判断。ただし実装採用は真正qualified accept → reopen / read成功、およびrow後・head後・event後のpoison rollbackを実Ownerで確認するまで保留する。SQLite simulationだけでは代替しない。

COMMIT前の失敗はrollback。COMMIT後の検証失敗は既存Ownerをretireし取消不能であり、「全失敗rollback」とは呼ばない。

## 検証済み範囲

- Host10 tests `6819f678`、旧経路を含むCore30 tests `1ac1f1a4`、関連Host25 tests `c384ebeb`、direct strict `18a335e6` PASS。正常qualifiedケースはOwner stubで、真正資格成立ではない。transaction simulation `b80b5faf`はrow / eventの同時rollbackを確認。
- 新readonly gateのentry直接型 `6d294c2a`、構文 `c29fa72e` PASS。実readonly `885d4fbc685c43719635c72025f27789` PASS / 13,077ms。
- 正常V230 header end2とhistorical input before1をそのまま用い、因果順でREJECT_FUTUREを確認。現在の資格評価はINELIGIBLEなので、別にNORMAL_FALLBACK / NOT_APPLICABLEを確認した。新たな将来commitmentは作っていない。
- fullref破損は拒否。同じ正常inputに対する旧Core baselineと現Coreの通常計算は全値一致・READY。baseline依存77 inputsは親pinに照合し、RNGを再生成していない。
- 原10 DB全files、所有コピーの全row / rowid / schema / head / data、caller q1 / savepoint / authorizer、Source / bundle / artifact終了pinsは不変。新writes / contact / practice / qualified commitmentは0。

log SHA `956d3c152fa6c2f6468275dc459c704e36cf64bd395e5c051b4807760e1ecbbd`、report SHA `b098c0e442613d24cd4f385d500817627ef2cc97f8b6c762c661bea5e60effe7`。13.077秒はこのgate条件の時間で、試合性能ではない。

## 次の実際の機会

現在の真正trialは1件で不足。V226は打球処理待ちのため次球を直行できず、同Player練習もreservationで阻止される。正規field / outcome / reset、またはterminal / settlement / transition / releaseを進め、同本人の独立した機会から追加試行を得る。別分岐の守備結果移植、同pitchコピーの別反復化は行わない。

Root容量エラー中に担当が保持したSourceと結果を回収し、特にstaging変更を独立レビューした。旧q1 token提案は既存proofの役割確認により撤回した。旧FAIL / TIMEOUT / UNKNOWNは保持する。
