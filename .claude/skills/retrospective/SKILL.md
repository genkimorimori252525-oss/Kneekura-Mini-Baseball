---
name: retrospective
description: Improve this Claude Code environment from real feedback, task completion evidence, and repeated defects, with a reviewable one-change experiment and rollback.
---
# Evidence-based environment improvement

1. Read `docs/claude-env/03_FEEDBACK_LOOP.md`, `docs/claude-env/05_EVALUATION.md`, and `docs/claude-env/LESSONS.md`.
2. Run `python scripts/claude_env.py summary`. The counts cover only recorded events; never infer a weekly Claude usage limit from them.
3. Examine comparable tasks (size, risk, coupling), success, regressions, retries, review/repair, time and actual measured usage where available.
4. Identify the highest-evidence recurring issue. Propose **one** change only: a skill prompt, routing threshold, test gate or limited hook.
5. State why the old approach failed, new expected behavior, test sample, success threshold, possible side effects, and easy rollback.
6. Wait for user approval before editing core policy. Test the change; enter only independently verified lessons in `LESSONS.md`.
7. If evidence is thin or contradictory, propose collecting more data rather than changing the setup.
