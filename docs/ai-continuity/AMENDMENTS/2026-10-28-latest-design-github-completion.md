# 完了条件の追加：最新設計本文をGitHubへ反映

2026-10-28 JST / MB-20261027-REALISM-DEBUG-PLAN / root。

本人が進行中のgoal本文を直接編集し、従来の「全対象の実検証と配送完了時だけ」に「また最新設計をGithubに上げた後だけ」を追加した。新しいgoal本文を正式な最新指示として保持する。元の実装・検証・配送scope、延期、原入力/原スイング/前版・全FAIL/TIMEOUT/UNKNOWNは削減しない。

完了前に、最終実装と整合した最新の設計本文（主計画と必要な関連設計）を対象projectの既存GitHub repoへ反映し、公開範囲/私的payloadの混入を確認する。GitHub上の対象branch/ref・file本文を実際に再取得し、ローカルの採用設計と内容/SHAを照合する。PRの進捗commentだけ、ローカル文書だけ、pushの意図だけで代替しない。

この追加は設計反映の要件であり、force push/無断merge/deploy、原JSONや私的ログの公開、共有dirty tree全体の無差別commitを許可するものとは解釈しない。現時点では設計本文の新要件のGitHub照合は未実施で、全goal ACTIVE。通常の安全な作業は続ける。
