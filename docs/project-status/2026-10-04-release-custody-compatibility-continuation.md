# 非デザイン継続: release境界の互換性を保った補正

> 公開: [PR265](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/265)、[実装commit](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/2e361ee47e8dc32297b51fc185ab911b3ebac681)。[最新の統合状況](2026-10-04-nonvisual-continuation-checkpoint.md)も参照。

更新: 2026-10-04 JST（2026-10-03 UTC）

[PR263](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/263) のreviewで見つかった、旧atomic throwのzero-delay release境界を補正した。[PR264](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/264) / [観測model実装](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/de36ce08c310ab382fe25328dc27d4c143354ba1) の上へ統合している。

## 確認した不具合

Nativeで採用したacquisition→carried motion→zero-delay atomic throwにより、実releaseと直前移動のhorizonがともにelapsed `0.011001` となる。旧解釈では前区間のinclusive終端が残り、release時点も支配していることになった。

さらに、採用前のmotor commandによりfirst-baseのtop planeへ足がその時刻ちょうどに到達する実Nativeケースを作った。足のpoint touchは実際に存在するが、旧解釈だけがreleased ballのcontrolled-base factを残した。これは実物理履歴からの支配fact差を確認したもので、誤OUT/SAFEやofficial scoreを再現したという主張ではない。

## 互換性を保つ変更

- `base_touch_history` と `first_base_race` の新Sourceに、任意の明示field `custodyPolicy: 'release_exclusive_v1'` を追加した
- 明示policyでは、atomic releaseと同じ終端を持つ旧inclusive control windowをexclusiveへ閉じる。実際のfoot history、ball/Player motionや元archiveは変更しない
- Policyなしの既存保存Sourceは、元のJSON/hashと解釈でread/reopen/retryできる。過去の証拠を無言で改変しない
- 新しいpolicyなしの採用は、旧解釈と補正後のcontrol windowsに差が出る場合だけfail closedで拒否する。新しく誤った境界を増やさない
- 未知policy・余分なfield・既存Sourceへのpolicy追加は拒否する。補正には新しいSource identityと現在headのpredecessorを使う
- 既にexclusiveなscheduled releaseは両経路で同一。新store/schema/registryや別の結果authorityは作らない

## 検証

- Native stale endpointとfresh omission受入れをREDで確認後、補正してGREEN
- 旧archiveのliteral snapshot SHA256 `282d93ebac8f07d676dcc4248e074115b62583d9f8be61567df8ac9d400cd210` とSource SHA256 `28cf49952957ccd3b4e24748e0a5d472f40dbafafb94c4aa215f56f437177b88` を固定して保存互換性を検証
- Policy forwardingを一時的に除くmutation testで、実Native foot/control regressionがREDになることを確認してから復元
- Final isolated focused gate: **6 files / 47 tests PASS**。旧field/rule/WAL、scheduled history、persistent contactを含む
- Fresh independent review: issueなし。Native footとscheduled equivalenceの独立2 cases PASS
- PR264 stackへの統合後: **13 tests PASS**、90.68秒、exit0。Typecheck / diff check PASS
- 新しい累積Sourceのwholeは、actual observation接続後にSourceを固定した統合gateで確認する。先行PR262の別Source検証を流用しない

詳細: [実装planと検証記録](../superpowers/plans/2026-10-04-release-custody-compatibility.md)。デザイン/UI/art/Presentation、自宅/self-hosted CI、workflow/config/lock、merge/force pushは変更していない。
