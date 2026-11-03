# 同じ投手へのコース経験を次球準備へ反映

2026-10-30 JST。既存の位置観測・独立乱数・連続打席を使い、同じ打者×投手の経験をコース領域内でまとめて次球準備へ反映した。根拠となった配達済み標本も別版sidecarへ保存する。**球種familyの認識、人の認識精度、心理全体の完成とは別。**

[新Maker検証版](candidate-maker-observed-region-v222-01/maker.html) / HTML SHA `cdfadbaf8ed1a0e857bc6a3282ad162cd6d4cbcb9584715ab9b1556060c48067`。旧検証版は変更せず保持した。

## 利用可能になった動作

既存と同じ1回の想起drawで選ばれた経験のregionを使い、同じregion内のraw予測位置・release相対到達時刻を平均して準備priorにする。regionの経験頻度を保ち、nullを既知領域へ再配分しない。明示V122 beliefの従来優先順位とprior混合を保持する。方向4選択や新しいRNG streamを作り直していない。

sidecarはV151の厳密Evidenceへ項目を追加せず、別version / bindingとした。同じ本人×投手・pitchOrdinal・evidenceId、raw forecastのcutoff / usedObservationIdsと最大3位置標本を対応させる。現在の記憶commit元はdecision raw forecastであり、late予測と混同しない。公式一球受理時だけpairで更新し、preview非commit、保持上限で同時evictする。

標本の観測／利用可能時刻、origin tick、clock、予測plane・単位とraw推定を保存する。推定速度はplane到達時の値、2標本の加速度0は未推定モデル仮定。familyId / confidenceはnull、familyRecognizedはfalse、人間校正はNOT_MEASURED。真pitchType・非公開repertoire・spin・結果ラベルを教示にしない。prior混合結果の再学習も行わない。

新規開始時だけ明示policyを採用する。旧省略分岐の出力keys・draw、既存Evidence schema、本人JSON・roster・物理・時間刻み・誤差は保持する。

## 新たな受入

Coreは期待RED `8344bad3` → pure GREEN `543502ed`、追加境界とレビュー後の新関連12 tests `f9b82631` PASS、最終 `tsc --noEmit` `3adff59d19ed41e79e52a740bb02e448` PASS57063ms。上限1でのpair eviction、foreign observer / pitcher拒否、空・null・未来未配達、raw-only、preview / resumeを確認した。独立Sol reviewの指摘2件（+0 / -0のlossless比較、continuation extra key拒否）は `0c717e9c` REDから修正し、原失敗を保持した。

Chrome156.0.8078.49の限定Core互換 `01adc2e6ca2c4094b00e25acd7826dd6` PASS24172ms。直前受入版の実旧Workbenchで作った旧config / captureを新Workbenchへ渡し、同次commandの全record・次capture・RNG traceが一致した。proof SHA `43fc46c6bc80d1e4c41f60c71d13eeab6697994f0b55dbaf9b3c79e8314e136b`。Nodeの比較 `afcff763` は補助証拠に留め、Browser互換の代用にしていない。

新Maker QAの1200pxケースでは通常に受理した2球のraw経験がregion45に入り、次球で同region平均が実prepared recallへ入り、正の重みで現在予測に混合されることを確認した。同Native Coreの通常Hostと実Workerで全record / capture / RNGが一致し、preview非commit、保存再開、旧UI復元と拒否5条件も確認した。

このケースを含むr2 command `43b7827df28e436db2ee8b195d273bcc` は後続の通常ゲーム検査でFAIL62593ms。QAが別top-level pageを使って親Makerのclip共有を失ったことが初期化診断で判明した。Core / UI / candidateを変えず、実Maker同様の親iframe / srcdocへQAだけを修正した。

残り2通常ゲーム＋390pxだけのr3 `a9dea850444c4c86977373fbb156da4a` はPASS15265ms。両normal Hostの起動、実Workerへ渡るV151観測 / V153方向運動 / 既存INDEPENDENT V152 / 新V222方針の一致、親673 clips / 92201 frames、390初期表示を確認した。1200練習の再実行は0。r2の保存caseと開始pinsを再認証し、r3開始／終了pinsで継続を補完した。r2当時のoverall FAIL・endpins UNKNOWNは書き換えていない。

初回QAの誤ったWorkbench Host入口 `439949061cb643c99f007db36d4c1b1c` FAIL8577ms / 0 casesも保存した。正常例とexportを照合しNative入口だけを修正した。失敗時harness・report・receiptは別保存し、後続検査のinputsへpinした。

変更Sourceに直結するlegacy省略回帰も `0c08e3f9f17e462c847fa326a00fb353`（旧memory / observer / Worker continuation17件）と `7bec06833539409bbe5fb7ffb59ba80c`（practice / preview / JSON再開 / Host初期4件、他9 skip）でPASS。新12 tests・最終型検査・旧Chrome行列・2048seed・9回はこの追加確認で再実行していない。今後はこれら21件も同Sourceの既存証拠として再利用する。

## 旧保存の限定互換

許容元build全objectはWorkbench `2b954cb4…` / practice UI `f5f634e9…`。許容先全objectは新Workbench `e7a5d07b…` / practice UI `f5fa5416…`。外付けmetadataに上記Chrome proof / 実receipt / 両build全体を固定し、旧configにV222が無くsidecarも無い場合だけ例外とする。

未知field・欠損・混合hash・新policy混在・他旧buildを拒否する。保存configの書換え、旧系列の補作、将来buildへの自動継承は0。現build完全一致とCoreのsameConfigurationは維持した。1つの有限fixtureの証拠を、任意の旧Core・全入力の普遍互換へ広げない。

## Sourceと表示

| Source | SHA-256 |
| --- | --- |
| pure model | `72809ae150ef0db69d3760437ce59974d6223e214700d6a29a979b6614d0d866` |
| observer | `9118220265fdf36a66ac8c9d01a13813a82da75feb14ddc9ca8d845da408e9bf` |
| LivePitch | `8b3b338d55b62f9cd7727f1227f9af6c3bdf645d2a2c3595640098801d33ec59` |
| LiveMatch | `3f01a1ae0b9a3707592c185cc2ae54f420beeaa604989aaae692fcbfd6d8254c` |
| practice UI | `f5fa541660512eed501a2453b9a0bdcfc8ede6dbc6fffe7f43ce33dfea96326c` |
| normal bridge | `57436e2b005185fd07689ada21faee1baf1f341057d1256cea493485c386d4f7` |
| builder | `a9dfd315c80797940aa5151d667040d4ed3d91f9a219aa3bb8c9488b202080c5` |
| final QA | `372253b1db750061cc5c3c7f46494aed0d2133d1532308648cf07a7da4e96e85` |

変更前の一部共有TS / adopter Sourceは開始SHAのみ保存され、全bytes baselineは無い。そのため逆変換による旧TS全文一致は主張しない。既存受入bundleと実runtime比較の範囲を明示する。共有未公開の既存変更を含むSourceを公開する場合も、今回差分とGit親全差分を混同しない。

新HTMLのscreenshot-only1200 / 390pxを主担当が目視し、初期操作欄の表示に重大な破綻を認めなかった。投球・比較ケースは再実行せず、撮影前後HTML SHA一致を保持した。

未完はfamily認識と人間校正、ニッチロー初球以降の一般的な受入、SPIN4の不足対照、production分類、全試合batch / 9回 / 性能、完成版3HTML・全Source同期・最新設計GitHub全文照合。`performancePass:false`、全Goal未完を維持する。private capture / raw / failed artifacts / source archivesは公開しない。
