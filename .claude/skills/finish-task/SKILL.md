---
name: finish-task
description: Verify completion with measured evidence, record the outcome, surface failure conditions, and hand off work concisely.
---
# Finish a development task

1. Compare implementation to approved acceptance criteria. Inspect diffs and run relevant tests; if not run, say so.
2. For consequential changes, use an independent read-only Opus reviewer when justified. Independent review does not replace executable tests.
3. Record the task with actual data: `python scripts/claude_env.py task --task-id TASK-001 --size medium --route delegated_build --model claude-sonnet-5-5 --status complete --tests passed --retries 0`. Only include duration or cost if measured and cite its measurement source in your report.
4. If a defect remains or a regression was found, create a local bug draft using `/report-bug` and ask before publishing.
5. Final answer: summary, changed files, test evidence, model/worker actually used, outstanding risks and next action.
6. When the user supplies explicit positive/negative feedback, invoke `/record-feedback`; do not invent it.
