---
name: report-bug
description: Reproduce and triage a confirmed defect, create a private local GitHub Issue draft, check duplicates, and publish only with approval or explicit private-repository opt-in.
---
# Confirm a bug and prepare a GitHub Issue

1. Distinguish tool errors, speculative concerns, project defects, and security incidents. Never automatically classify a failed shell command as a verified bug.
2. Confirm expected behavior, observed behavior, minimal reproduction, affected version, and validation evidence. If not reproducible, mark `verified: false` and request more evidence.
3. Prepare a JSON object in `.claude/feedback/issue-input.json` (local, ignored by Git), using `docs/claude-env/ISSUE_INPUT_EXAMPLE.json` as the schema. Before saving, remove private identifiers, tokens, raw traces and secret values.
4. Run `python scripts/claude_env.py issue draft --from-json .claude/feedback/issue-input.json`. Read the resulting local `.md` completely.
5. Ask the user which `owner/repo` to use and get approval before publication. Check whether it is public. Never create a public issue automatically.
6. After **explicit** approval, run `python scripts/claude_env.py issue publish --repo OWNER/REPO --file .claude/feedback/issues/bug-<fingerprint>.md --confirm USER_APPROVED`. For public repository add `--allow-public` only if that public disclosure was specifically approved. The script checks existing issues by title/marker first (best effort).
7. Optional auto-publication works only after user-created `config/claude-env.local.json` allows named PRIVATE repos and verified cases. Use `--auto`; never enable the config on your own. Do not use direct `gh issue create` to bypass approval.
8. Report real GitHub URL only after the CLI confirms success. If unavailable, keep the local draft and state why.

Publishing to GitHub is an external disclosure. A `.md` draft is a local artifact, not a posted Issue.
