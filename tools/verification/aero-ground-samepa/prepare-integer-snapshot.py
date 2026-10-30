"""Rebuild a declared green source tree; never copy the live edited src tree."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import zipfile


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def target(root: Path, name: str) -> Path:
    parts = PurePosixPath(name)
    if parts.is_absolute() or not parts.parts or any(p in ("..", ".") or ":" in p or "\\" in p for p in parts.parts):
        raise ValueError("unsafe snapshot entry: " + name)
    value = root.joinpath(*parts.parts).resolve()
    if not value.is_relative_to(root.resolve()):
        raise ValueError("snapshot entry escapes destination: " + name)
    return value


parser = argparse.ArgumentParser()
parser.add_argument("--zip", required=True)
parser.add_argument("--zip-sha256", required=True)
parser.add_argument("--directory", required=True)
parser.add_argument("--helper", required=True)
parser.add_argument("--overlay-store")
parser.add_argument("--overlay-store-sha256")
parser.add_argument("--overlay-test")
parser.add_argument("--overlay-test-sha256")
args = parser.parse_args()
archive_path = Path(args.zip).resolve()
archive_bytes = archive_path.read_bytes()
assert sha(archive_bytes) == args.zip_sha256
root = Path(args.directory).resolve()
root.mkdir(parents=True, exist_ok=False)
base_archive = root / "base-src.zip"
base_commit = subprocess.check_output(["git", "rev-parse", "df61388b"], text=True).strip()
subprocess.run(["git", "archive", "--format=zip", "-o", str(base_archive), base_commit, "--", "src"], check=True)
with zipfile.ZipFile(base_archive) as archive:
    for entry in archive.infolist():
        if entry.is_dir():
            continue
        assert entry.filename.startswith("src/")
        path = target(root, entry.filename)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(archive.read(entry))
with zipfile.ZipFile(archive_path) as archive:
    checksums = json.loads(archive.read("checksums.json"))
    assert checksums["baseCommit"] == base_commit
    verified = []
    overlay = []
    for name, pin in checksums["files"].items():
        data = archive.read(name)
        assert len(data) == pin["bytes"] and sha(data) == pin["sha256"], name
        verified.append(name)
        if name.startswith("source/"):
            local = name[len("source/"):]
            assert not local.endswith((".sqlite", ".db", "-wal", "-shm")), "active DB forbidden"
            path = target(root, local)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
            overlay.append({"path": local, "sha256": sha(data)})
    assert len(overlay) == checksums["sourceFileCount"] == 188
helper = Path(args.helper).resolve()
helper_path = target(root, "tools/verification/aero-ground-samepa/" + helper.name)
assert not helper_path.exists(), "new helper must not replace a green archived entry"
helper_path.parent.mkdir(parents=True, exist_ok=True)
shutil.copyfile(helper, helper_path)
assert helper.read_bytes() == helper_path.read_bytes()
extra_overlay = []
if args.overlay_store:
    store = Path(args.overlay_store).resolve()
    data = store.read_bytes()
    assert sha(data) == args.overlay_store_sha256
    store_target = target(root, "src/host/world/SqliteSamePlateAppearanceLifecycleStore.ts")
    old_hash = sha(store_target.read_bytes())
    store_target.write_bytes(data)
    assert sha(store.read_bytes()) == args.overlay_store_sha256
    extra_overlay.append({"path": str(store_target.relative_to(root)), "sourcePath": str(store),
                          "previousHash": old_hash, "sha256": sha(data), "scope": "single API Store only"})
if args.overlay_test:
    test = Path(args.overlay_test).resolve()
    assert sha(test.read_bytes()) == args.overlay_test_sha256
    test_target = target(root, "verification-inputs/" + test.name)
    test_target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(test, test_target)
    extra_overlay.append({"path": str(test_target.relative_to(root)), "sourcePath": str(test),
                          "sha256": args.overlay_test_sha256, "scope": "previously verified test source only, not executed here"})
assert sha(archive_path.read_bytes()) == args.zip_sha256
receipt = {"status": "PASS_FROZEN_GREEN_SOURCE_BASE_AND_OVERLAY", "sourceRoot": str(root), "baseCommit": base_commit,
           "baseArchiveHash": sha(base_archive.read_bytes()), "zipPath": str(archive_path), "zipHash": args.zip_sha256,
           "verifiedEntryCount": len(verified), "overlay": overlay, "sourceOverlayCount": len(overlay),
           "liveSrcCopied": bool(args.overlay_store), "liveSrcTreeCopied": False,
           "helperPath": str(helper), "helperHash": sha(helper.read_bytes()),
           "helperIsNewReproductionOnly": True, "additionalExplicitOverlay": extra_overlay, "activeDatabasesIncluded": False}
(root / "snapshot-manifest.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({key: value for key, value in receipt.items() if key != "overlay"}, ensure_ascii=False))
