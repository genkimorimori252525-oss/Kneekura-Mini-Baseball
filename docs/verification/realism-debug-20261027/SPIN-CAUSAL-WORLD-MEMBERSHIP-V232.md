# 閉鎖範囲の所属を先に認証する

2026-10-30 JST。技能適用資格の検証が、その資格を使う後続consumerへ再帰しないための境界を追加した。今回の真正データは過去の未校正trial1件であり、新qualified consumerやその成功を証明していない。

## 実装

`PhysicalCommitmentWorldMembershipV232.ts`が、World prefix全payload hash、全commitmentのcanonical Source / snapshot / hash / row mirror / aliasと、World eventのkind / career / sourceId / fullref / before-after / actionKeyの1対1対応を先に検証する。`after=before+1`も確認し、raw capabilityや未認証revisionで対象を除外しない。

V228 censusは認証済み`after<=end`のcommitmentだけを通常physical Readerで再導出し、その後にtrial / 本人 / domainを分類する。範囲外futureは所属を検査してもfull consumerを再導出しない。これにより将来の資格付きconsumerを、当該資格の閉集合検証へ逆流させない。

resolutionはcanonical commitment参照と所属・重複・孤立を検査した`resolutionCandidates`。独立したWorld位置がないため、これだけでcutoff内の結果とは認定しない。対象commitmentの通常再導出と、Sourceへ固定したresolution fullrefsを別の閉鎖証拠として照合する。

既存physical Reader / writerはevent builderだけを共通化した。開始時56017Bの`SamePlateAppearancePhysicalEpisodeFromSqlite.ts`を保存し、import / 旧定義削除 / 2 call置換を逆変換すると全bytes一致。物理計算・旧Source型・旧event payloadは変更していない。reverseproof SHA `c2df4ff609359854a53f5460a87764e0b6593eecfd0619e63af034f6a152072a`。

## 検証

- metadata / event / alias / resolution候補の関連tests、保存正常V123 / V226と合成V1の新旧event / canonical JSON / hash一致 `0a583993`、最終strict `c8943ad9` PASS。独立Solレビューでhelper・cut介在P2修正・配線・census統合をそれぞれ確認。
- census統合のTDD `847e165f`（範囲外をfull deriveする）から修正し、3 tests `0ac67ee5` / 対象直接strict `5ae25325` PASS。主要census / futureケースはOwner代替の検査。
- gate entryは同一の既存borrowed read snapshot / lifecycle phaseで正常Readerの認証済みproofを共有する。新cacheや未認証資格の仮信用は追加していない。entry直接strict `8fa8d961`、driver構文 `4ea3a242` PASS。
- 真正readonly `9b82b28a5b894ea58de46b9735bb9808` PASS / 13,842ms。commandは `node tools/verification/check-spin-aim-causal-membership-v232.mjs work/spin-aim-causal-membership-v232-01`。
- 正常World所属1commitment / 1resolution候補、閉集合、pre/post domain・provenance、V230保存不足評価が旧記録と全値一致。trial1 / qualificationApplicable=false / currentDecisionAccepted=falseを保持。
- 原本と保持済み全10 DBを開かず全files不変。所有コピーの全row / rowid / schema / head / data、caller q1 / savepoint / authorizer、Source / bundle / artifact終了pins不変。newwrite / contact / practiceは0。

log SHA `b64cfeccb3f53ededf4241d932cbb806715ce1aa3357f952a90301a6633794b2`、report SHA `b3b9b705d464f2df1f51616db0a786dac2caacdbd030fe2c4352c69e810375d6`。

13.842秒はこのgate条件だけの実測。前V231の119秒とは新membershipとphase共用など範囲が異なり、同条件の性能比較や試合速度改善とは呼ばない。元4分contactや旧6練習は再実行していない。

## 未完と失敗記録

新qualified Source arm、資格境界を超えない再入順位の実配線、新consumerのinsert後再読、真正合格資格、4技術・Gold・完成3HTMLは未完。資格end<=consumer.before、event.after=before+1をReader再入前に検査して因果位置を厳密に減らす次の作業が残る。

初版のcross-physical alias見落とし、commitment→cut→resolutionの正規経路を誤拒否するP2はREDから修正した。`e9a0bc50`はfixture path誤り、`51acf96a`はNodeアクセス違反・原因UNKNOWNとして保持。後のPASSを原因解消と扱わない。過去FAIL / TIMEOUT / UNKNOWNも保持する。
