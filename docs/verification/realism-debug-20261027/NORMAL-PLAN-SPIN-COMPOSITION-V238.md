# 通常の方向・心理計画を保持するXY合成

2026-10-30 JST。通常打撃の計画へXY差分だけを合成する新版を実装し、本人JSON／実browser Workerで差分ゼロの不変性と非ゼロの実運動を確認した。**4技術の通常獲得・Gold・全domain・完成版配送は未完。**

## 変更

同じ一球request欄を厳密なversion unionにし、旧V236 raw試行は保存形式と動作を保持。新版`live_observed_spin_compose_trial_v238`は深度・時刻差分を持たない。通常のnominal／motor中心へXYを合成してから既存の誤差・offset・制約を適用し、方向／AUTO／prior／認知bias・late correctionを維持する。

差分ゼロは加算自体をせず、旧式の数値経路とsigned zeroを保持する。Host／Practiceの既存型とtransportはそのまま使い、Source変更は不要だった。UIは診断詳細でraw／通常計画への合成を選べ、新版では深度欄を表示・使用しない。選手の保存値へ能力を追加しない。

診断は`observedSpinComposeV238`、statusは`PLANNED`。これは技術の成功ではない。要求差分、誤差前の計画差、最終登録位置を分け、反実仮想normalと比較していない単独計算の`actualExecutionDelta`はnull／`MATCHED_NORMAL_RUN_REQUIRED`とする。技術名による結果spin補正、未来実球からのaim、資格移転は0。

## Source・関連検証

Core module `5e990ed24fc5c53eaab0d688413fe69a9d74a21cc64c210e5d24f8a0fdae8240`、test `6b9762ef13ea6a6f51b4ba0ae933b48f763b713b7b40612c30dc8de1cd8d20a7`、LivePitch `496bc1a387b9164453d329ad753cc0227a70c16983a4c56043441c61c527a33a`、comparison UI `0f15b38a1ec90928c996a19316b9b06944a0e8b6637befd16c0fcc35bf4a8379`。Solは3Source／testを独立レビューしReady。RootはUI／driverを確認し、開始worktree／Git親と実scratch逆patchの全bytes一致を検証した。

- 関連4 tests `30a770384dac430fb85a68acef0bb63e` PASS24,891ms。R／L×4方向、非ゼロprior／認知bias／lateを含むzero全record、clock／RNG、非zero Lで実際のlate適用後のXY差とZ／clock維持、Host／Node worker／保存再開を確認した。固定R4probeはすべてmiss／exitSpin nullのまま保持。
- 旧raw／省略経路の関連検証 `0beb84955a2d4526b648bf79e046e8a4` PASS3,406ms、strict `78c67f27c9074e19bcea15355460d3f9` PASS2,796ms、UI構文 `12a69e35dfa54a6482efd536ca3bee87` PASS47ms。
- 旧pure型FAIL `7d3cd42e`、IEEEの和を0.21とした期待値FAIL `6124d0cb`、未統合RED `77f7910d`は保持。実和を丸めて合わせず、期待演算と計画差／要求差の区別を明示した。

Rootは各receiptのtask／PASS／exitとlog実bytesを照合し、同じテストを再演していない。Node worker threadを実browser Workerの証拠には使っていない。

## 本人の実ブラウザ受入

`651324b3643047b184ec878f5bcb275e` PASS78,280ms、実行は1回、session7723は終了済。Chrome `156.0.8078.49`、原JSON e012…を正常importし`1-b0 / L / obp-23_5`、673clips／92,201framesを保持。preview用clipを代用しない。新Source／新buildの初球warmup1回後の同一captureから、通常・compose zero・固定4probeを比較した。同pitchの分岐対照であり、独立獲得試行には数えない。

- 全6ケースでMain対実Workerの全record／continuation／preview一致。
- zeroは新requestと新diagnostic以外の全record、continuation、同tick実playback位置3成分が`Object.is`で一致。方向／心理計画の置換はない。
- 非zero4件は全て実接触。予定時計、用途別乱数のseed／drawCount trace、late correctionが通常と一致した。この本人ケースではlateが実際にapplied=true。記録されたRNG traceは17 stream entriesであり、全用途／全分布の受入へ拡大しない。
- 非zeroの同tick実sweet spot差を下表のまま保存した。小数差を要求値へ丸めて一致扱いしていない。全てZ差0。
- 接触exit velocity／spinが通常outgoing moment／fieldへ渡る。全試合・全弾道／裁定の完成ではない。
- 元JSON／正常roster／Source／HTML／bundlesの開始終了pin、ケースごとのWorker前request hashと結果end hashを元run内で保存・再照合した。page errors／外部requestsは0。
- 1200／390pxの実画像をRootが確認。合成modeで深度欄は非表示、表示4入力は390pxで全て340px、横書きラベルと入力値を確認した。

| 指定 | 要求XY差（m） | 実XY差（m） | 局所spinの観測 |
| --- | --- | --- | --- |
| compose zero | (0, 0) | (0, 0) | 通常と完全一致。技術成功に数えない |
| BACKSPIN | (0, +0.01) | (0, 0.009999999999999787) | 要求とは逆方向 |
| TOPSPIN | (0, -0.01) | (0, -0.010000000000000231) | 要求方向の成分が正 |
| SLICE | (+0.01, 0) | (0.010000000000000009, 0) | 要求とは逆方向 |
| HOOK | (-0.01, 0) | (-0.009999999999999898, 0) | 要求方向の成分が正 |

通常から既にTOP／HOOK成分がある。指定後も同じ符号であることだけでは、その技術を因果的に制御できた証拠にならない。元の成分と差、接触率、方向を分け、4技術成立にはしていない。回転観測は事後分類であり物理補正ではない。

log SHA `7028a7738007d535c9a5b74c0b4d750eee28301912da7a53804f572c70c94025`、report SHA `ffc67adca2132870d8b1bb1873c9d9fc916e209983ee260278859da4c1908c36`。candidate HTML `aaf9241c672202ebaeb6d8f197b604fe8714f53cbbdd8c76162050d3d0a6a368`、Native `2aa689aaa40355b46b7ef14e232f7de74f452b8959f0c0a0a7943cd2b80cb33f`、Workbench `a2576fc1404adbec73edb3c078378ebf51de3bf9422f29855ccbb643a7991fc2`。旧candidate・元JSON・旧FAILは上書きしていない。

## 次の機能単位

数値入力の診断だけで終わらせず、技術選択から本人・clip・domainに結び付く固定motorを解決し、同じ通常consumerを通して独立practice評価を記録する。旧V123のlocal自己申告状態を資格へ転用せず、旧`spinMotionV123`がV153方向登録を止める経路も新policyへ持ち込まない。

motorと評価条件を先に固定し、更新に用いたデータをその版の独立獲得証拠へ再使用しない。未成立はUNAVAILABLE、Native資格とGoldは別受入とする。手順は次の固定motor practice仕様へ引き継ぐ。全Goal／キレ物理3段階／Native時計HOLD／完成3HTML／9回／性能／配送は未完。
