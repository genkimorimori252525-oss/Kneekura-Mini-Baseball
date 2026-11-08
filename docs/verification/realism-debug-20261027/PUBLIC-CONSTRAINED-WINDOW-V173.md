# V173 通常公開APIでのconstrained window

Task `MB-20261027-REALISM-DEBUG-PLAN` Task5。最新V170 Native214/Workbench191の公開 `runFieldPracticeV98` を通常SI/body/gloveRadius=.11で実行した。省略/遠いpole/接触可能な近いpole、旧V168実binaryの同じ遠いpole入力を、同Chrome156.0.8078.49のMain/実Worker/保存JSONで比較した。

全4capture/24record/31比較が厳密一致。遠いpoleは旧elapsed .123456789でunresolved停止、新版は同tick内の.123456889まで実arcで進み、pole省略とframes/facts/endも一致。100nm gapのnearは窓内に到達し得るため、新版もseparation_not_provedで元時刻に停止する。pole接触応答/Native/legal/custody/公式HRの証拠ではない。

## 原FAILと再計算をしない回収

- Node reachability6e074ed8は旧nearが短窓内に到達不能であると確認。near入力だけ修正したNode診断c260648a PASS、両Core一致。
- 初回Chrome00943452 FAILはChromeが.48から.49へ更新されたversion不一致でcapture0。旧結果とのcross-build同値を主張しない。
- Chrome02 d7b59a0cは全24record/31比較とSource end pins成功後、自身の実Workerの単一blob URLを外部通信として扱う末尾assertでFAIL。原report/receiptは変更していない。
- 保存済みデータの回収02 `037494f007474660bda504a5601ddbf2` PASS733ms。原FAIL/task/ログSHA、当時harnessの実byte archive、28artifact、24recordの実再比較、31checkの原順/hash、現Source全pin/旧新停止条件を確認した。新Core実行0/Chrome0。回収01のmetadata配列順の誤り4908daff FAILも保持。
- 旧runでは生成URLを独立fieldへ保存していないため、そのURLの帰属は固定harness内の唯一のWorker生成と単一blob requestからの推定と明記した。将来harnessは生成URL自体を保存し、そのURLへの1requestだけを許可する。将来用修正版harnessのChrome再実行はしていない。

原Chrome結果は `constrained-pole-practice-v173-chrome-02/`、回収結果は `constrained-pole-practice-v173-recovery-02/report.json`。これは限定された実通常経路のデータ実証であり、元Chrome command全体のFAILをPASSへ付け替えるものではない。production Source/旧候補/共有distは変更せず、成功済みunit/型/buildも再実行していない。

## 新入力: 通常55ms窓のcommand全体PASS

100nsのnear-zero限定窓に加え、maxPlaySecondsだけを.055へ変えた新しい通常1frame範囲を実行した。`5dac3c2ce9f149e3a8cd8329e08ee623` PASS2062ms、Chrome.49の24record/31比較と全Source end pinsが厳密一致。

far/省略ともelapsed .178456789、tick278457まで実arcで進み、frames/facts/endが一致した。nearは元elapsed .123456789/tick223457で未解決を保持。旧V168実binaryは同じ55ms requestでも元時刻停止。生成したWorker URL自体を保存し、そのURLへのexact1 requestだけを許可、外部network0/pageerrors0。`constrained-pole-practice-v173-frame-01/report.json`。

これは入力窓を広げた新受入であり、成功済み100nsの再実行ではない。上の将来用harnessはこの新入力で実行済みとなったが、default100ns修正版の再実行はしていない。pole接触応答/Native/legal/custody/最終配送/9回の未完は変わらない。
