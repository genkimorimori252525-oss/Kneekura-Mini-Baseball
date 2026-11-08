#!/usr/bin/env python3
"""Claude Code Environment Kit: local feedback, routing, and GitHub issue drafts.

Standard library only. All remote GitHub writes require explicit approval or an
explicitly configured private-repository opt-in. No network is used by hooks.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / ".claude" / "feedback"
ISSUES = LOCAL / "issues"
ISSUE_POLICY = ROOT / "config" / "claude-env.local.json"
MAX_STDIN = 256_000
MAX_LOG = 2_000_000
REPO_FORMAT = re.compile(r"^[\w.-]+/[\w.-]+$")
SECRETS = [
    re.compile(r"gh[pousr]_[A-Za-z0-9_]{12,}"),
    re.compile(r"github_pat_[A-Za-z0-9_]{12,}"),
    re.compile(r"sk-[A-Za-z0-9_-]{16,}"),
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(r"(?i)(?:password|api[_-]?key|secret[_-]?key|token)\s*[:=]\s*[^\s]{8,}"),
]


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def scrub(s: str) -> str:
    for p in SECRETS:
        s = p.sub("[REDACTED]", s)
    return s


def has_sensitive(s: str) -> bool:
    return any(p.search(s) for p in SECRETS)


def append_jsonl(name: str, data: dict) -> None:
    LOCAL.mkdir(parents=True, exist_ok=True)
    target = LOCAL / name
    line = json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n"
    if target.exists() and target.stat().st_size > MAX_LOG:
        backup = target.with_suffix(".previous.jsonl")
        target.replace(backup)
    with target.open("a", encoding="utf-8") as f:
        f.write(line)


def safe_input() -> dict:
    raw = sys.stdin.buffer.read(MAX_STDIN + 1)
    if len(raw) > MAX_STDIN:
        return {}
    try:
        parsed = json.loads(raw.decode("utf-8", errors="replace"))
        return parsed if isinstance(parsed, dict) else {}
    except (json.JSONDecodeError, UnicodeError):
        return {}


def session_ref(hook: dict) -> str:
    raw = str(hook.get("session_id") or "")
    return hashlib.sha256(raw.encode()).hexdigest()[:12] if raw else "unknown"


def cmd_hook(args: argparse.Namespace) -> int:
    hook = safe_input()
    if args.kind == "failure":
        # Never save raw commands, transcript, tool output, paths, or secrets.
        append_jsonl("events.jsonl", {
            "at": now(), "event": "tool_failure", "session": session_ref(hook),
            "tool": str(hook.get("tool_name") or "unknown")[:80],
            "note": "Failure observed, NOT confirmed as a product defect",
        })
    elif args.kind == "stop":
        # Stop is not equivalent to a completed or successful task.
        append_jsonl("events.jsonl", {
            "at": now(), "event": "assistant_stop", "session": session_ref(hook),
        })
    elif args.kind == "guard":
        command = str((hook.get("tool_input") or {}).get("command") or "")
        # Best-effort safety net, not a shell parser or hard sandbox.
        forbidden = [
            r"\bgh\s+issue\s+create\b",
            r"\bgh\s+repo\s+delete\b",
            r"\bgit\s+push\b[^\n]*\s--force(?:\s|$)",
            r"\bgit\s+reset\s+--hard\b",
            r"\brm\s+-rf\s+[/~](?:\s|$)",
            r"\bRemove-Item\b[^\n]*-Recurse\b[^\n]*-Force\b",
        ]
        if any(re.search(pattern, command, flags=re.IGNORECASE) for pattern in forbidden):
            print(json.dumps({
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": (
                        "Blocked by local guard. Review manually; for GitHub issues use the "
                        "approved claude_env.py issue publish workflow."
                    ),
                }
            }))
    return 0


def route_task(size: str, risk: str, independent: bool, research: bool, coupled: bool) -> dict:
    if research:
        return {"pattern": "delegated_research", "controller": "opus-5.5", "worker": "scout-haiku", "worker_model": "claude-haiku-5-5", "reason": "Separate low-risk research context; Opus synthesizes and verifies sources."}
    if size == "small" or coupled:
        return {"pattern": "direct", "controller": "opus-5.5", "worker": None, "worker_model": None, "reason": "Delegation overhead or shared-context dependencies exceed expected benefits."}
    if risk == "high":
        return {"pattern": "opus_specialist", "controller": "opus-5.5", "worker": "complex-implementer-opus" if independent else None, "worker_model": "claude-opus-5-5" if independent else None, "reason": "High-risk changes need stronger implementation and direct Opus review."}
    if independent:
        return {"pattern": "delegated_build", "controller": "opus-5.5", "worker": "implementer-sonnet", "worker_model": "claude-sonnet-5-5", "reason": "Independent bounded implementation; verify and escalate on repeated errors."}
    return {"pattern": "direct", "controller": "opus-5.5", "worker": None, "worker_model": None, "reason": "Sequential integration work is better kept in the main context."}


def cmd_route(args: argparse.Namespace) -> int:
    print(json.dumps(route_task(args.size, args.risk, args.independent, args.research, args.coupled), ensure_ascii=False, indent=2))
    return 0


def cmd_feedback(args: argparse.Namespace) -> int:
    if has_sensitive(args.comment):
        print("Potential secret detected in feedback; remove it before logging.", file=sys.stderr)
        return 2
    append_jsonl("feedback.jsonl", {
        "at": now(), "task_id": args.task_id[:120],
        "rating": args.rating, "comment": args.comment[:2000],
        "model": args.model[:100], "route": args.route[:80],
        "source": args.source,
    })
    print("Local feedback saved (not published or committed).")
    return 0


def cmd_task(args: argparse.Namespace) -> int:
    if args.duration_minutes is not None and args.duration_minutes < 0:
        raise ValueError("duration cannot be negative")
    append_jsonl("tasks.jsonl", {
        "at": now(), "task_id": args.task_id[:120], "size": args.size,
        "route": args.route, "model": args.model[:100],
        "status": args.status, "test_status": args.tests,
        "regression": args.regression,
        "retries": args.retries, "duration_minutes": args.duration_minutes,
        "usd_estimate": args.usd_estimate,
        "estimate_source": args.estimate_source if args.usd_estimate is not None else None,
    })
    print("Local task record saved. Cost is null unless supported by observed usage.")
    return 0


def load_json_object(path: Path) -> dict:
    try:
        obj = json.loads(path.read_text(encoding="utf-8-sig"))
    except (ValueError, OSError) as exc:
        raise ValueError(f"Cannot read JSON from {path}: {exc}") from exc
    if not isinstance(obj, dict):
        raise ValueError("Expected a JSON object")
    return obj


def fingerprint(title: str) -> str:
    normalized = " ".join(title.casefold().split())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:14]


def severity(v: str) -> str:
    if v not in ("low", "medium", "high", "critical"):
        raise ValueError("severity must be low, medium, high, or critical")
    return v


def cmd_draft(args: argparse.Namespace) -> int:
    data = load_json_object(Path(args.from_json))
    keys = ["title", "reproduction", "expected", "actual", "verification"]
    for key in keys:
        if not isinstance(data.get(key), str) or not data[key].strip():
            raise ValueError(f"Missing nonempty field: {key}")
    title = data["title"].strip()[:180]
    sev = severity(str(data.get("severity", "medium")))
    for key in keys:
        if has_sensitive(data[key]):
            raise ValueError(f"Potential secret found in {key}; redact it first")
    verified = data.get("verified") is True
    marker = fingerprint(title)
    body = "\n".join([
        f"## Description\n{data['actual'].strip()}",
        f"## Expected behavior\n{data['expected'].strip()}",
        f"## Reproduction steps\n{data['reproduction'].strip()}",
        f"## Verification evidence\n{data['verification'].strip()}",
        f"## Classification\n- Severity: {sev}\n- Verified reproduction: {'yes' if verified else 'NO (unconfirmed)'}",
        f"## Environment\n{str(data.get('environment') or 'Not supplied')[:500]}",
        "\n<!-- claude-env-fingerprint:" + marker + " -->\n",
    ])
    if has_sensitive(body):
        raise ValueError("Potential secret found in issue body")
    ISSUES.mkdir(parents=True, exist_ok=True)
    issue_file = ISSUES / f"bug-{marker}.md"
    metadata = ISSUES / f"bug-{marker}.json"
    if issue_file.exists() and issue_file.read_text(encoding="utf-8") != body and not args.replace_local:
        raise ValueError(f"Draft already exists and differs; review and use --replace-local to update: {issue_file}")
    issue_file.write_text(body, encoding="utf-8")
    metadata.write_text(json.dumps({"title": title, "verified": verified, "severity": sev, "marker": marker, "created": now()}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"DRAFT: {issue_file}")
    print("Review for privacy and accuracy before publishing. Nothing was sent to GitHub.")
    return 0


def gh(*args: str) -> str:
    if shutil.which("gh") is None:
        raise RuntimeError("GitHub CLI 'gh' is not installed")
    result = subprocess.run(["gh", *args], text=True, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, timeout=35, check=False)
    if result.returncode:
        raise RuntimeError(f"GitHub CLI call failed ({result.returncode}). Check gh auth status and repository permissions.")
    return result.stdout.strip()


def check_draft(path: Path) -> tuple[str, str, str, bool]:
    resolved = path.resolve(strict=True)
    if not resolved.is_relative_to(ISSUES.resolve()):
        raise ValueError("Issue file must be inside .claude/feedback/issues")
    if resolved.suffix != ".md" or not resolved.name.startswith("bug-"):
        raise ValueError("Invalid issue draft filename")
    meta = load_json_object(resolved.with_suffix(".json"))
    body = resolved.read_text(encoding="utf-8")
    marker = str(meta.get("marker") or "")
    title = str(meta.get("title") or "")
    if not title or not re.fullmatch(r"[a-f0-9]{14}", marker):
        raise ValueError("Invalid issue metadata")
    if fingerprint(title) != marker or f"<!-- claude-env-fingerprint:{marker} -->" not in body:
        raise ValueError("Issue draft and metadata mismatch")
    if has_sensitive(body) or has_sensitive(title):
        raise ValueError("Potential secret detected; publication blocked")
    if len(body) > 24_000:
        raise ValueError("Issue draft too long for safe submission")
    return title, body, marker, meta.get("verified") is True


def cmd_publish(args: argparse.Namespace) -> int:
    if not REPO_FORMAT.fullmatch(args.repo):
        raise ValueError("Specify an explicit GitHub owner/repo")
    title, body, marker, verified = check_draft(Path(args.file))
    policy = load_json_object(ISSUE_POLICY) if ISSUE_POLICY.exists() else {}
    auto = args.auto is True
    if auto:
        if not policy.get("auto_publish_private_issues"):
            raise ValueError("Automatic publication is OFF. Set an approved local allowlist first.")
        if args.repo not in policy.get("allowed_private_repositories", []):
            raise ValueError("Repository not on the local private-publication allowlist")
        if not verified:
            raise ValueError("Cannot auto-publish an unverified defect")
    elif args.confirm != "USER_APPROVED":
        raise ValueError("Explicit approval required: --confirm USER_APPROVED (after reviewing the draft)")

    repo_info = json.loads(gh("repo", "view", args.repo, "--json", "isPrivate"))
    private = repo_info.get("isPrivate") is True
    if auto and not private:
        raise ValueError("Automatic publication to public repositories is forbidden")
    if not private and not args.allow_public:
        raise ValueError("Public repository: require additional --allow-public confirmation")

    # Dedup is a best-effort search of GitHub's matching issue titles and bodies.
    query = " ".join(title.split()[:5]) + " in:title"
    issues = json.loads(gh("issue", "list", "--repo", args.repo, "--state", "all", "--limit", "250",
                           "--search", query, "--json", "title,body,url"))
    if not isinstance(issues, list):
        raise ValueError("Unexpected GitHub issue search response")
    for issue in issues:
        existing_title = str(issue.get("title") or "")
        existing_body = str(issue.get("body") or "")
        if fingerprint(existing_title) == marker or f"claude-env-fingerprint:{marker}" in existing_body:
            print(f"EXISTS: {issue.get('url')} (no new issue created)")
            return 0

    # Use GitHub CLI body-file to avoid shell expansion and quoting problems.
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".md", delete=False) as tmp:
        tmp.write(body)
        name = tmp.name
    try:
        url = gh("issue", "create", "--repo", args.repo, "--title", title,
                 "--body-file", name)
    finally:
        Path(name).unlink(missing_ok=True)
    print(f"PUBLISHED: {url}")
    append_jsonl("published.jsonl", {"at": now(), "repo": args.repo, "marker": marker, "url": url})
    return 0


def read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    result = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            try:
                entry = json.loads(line)
                if isinstance(entry, dict):
                    result.append(entry)
            except json.JSONDecodeError:
                pass
    return result


def cmd_summary(args: argparse.Namespace) -> int:
    tasks = read_jsonl(LOCAL / "tasks.jsonl")
    fb = read_jsonl(LOCAL / "feedback.jsonl")
    events = read_jsonl(LOCAL / "events.jsonl")
    completed = [x for x in tasks if x.get("status") == "complete"]
    failed = [x for x in tasks if x.get("status") == "failed"]
    regressions = [x for x in tasks if x.get("regression") is True]
    with_tests = [x for x in tasks if x.get("test_status") in ("passed", "failed")]
    print(json.dumps({
        "tasks_recorded": len(tasks), "completed_records": len(completed),
        "failed_records": len(failed), "regressions_reported": len(regressions),
        "tests_observed": len(with_tests), "explicit_feedback": len(fb),
        "observed_tool_failures_not_confirmed_bugs": sum(x.get("event") == "tool_failure" for x in events),
        "caveat": "Only explicitly recorded tasks and local hook events; not complete billing or all project activity."
    }, indent=2))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Local Claude development feedback + issue reporter")
    sub = parser.add_subparsers(dest="cmd", required=True)
    h = sub.add_parser("hook", help="Claude Code hook handler (no network)")
    h.add_argument("kind", choices=["guard", "failure", "stop"])
    h.set_defaults(fn=cmd_hook)
    r = sub.add_parser("route", help="Predictable task routing suggestion")
    r.add_argument("--size", required=True, choices=["small", "medium", "large"])
    r.add_argument("--risk", required=True, choices=["low", "medium", "high"])
    r.add_argument("--independent", action="store_true")
    r.add_argument("--coupled", action="store_true")
    r.add_argument("--research", action="store_true")
    r.set_defaults(fn=cmd_route)
    f = sub.add_parser("feedback", help="Record explicit feedback locally")
    f.add_argument("--task-id", required=True)
    f.add_argument("--rating", required=True, choices=["good", "mixed", "needs-fix"])
    f.add_argument("--comment", required=True)
    f.add_argument("--model", default="unknown")
    f.add_argument("--route", default="unknown")
    f.add_argument("--source", choices=["user", "test", "review"], default="user")
    f.set_defaults(fn=cmd_feedback)
    t = sub.add_parser("task", help="Record observed task outcome locally")
    t.add_argument("--task-id", required=True)
    t.add_argument("--size", required=True, choices=["small", "medium", "large"])
    t.add_argument("--route", required=True, choices=["direct", "delegated_build", "delegated_research", "opus_specialist"])
    t.add_argument("--model", required=True)
    t.add_argument("--status", required=True, choices=["complete", "partial", "failed"])
    t.add_argument("--tests", default="not-run", choices=["passed", "failed", "not-run"])
    t.add_argument("--regression", action="store_true")
    t.add_argument("--retries", type=int, default=0)
    t.add_argument("--duration-minutes", type=float)
    t.add_argument("--usd-estimate", type=float)
    t.add_argument("--estimate-source", default="")
    t.set_defaults(fn=cmd_task)
    i = sub.add_parser("issue", help="Draft or publish confirmed bug reports")
    issub = i.add_subparsers(dest="issue_cmd", required=True)
    d = issub.add_parser("draft", help="Create LOCAL draft from a JSON report")
    d.add_argument("--from-json", required=True)
    d.add_argument("--replace-local", action="store_true", help="Replace a previously drafted local report after review")
    d.set_defaults(fn=cmd_draft)
    p = issub.add_parser("publish", help="Publish reviewed draft to GitHub")
    p.add_argument("--file", required=True)
    p.add_argument("--repo", required=True)
    p.add_argument("--confirm", default="")
    p.add_argument("--allow-public", action="store_true")
    p.add_argument("--auto", action="store_true")
    p.set_defaults(fn=cmd_publish)
    s = sub.add_parser("summary", help="Summarize recorded feedback (not billing statistics)")
    s.set_defaults(fn=cmd_summary)
    args = parser.parse_args()
    try:
        return args.fn(args)
    except (ValueError, RuntimeError, OSError, subprocess.TimeoutExpired) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
