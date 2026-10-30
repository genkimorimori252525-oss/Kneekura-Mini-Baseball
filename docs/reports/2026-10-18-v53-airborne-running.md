# v53 — 着地前の走塁判断と実帰塁

[通常HTML・メーカー](../demos/releases/v53/README.md) / [得能の接続監査](2026-10-18-v53-trait-source-audit.md)。現在の成果は走塁・帰塁裁定と悪球打ちの得能編集である。青・緑・赤・金の全family接続は完了していない。元システムがない得能まで今回実装するかの範囲は人間へ確認中。

## 原因と変更

従来の走塁policyは、0/1アウトではgroundまたはfielder first-touchの事実がない限り進塁を許可しなかった。着地前の安打性の判断と、誤読後の帰塁経路が不足していた。初期離塁の記録もmotor開始命令で代用し、実bag diskを出た瞬間と混同していた。

新判断は、反応時間分だけ遅れて既に観測した球からfree-flight仮説を作り、その仮説の最初の予測groundで打ち切る。実kernelの未来の着地・捕球・フェンス越えの事実は使わない。現在の野手位置・速度・SIによる到達差に、seedと起点塁に固定した有限の読取り誤差を加える。reactionSecondsが認識遅れと誤差、既存safety marginが進塁リスクに作用する。これは実測分布へ校正したモデルではなく、決定的な暫定設計である。

監督の走塁指示は保守／バランス／積極の三つ。管理している攻撃側だけの既存判断余裕をそれぞれ+0.25／0／-0.25秒変え、既存0〜3秒へ制限する。top speedやaccelerationは変更しない。省略時は従来のbalancedと同一。相手側へ管理チームの指示を誤適用しない。

## 実際の帰塁と明示アピール

捕球時の起点塁の接触、実disk退出時刻とofficial tickで早離塁義務を判断する。first-touchと同tickの離塁はCoreの基準と一致させる。catch secure後、走者の反応時間を待ち、現在位置・速度から最大加速度の範囲で制動する。速度0から既通過塁を逆順に帰塁する。瞬間移動や速度の即時反転を使わない。帰塁義務が残るlive playは完了させない。退場／third-out等の終端とは区別する。

守備側は共通のout target評価で起点塁への送球または実際の走者タッチを選ぶ。`defensiveAppeals` はexplicitなappealと、同tickの本当の支配／タッチに拘束する。単に塁へ球を持っただけでは非forceの走者を自動アウトにしない。別の塁の保護上にいる早離塁走者への明示appealも扱う。帰塁との同tickや必要証拠欠落はUNKNOWNのまま残す。appeal第三アウトはtime playで、force扱いへ変えない。

参考は [MLB Official Baseball Rules 2026](https://mktg.mlbstatic.com/mlb/official-information/2026-official-baseball-rules.pdf) の5.06(b)(1)・5.09(c)(1)等。全公式裁定／NPB固有差の完成を主張するものではない。

## 検証で見つけた追加不具合

- 既存through-baseのtag保存fixtureが崩れた。新しい初期disk退出予約を、既存の通過走塁のrounding抑制条件が初動にも適用したため。初動だけ再計算し、元fixtureとassertを維持してPASSへ戻した。
- 実disk退出がfirst-touchの10ns前でも同official tickになる境界で、mainだけ早離塁として帰塁させた。official tick基準へ揃え、実経路の先行REDと修正後の回帰を保存した。
- 早離塁走者が本塁を通った後に実帰塁しても旧home factが得点へ残った。早離塁だけで未appealの得点を自動取消しせず、caught-fly correctionの実4→3 reverse touchで旧traversalを除く。起点塁の占有を復元し、再進塁した本塁は新tickを使う。同tick第三アウトはUNKNOWN。
- 最初の総合実行は345 PASS／1 FAIL。旧公開能力11項目のassertが今回の10項目へ更新されていなかった。悪球打ちがpublic数値から除かれたことを明示assertへ更新した。製品挙動を旧期待値へ戻していない。原FAIL receipt f51ce21aを保持する。

配布検証の初回は旧v51の固定ZIP件数定数が新packager内に残り、書込前にNameErrorで止まった（7ea46f58）。その時点ではREADME以外の配布物は未作成で、後続release checkもSHA一覧欠落でFAIL（23bdbedc）。unionした実Source一覧との厳密一致へ修正し、製品Sourceを変えずに再実行しPASS。原FAILを保持する。

## 検証と限界

担当回帰は、policy・連続帰塁・実球によるappeal・同tick・帰塁後の得点／占有・Source metadataと物理の一致・旧JSONの無変換を含む。メーカーのPC1200／390pxでは、20選手・公開10／詳細44・ON .95→OFF0→ON .95復元、内部値同期、JSON保存・再読込を確認した。最終の全体結果・HTML SHA・9回実記録はrelease READMEと証拠を参照する。

v52の打者追従と投手反応カメラのhelper bytesを維持する。元の全計画はIN_PROGRESS。Native認証連続world、足・身体の全接触、runner同士の衝突、全得能、全公式H/E、lead／slide、経験分布の校正、新100試合監査、実機スマートフォン等は完了していない。原FAIL/UNKNOWN・外部Charter承認HOLDを保持する。

最終証拠: AI `faa62d37` 39files346PASS／71.811s、TSC `09422493` PASS／27.827s、BUILD `3a663a22` PASS／0.891s、GAME `e72654c8` PASS／111.765s、CAMERAS `132391e4` PASS／28.343s、MAKER `a489032b` PASS／15.906s、PACKAGE `7c89f884` 122 ZIP entries byte/CRC一致、RELEASE `6350ea63` PASS。112 Native入力・78 maker入力のunion Sourceをraw保存。

公開: product commit `1d051cda4b4b2903df49d580751dfa00896331f9` を既存ブランチ／Draft PR380へpush。PUBLICATION `587a7c7e` PASS（8.140s）、remote/PR headと13 raw filesの実bytesを照合。main未マージ。以降は公開記録のみのclosure commitで製品bytesを変えない。Git staging初回のREADME末尾2空白とraw診断log自身の再検査FAILも原出力を保持し、文書のみ整形・raw logを明示区別して最終154filesのbyte一致と非log空白検査をPASSにした。
