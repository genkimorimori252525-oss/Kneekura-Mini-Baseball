# V109 受け手の到達に合わせる早い軽送球

Task `MB-20261023-V109`。本人の直接指示: 4–6–3等で受け手の塁到着を待って強く投げる代わりに、早くリリースし到着時に受け取れる軽い球を選ぶ。肩力・距離・走者・既存信頼による個人差、実受球/踏塁による公式判定は維持する。本人の依頼範囲内の通常判断を記録へ置き換える方針に基づき、確認を反復しない。

現行は `control=max(releaseDelay+flight,receiverReady)` で受け手待ちを加算し、competitiveの同値から強球を優先する。受球同期のflight候補自体がなく、実release時のV99 guardが後から待機させる。受球guardを緩めず、共有ThrowPlanの有界候補生成と選択だけへ受球到達に合わせる候補を追加する。準備＋空力飛行を実検証し、同じ締切を保てる範囲で早い実行可能releaseを選ぶ。受け手が既に準備できる勝負送球の最高出力方針は維持する。

対象は共通送球予測とActionの選択理由、既存ゲージの日本語説明のみ。新しい公開能力/保存形式・専用アニメーション・捕球保証・飛行中の球速補正は追加しない。通常/maker/labへ別名V109で反映。旧V108/原JSON/既存FAILを保存し、source commit/push/merge/deployなし。限定Sol既存1名の読取監査のみ。

初回対照 `024a214ecf7e46ac879cf32c2ac3f46b`: SSを-16mに置いた実4–6–3でrelease2.874→2.474秒、41.95→17.08m/s、受け手は塁まで4.63m残して受球へ入り、1OUT→2OUT。初期配置では変更なし。また、肩65m/s条件は旧新版ともscope_exhaustedとなり原記録を保存した。予測が姿勢→chargeを直列計上する一方、実行は姿勢→手をchargeと並列で行う差を確認。通常/direct・relay・併殺予測の3箇所を実行順 `transfer + max(posture + hand, charge)` にそろえる。V108でのRF場面には影響しなかった一般仮説だが、今回は短い塁間送球の同期候補を消すため同scopeで修正する。実motor・準備・charge・受球guardを短縮するものではない。

検証: 動く受け手への軽い早出し/準備済み受け手への強球/無理な期限/能力差をRED→GREEN、実4–6–3の動く受け手と接触・踏塁・併殺判定を確認。関連回帰、型、HTMLの入力差と旧版逆照合、PC/スマホの実画面、編集/JSONを実検証する。復旧は旧V108を開く。係数・有界探索はMLB実測/最適解を意味しない。

広い回帰の初回 `e220b77ad5bb42c4ba6c79e186a3102c` は84PASS/3FAIL。失敗は旧テストが0アウト満塁で本塁への固定ルートを期待する3件で、新予測では3→2の併殺または別塁の実アウト機会を選んだ。受球不能や終端失敗ではない。home anticipation/relay custodyを試す当該fixtureを2アウトにして競合する併殺を排除し、捕球/新transfer/実接触/踏塁/速度制約の厳密assertは残す。0アウトの4–6–3は新しい実連結3件で別に検証する。AIを固定本塁ルートへ戻す特例や期待値の単純置換はしない。原FAILを保存。

最終: 対象8件 `6e8808be546d40a0b165be65105771ef` PASSで関連87件を重複なく確認。型 `470ab40c4e604d499bc37cb4b4504f3e`、生成 `d1d1b16c15e245019b54b07202ecc6ff`、Chrome PC/スマホ10条件/通常2/調整室 `6c70f4c694c446378533a17680f2879d`、人間/AI編集・保存・旧JSON `4a466f26eb204e7e98eb56e6130f486d`、9ファイル別名配置 `01bc71617e2049948068a03938997bce`、audit `a0cd4959b5644d6988734ebef6fcd56d`（0errors/228既存warnings）すべてPASS。Core4source差/154入力、通常表示はCore/版以外V108へ逆一致、既存JSONと能力/球場/身体/表示を維持。型の新理由union漏れとChrome末尾clampによる検証frame不一致の原FAILも保存。詳細 `docs/verification/releases/v109/README.md`。

公開repoと既存PRのbranch/OPENを確認し、秘密情報・私的パス・生会話を含まない要約を [PR380](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/380#issuecomment-6366443929) へ1件同期。source/HTML commit/push/merge/deployなし。
