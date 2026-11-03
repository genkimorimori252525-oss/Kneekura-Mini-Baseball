---
name: record-feedback
description: Record explicit user or test feedback as local, non-shared data; classify root cause and propose narrowly scoped improvements without editing policy automatically.
---
# Record feedback (local only)

- Accept concrete user feedback when provided. Do not demand a satisfaction survey after every small task.
- Separate factual outcome from perception. Label correction, success, unclear instruction, regression, or excessive cost.
- Invoke: `python scripts/claude_env.py feedback --task-id TASK-001 --rating needs-fix --comment "Regression in X" --model claude-opus-5-5 --route direct --source user`.
- This saves to `.claude/feedback/feedback.jsonl`, which is ignored by Git. Never send it to GitHub without user review.
- If a feedback comment contains a credential or personal information, redact before calling the script.
- Suggest an improvement with evidence, predicted benefit, potential harm, one measurable validation and rollback. Do not rewrite CLAUDE.md or global rules without user approval.
- For recurring feedback (e.g. three independent occurrences), invite `/retrospective` instead of generating another huge framework.
