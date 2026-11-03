---
name: route-task
description: Select whether main Opus 5.5 should implement directly or use Haiku/Sonnet/Opus subagents based on coupling, risk, size, and verification cost. No mandatory delegation.
---
# Route a coding task

1. Determine size (small/medium/large), risk (low/medium/high), whether work is independently testable, and whether it is tightly coupled to main context.
2. Obtain a reproducible routing suggestion: `python scripts/claude_env.py route --size medium --risk medium --independent`. For tightly coupled changes add `--coupled`. For independent search add `--research`.
3. Treat the script's output as a decision aid, not absolute policy. Main Opus may retain execution if decomposition would waste time or harm correctness; give the reason.
4. If delegating, set a precise task contract: owned files, prohibited edits, tests, interfaces, completion criteria, maximum retries, and summary format.
5. Do not run multiple writable workers in the same files. Prefer a sequential worker unless real independent worktrees and an integration plan exist.
6. Note the actual model in `/tasks`; if unavailable, do not pretend a different model ran.
7. Escalate to Opus after two unproductive lower-tier attempts rather than repeatedly retrying.

Official shortcut alternative: `/model opusplan` uses Opus in plan mode and Sonnet in execution mode, without separately managed subagents. This is a different workflow; measure it as another candidate before combining both.
