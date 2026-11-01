# Claude Code — project contract

Current state and next action: `docs/ai-continuity/CURRENT.md`. Read only what the task needs.

- Main Opus implements small or tightly coupled work directly. Delegation is optional: `implementer-sonnet` for independent bounded work, `complex-implementer-opus` for hard bounded work, `reviewer-opus` for consequential read-only review. Details: `docs/claude-env/02_MODEL_ROUTING.md`.
- One writable agent per file set. Escalate after two failed attempts instead of looping.
- Never claim a test, cost, Issue URL or model that was not observed.
- Remote writes need user authorization. This repository is public: never publish personal player JSON, local paths or raw logs.
- Before editing an untracked or already-dirty file, back up its exact bytes and record SHA-256.
- Record corrections with `/record-feedback`; propose environment changes with `/retrospective`. Hook failures are observations, not confirmed bugs.
