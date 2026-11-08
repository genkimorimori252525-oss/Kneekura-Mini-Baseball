# v75 — 技術系得能の専用動作とメーカー調整

人間承認：技術系を先行し、必要な専用動作を実装、効果強さをメーカーから編集し、通常HTMLへ反映する。元の全計画は継続。先行6系統を既存7へ追加し、メーカーの対応は13系統となる。

| 技術 | 専用の実行先 |
|---|---|
| 走塁G〜A／高速ベースラン | 複数塁へ進む際の旋回経路の半径選択。最高走速・加減速・横加速度上限を維持 |
| バント○／バント職人 | 観測予測した打点へ有限速度で構え、迎えて引くC1連続バット。面・位置・時刻の再現性 |
| 守備職人／魔術師 | 捕球体勢による安定性損失と持ち替え所要時間。実送球・中継・到達予測が同じ有効時間を使う |
| 内野安打○／ロケットスタート | 打者走者の打撃から初動への待機時間。他の塁上走者・一般走力へ適用しない |
| 高速チャージ | 観測済み低速接地打球へ拾いながら進む目標を選ぶ。飛球・送球へ適用しない |
| 低め○／精密機械 | 狙いが打者別ゾーン下1/3以下の時だけ、投球初期条件を作る狙い誤差を縮める |

## Sourceと調整

既存traitProfile.selections内source.effectScale（0〜2、初期1）を専用技術の作者Sourceとする。段階と倍率はメーカーから編集し、全JSON/試合用JSONで保存・再読込。倍率0/保有OFF/未指定はruntime controlsを省略する。旧7系統、v1の保存形式、初期20選手の値と元673実測記録は保持。

走塁の段階係数はG−1/F−.65/E−.3/D0/C.3/B.6/A.8/金1、他は通常.5/上位1（高速チャージは通常のみ）。これに倍率を一回だけ掛ける。同family青・金は一状態で排他。一般physical/public能力を書き換えない。独立Sourceは一つで、badgeの別効果を重ねない。Native習得・生涯履歴認証ではなくローカル作成設定である。

局所暫定係数：旋回半径×(1+.04score)、打者初動待機×(1−.15score)、持替え時間×(1−.08score)、捕球の既存姿勢損失を.08score分軽減。チャージは観測球速度の.03score秒先をmotor目標へ。バント精度は1/(1+.75score)、実バット速度はmin(4m/s,選手の宣言上限)以下。低めは既存commandStd/(1+.6score)。守備手速度・身体到達・回避・実走塁上限を維持し、時刻や位置の修正、判定・打球角・速度・spinの後付上書きをしない。これらは実選手の測定校正ではない。

## 接続と互換

LiveTraitProfilesのopt-in includeTechnicalで13系統を投影し、従来呼出は7系統。setterと厳密parserで同family重複、未知state/source、0未満/2超/非有限、getterを拒否する。Hostと打球比較が同じresolverから専用動作へ渡す。無効UI入力はaccepted値を保持し、実保存・比較を拒否し、再入力で復帰する。

独立レビューP2：当初公開resolver単独が未知family/versionをskipした。Host/roster入口は元から厳密なので実行経路へ影響はなかったが、公開resolverも同じreadProfileを通すwrapperへ統一し、未知version/family/source余計key拒否を追加検証した。旧成功結果もbefore-strict-resolver/へ保存。

カメラ/4px表示/55・22ms/名前/バット軌道pane/全幅打球比較は継承。Core hash変更のため旧Coreの試合replayは混用を拒否、能力設定JSONは互換。

## 実検証

- 関連回帰19files193tests PASS（71.375秒、公開境界修正前）。修正後の最終Sourceは5files39tests PASS（8.092秒）、全体TypeScript PASS（21.467秒）。
- 最終メーカー実Coreブラウザー35.359秒PASS。1200/390、13/旧7、全段階と倍率0/1/2、無効入力の保存拒否と復帰、実2種JSON保存/読込、他選手・physical・元clip不変、バント/低めの比較入力、既存全幅配置、例外/通信/overflow0。
- 最終通常HTML88.047秒PASS。初期/zero/off各6球がv74の全Source/bat/裁定exact。20人120選択のJSON保存一致、unknown/state/scale原子拒否。バントは49batframe・最大3.145m/sで実接触、低め101投球。技術保有の通常9回は254球95接触・95field全complete（9回部分62.874秒、9表3out、9対26）。通常/調整室の1200/390で例外/通信/overflow0。
- 守備/走塁4技術の独立効果はfield unitの実frame/fact/時間比較と組み合わせて確認。9回のdiagnosticsに生のtechnicalSkills一覧を出していないため、その文字列出現数0を未接続・個別効果検証と解釈しない。
- 配布照合28.389秒PASS。Native117/Maker84/Source union124、同一通常renderer、3HTML、旧215凍結ファイル不変。

[全machine receipt・原FAIL](../verification/releases/v75/README.md)。初回pitchの期待値/fixture不一致、makerのsnapshotgetterにsaveguardを期待した誤り、gameの閉detailsクリック待ちと未await download timeoutを修正し原結果を保持。中間game再試験は9回前に停止、最終9回は一度。

残りの技術系、心理・疲労・故障・盗塁、身体ブロッキング/こぼれ球継続、Native連続世界、経験的SI/得能強度の校正、100試合分布監査、実機スマホは後続。単一9回の高得点を現実の成績分布へ校正済みとは呼ばない。原CharterHOLD/旧FAILUNKNOWNを保持し、全目標達成と扱わない。
