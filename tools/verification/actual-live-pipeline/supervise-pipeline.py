"""One scheduled heavy process, with explicit budgets and durable partial evidence."""
from pathlib import Path
import fcntl
import hashlib
import json
import os
import signal
import subprocess
import sys
import time


def sha256(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def write_new(path, value):
    with Path(path).open('x') as f:
        json.dump(value, f, indent=2)
        f.write('\n')
        f.flush()
        os.fsync(f.fileno())


def sealed_main_hash(path, expected):
    assert sha256(path) == expected, f'closed database hash differs: {path}'
    wal = Path(str(path) + '-wal')
    assert not wal.exists() or wal.stat().st_size == 0, f'nonempty WAL: {path}'


def audit_inputs_and_receipts():
    assert sha256(config_path) == config_hash, 'configuration changed'
    assert sha256(c['sourceManifestPath']) == c['sourceManifestSha256'], 'source manifest changed'
    manifest = json.loads(Path(c['sourceManifestPath']).read_text())
    assert manifest['sourceRoot'] == str(source_root) and manifest['sourceCommit'] == c['sourceCommit']
    assert subprocess.check_output(['git', '-C', str(source_root), 'rev-parse', 'HEAD'], text=True).strip() == c['sourceCommit']
    tracked = subprocess.check_output(['git', '-C', str(source_root), 'ls-files', '-z']).decode().split('\0')
    actual_names = set(filter(None, tracked)) | {str(path.relative_to(source_root)) for path in (source_root / 'src').rglob('*') if path.is_file()}
    assert actual_names == {entry['path'] for entry in manifest['files']}, 'Source file set changed'
    for entry in manifest['files']:
        relative = Path(entry['path'])
        assert not relative.is_absolute() and '..' not in relative.parts
        assert sha256(source_root / relative) == entry['sha256'], f'Source changed: {relative}'
    sealed_main_hash(c['physicalArtifactPath'], c['physicalArtifactSha256'])
    assert sha256(c['physicalEvidencePath']) == c['physicalEvidenceSha256'], 'physical producer report changed'
    sealed = []
    events = run_directory / 'phases.jsonl'
    if events.exists():
        for line in events.read_text().splitlines():
            try:
                event = json.loads(line)
            except ValueError:
                continue
            record = event.get('details', {}).get('receipt') if isinstance(event, dict) else None
            if not record:
                continue
            path = Path(record['path'])
            assert path.parent == run_directory and path.name.endswith('.receipt.json')
            assert sha256(path) == record['sha256'], 'passed-stage receipt changed'
            receipt = json.loads(path.read_text())
            assert receipt['schema'] == 'actual_artifact_stage_receipt_v1' and receipt['status'] == 'passed'
            assert receipt['sourceIdentity']['sourceCommit'] == c['sourceCommit']
            assert receipt['sourceIdentity']['sourceManifestSha256'] == c['sourceManifestSha256']
            assert receipt['originalPhysicalArtifactSha256'] == c['physicalArtifactSha256']
            assert receipt['physicalEndSourceId'] == c['physicalEndSourceId']
            sealed_main_hash(receipt['input']['path'], receipt['input']['sha256'])
            sealed_main_hash(receipt['output']['path'], receipt['output']['sha256'])
            sealed.append(record)
    return {'passed': True, 'preservedPhaseReceipts': sealed}


def process_group_rss(pgid):
    members = []
    for directory in Path('/proc').iterdir():
        if not directory.name.isdigit():
            continue
        try:
            fields = (directory / 'stat').read_text().rsplit(') ', 1)[1].split()
            if int(fields[2]) != pgid or fields[0] == 'Z':
                continue
            lines = (directory / 'status').read_text().splitlines()
            rss = next((int(line.split()[1]) for line in lines if line.startswith('VmRSS:')), 0)
            members.append({'pid': int(directory.name), 'rssKiB': rss})
        except (OSError, ValueError, IndexError):
            continue
    return members


def stop_group(child):
    if child.poll() is not None and not process_group_rss(child.pid):
        return
    try:
        os.killpg(child.pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    try:
        child.wait(timeout=5)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(child.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        child.wait()
    deadline = time.monotonic() + 5
    while process_group_rss(child.pid) and time.monotonic() < deadline:
        time.sleep(0.05)
    if process_group_rss(child.pid):
        try:
            os.killpg(child.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass


config_path = Path(sys.argv[1]).resolve(strict=True)
config_hash = sha256(config_path)
c = json.loads(config_path.read_text())
assert c['schema'] == 'actual_artifact_pipeline_run_v2'
wrapper_root = Path(__file__).resolve().parent
source_root = Path(c['sourceRoot']).resolve(strict=True)
assert wrapper_root == source_root / 'tools/verification/actual-live-pipeline'
native_locks = []
for fd, path in [(8, '/workspace/shared/baseball-native-aux-check.lock'), (9, '/workspace/shared/baseball-native-check.lock')]:
    assert os.readlink(f'/proc/self/fd/{fd}') == path, 'expected inherited Native lock descriptor'
    actual, named = os.fstat(fd), os.stat(path)
    assert (actual.st_dev, actual.st_ino) == (named.st_dev, named.st_ino), 'Native lock file identity differs'
    fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    native_locks.append({'fd': fd, 'path': path, 'device': actual.st_dev, 'inode': actual.st_ino})
runtime = c['runtime']
for key in ['oldSpaceMiB', 'expectedHeapLimitMiB', 'maximumRssMiB', 'maximumWallSeconds', 'minimumAvailableMiB']:
    assert isinstance(runtime[key], int) and not isinstance(runtime[key], bool) and runtime[key] > 0, key
assert runtime['maximumRssMiB'] >= runtime['expectedHeapLimitMiB']
available_kib = int(next(line.split()[1] for line in Path('/proc/meminfo').read_text().splitlines() if line.startswith('MemAvailable:')))
if available_kib < runtime['minimumAvailableMiB'] * 1024:
    print('Deferred: available memory is below the explicit launch reserve', file=sys.stderr)
    sys.exit(75)
run_directory = Path(c['runDirectory'])
assert run_directory.is_absolute()
runtime_directory = Path(str(run_directory) + '.runtime')
assert not run_directory.exists() and not runtime_directory.exists(), 'fresh directories required'
node = Path(runtime['nodePath']).resolve(strict=True)
assert sha256(node) == runtime['nodeSha256'], 'Node runtime differs'
vite_cli = source_root / 'node_modules/vite-node/vite-node.mjs'
assert sha256(vite_cli) == runtime['viteNodeCliSha256'], 'vite-node entry differs'
runtime_directory.mkdir(parents=True)
(runtime_directory / 'tmp').mkdir()
(runtime_directory / 'cache').mkdir()
env = dict(os.environ)
env.update({
    'NODE_OPTIONS': f'--max-old-space-size={runtime["oldSpaceMiB"]} --require={json.dumps(str(wrapper_root / "runtime-probe.cjs"))}',
    'BASEBALL_PIPELINE_OLD_SPACE_MIB': str(runtime['oldSpaceMiB']),
    'BASEBALL_PIPELINE_EXPECTED_HEAP_MIB': str(runtime['expectedHeapLimitMiB']),
    'BASEBALL_PIPELINE_RUNTIME_LOG': str(runtime_directory / 'process-runtime.jsonl'),
    'BASEBALL_PIPELINE_CONFIG_SHA256': config_hash,
    'TMPDIR': str(runtime_directory / 'tmp'),
    'ACTUAL_PIPELINE_CACHE_DIR': str(runtime_directory / 'cache'),
    'OWNED_TIMINGS': '1',
    'OWNED_SCHEDULED_TIMING_PATH': str(runtime_directory / 'owned-phases.jsonl'),
})
args = [str(node), str(vite_cli), '--root', str(source_root), '--config', str(wrapper_root / 'vite.config.mjs'),
        str(wrapper_root / 'pipeline.mjs'), '--run', str(config_path)]
write_new(runtime_directory / 'launch.json', {'configSha256': config_hash, 'runtime': runtime, 'argv': args,
    'inheritedNodeOptions': env['NODE_OPTIONS'], 'nativeLocks': native_locks, 'sourceCommit': c['sourceCommit']})
child = None
guard = None
peak_rss_kib = 0
started = time.monotonic()


def interrupted(signum, _frame):
    raise InterruptedError(f'launcher received signal {signum}')


signal.signal(signal.SIGTERM, interrupted)
signal.signal(signal.SIGINT, interrupted)
try:
    with (runtime_directory / 'output.log').open('x') as log, (runtime_directory / 'resources.jsonl').open('x') as telemetry:
        child = subprocess.Popen(args, cwd=source_root, env=env, stdout=log, stderr=subprocess.STDOUT,
                                 start_new_session=True, pass_fds=(8, 9))
        write_new(runtime_directory / 'pid.json', {'pid': child.pid, 'processGroup': child.pid})
        while child.poll() is None:
            elapsed = time.monotonic() - started
            members = process_group_rss(child.pid)
            rss = sum(member['rssKiB'] for member in members)
            peak_rss_kib = max(peak_rss_kib, rss)
            telemetry.write(json.dumps({'elapsedSeconds': elapsed, 'rssKiB': rss, 'members': members}) + '\n')
            telemetry.flush()
            if elapsed > runtime['maximumWallSeconds'] or rss > runtime['maximumRssMiB'] * 1024:
                guard = {'reason': 'wall' if elapsed > runtime['maximumWallSeconds'] else 'rss', 'elapsedSeconds': elapsed, 'rssKiB': rss}
                stop_group(child)
                break
            time.sleep(0.5)
        exit_code = child.wait()
except BaseException as error:
    guard = {'reason': 'supervisor', 'error': repr(error)}
    if child is not None:
        stop_group(child)
    exit_code = child.returncode if child is not None else None
finally:
    if child is not None:
        stop_group(child)

terminal = None
worker = None
try:
    terminal = json.loads((run_directory / 'terminal.json').read_text())
except (OSError, ValueError):
    pass
try:
    worker = json.loads((runtime_directory / 'executing-process.json').read_text())
except (OSError, ValueError):
    pass
worker_valid = child is not None and isinstance(worker, dict) and worker.get('pid') == child.pid and worker.get('heapLimitMiB') == runtime['expectedHeapLimitMiB'] and worker.get('nativeLocks') == native_locks
try:
    audit = audit_inputs_and_receipts()
except BaseException as error:
    audit = {'passed': False, 'error': repr(error)}
remaining_processes = process_group_rss(child.pid) if child is not None else []
passed = exit_code == 0 and guard is None and worker_valid and audit['passed'] and not remaining_processes and isinstance(terminal, dict) and terminal.get('status') == 'passed'
write_new(runtime_directory / 'process-terminal.json', {'status': 'passed' if passed else 'failed', 'exitCode': exit_code,
    'guard': guard, 'elapsedSeconds': time.monotonic() - started, 'sampledPeakProcessGroupRssKiB': peak_rss_kib,
    'executingProcessReceiptValid': worker_valid, 'sourceInputAndReceiptAudit': audit,
    'remainingOwnedProcesses': remaining_processes,
    'pipelineTerminalStatus': terminal.get('status') if isinstance(terminal, dict) else 'absent',
    'preservedPhaseReceipts': [str(path) for path in sorted(run_directory.glob('*.receipt.json'))] if run_directory.exists() else []})
sys.exit(0 if passed else 1)
