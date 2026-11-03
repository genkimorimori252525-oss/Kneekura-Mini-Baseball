# V113 verification eviction の変更を非採用

- 対象: `src/core/sim/fielding/LiveThrowPhysicalMemoV113.ts` の verification eviction 走査。2026-11-01、本人の「測ったら機能へ戻る」方針と主担当からの復旧指示に従う。
- 判断: 今回の変更は採用しない。保存済み６球目を各条件１回、旧→新の順で計測した結果は 21,350.4 ms / 21,114.2 ms。順序効果やばらつきを区別できず、今回有意な改善は未証明。改善不成立や全試合への影響を断定しない。
- 根拠: 新観測では verification eviction 4,705 回、receipt `e58e9f0af44a4c2b84ba9dec2640c065`。限定 fixture receipt `21b9001de22d4405ae33bfce1efb29f3`、実球の record / continuation 一致と測定 receipt `f655ef6d5e444a75b2c7ea0fb5b59713`。GC trace は符号化等を含み buffer 完全性未確認。
- 復旧: 測定時変更版 SHA-256 `0b1357e83de29c1a2b93ff445bfc109b91bba5545a2eadff4f7756a4bc97928e` を確認後、事前 backup の exact bytes に復旧。復旧後 SHA-256 `e951d60a4c1232bf234af5e692a5799c14022228a7b049b7c3609f1fe7b9d3c6`、receipt `b988f901a3a84bc3af29f0725e925d71`。backup は `work/throw-memo-v113-next-01/source.before.ts`。元 file は未追跡で来歴は UNKNOWN。
- 既存測定・fixture・FAIL を保持し、benchmark および旧 test の再実行はしていない。
