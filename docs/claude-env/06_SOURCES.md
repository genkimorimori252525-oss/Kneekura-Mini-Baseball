# Evidence and sources (2026-11-02時点)

## 一次資料 — Anthropic / Claude Code

- Claude Code Subagents 仕様（モデル、effort、frontmatter、ツール制限、worktree）: https://code.claude.com/docs/en/sub-agents
- Claude Code Skills: https://code.claude.com/docs/en/skills
- Claude Code Hooks: https://code.claude.com/docs/en/hooks
- Claude Code Settings: https://code.claude.com/docs/en/settings
- Claude Code Models、`opusplan` の公式説明: https://code.claude.com/docs/en/model-config
- Claude Codeの構成要素の使い分け: https://claude.com/resources/articles/steering-claude-code-skills-hooks-rules-subagents-and-more
- Claude Code subagent使用判断: https://claude.com/ja/resources/articles/subagents-in-claude-code
- Opus 5.5のプロンプト/effort調整: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5
- Anthropic Optimizing for cost and intelligence (内部実験と限界): https://platform.claude.com/docs/en/about-claude/models/optimizing-for-cost-and-intelligence
- Anthropic「How we built our multi-agent research system」(並列研究の成功例、コーディングでは依存関係の課題を明記): https://www.anthropic.com/engineering/multi-agent-research-system
- GitHub CLI issue create/list: https://cli.github.com/manual/gh_issue_create , https://cli.github.com/manual/gh_issue_list

## 学術研究

- MIT Media Lab / Nature Machine Intelligence: 「When do AI agents benefit from collaboration?」260構成、ソフトウェア開発等を含む比較。強い単独エージェントには分業が常に有益ではない。https://www.media.mit.edu/projects/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/overview/
- Google Research「Towards a science of scaling agent systems」並列タスクでは利益、逐次タスクでは不利益。https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/
- BenchAgent論文、singleとmultiを同一条件で比較（あくまで当該モデルと課題）: https://huggingface.co/papers/2606.05670

## Reddit — 実体験（制御実験とは別）

- 「Sonnet 5 vs Opus 5.5 for sub-agents」27実行ずつの個人計測。Opus workerの手順・時間が少なかったが、同一課題の統制比較ではなく、Sonnet 5（Sonnet 5.5ではない）との比較。https://www.reddit.com/r/ClaudeCode/comments/1wowv2s/sonnet_5_vs_opus_55_for_subagents/
- 「I went from exhausting weekly limits...」Opus 5.5計画とSonnet 5.5実装で体感改善。ただし同時に複数の改善をしたため、サブエージェント単体の効果は特定不能。https://www.reddit.com/r/ClaudeCode/comments/1x7ifnd/i_went_from_exhausting_claude_codes_weekly_limits/
- 「My Claude Max weekly limits fix...」Opus + Sonnetで使用枠が2〜3倍長持ちとの個人体験。https://www.reddit.com/r/ClaudeAI/comments/1wyo15x/my_claude_max_weekly_limits_fix_opus_sonnet/
- 「My Opus-orchestrator / Sonnet-subagent setup...」過度なMax Effort・再試行・長時間オーケストレーションが負担になった反例。https://www.reddit.com/r/ClaudeCode/comments/1wgni4d/my_opusorchestrator_sonnetsubagent_claude_code/

## 採用した結論の強さ

- **確度高:** 並列分割が有益かは依存関係とモデル性能による。小さな逐次作業は、単独エージェントが有利な場合がある。
- **確度中:** Opus司令塔＋Sonnet workerが多くの独立した普通の実装で使用枠を節約できる可能性がある。
- **未確定:** どのモデルの総使用量が当該ユーザープロジェクトで最小か。答えはコスト/完成率/手戻りを同一条件で比較して決める。
