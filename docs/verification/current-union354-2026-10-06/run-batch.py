"""HELD source-only adaptation: one coordinator-selected cumulative batch per invocation.
No old receipts are imported. A later invocation reauthenticates this directory's receipts.
"""
import sys
if not sys.flags.isolated: raise SystemExit('controller must be launched with Python -I before control imports')
import collections, contextlib, ctypes, datetime, fcntl, hashlib, json, os, pathlib, re, signal, subprocess, time
if not __debug__: raise SystemExit('optimized Python is forbidden')
if len(sys.argv) != 9 or sys.argv[1] != '--coordinator-slot-granted' or sys.argv[3] != '--controller-sha256' or sys.argv[5] != '--config-sha256' or sys.argv[7] != '--previous-ledger-sha256':
    raise SystemExit('one reviewed batch, controller/config hashes and a caller-captured predecessor ledger hash (or none) required')
base = pathlib.Path(__file__).resolve().parent
batch_id = sys.argv[2]
def sha(path):
    digest = hashlib.sha256()
    with pathlib.Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''): digest.update(chunk)
    return digest.hexdigest()
def read(path): return json.loads(pathlib.Path(path).read_text())
def pinned_bytes(path, expected):
    data = pathlib.Path(path).read_bytes()
    assert re.fullmatch('[a-f0-9]{64}', expected) and hashlib.sha256(data).hexdigest() == expected, 'approved input bytes differ'
    return data
def pinned_json(path, expected): return json.loads(pinned_bytes(path, expected))
assert sha(__file__) == sys.argv[4]
cfg = pinned_json(base / 'cumulative.config.json', sys.argv[6])
assert cfg['status'] == 'RELEASED', 'HELD: final freeze, collection, budgets and independent review are required'
assert cfg['inheritedHistoricalReceipts'] == [], 'lost or other-source receipts cannot be imported'
cwd = pathlib.Path(cfg['cwd']); deps = pathlib.Path(cfg['dependencies']); node = pathlib.Path(cfg['node'])
source_path = base / cfg['sourceManifest']; dep_path = base / cfg['dependencyManifest']; inventory_path = base / cfg['inventory']
prepared_source = pinned_bytes(source_path, cfg['sourceManifestSha256']).decode()
prepared_deps = pinned_json(dep_path, cfg['dependencyManifestSha256'])
inventory = pinned_json(inventory_path, cfg['inventorySha256'])
assert inventory['sourceCommit'] == cfg['sourceCommit'] and inventory['srcTree'] == cfg['sourceTree'] and inventory['tree'] == cfg['tree']
assert inventory['referenceOnlyNotFinalFreeze'] is False
assert cfg['nodeVersion'] == '26.10.0' and cfg['minimumLaunchReserveGiB'] == 7
assert isinstance(cfg['overallWallSeconds'], int) and 0 < cfg['overallWallSeconds'] < 7 * 86400
assert cfg['processHelperSha256'] == '17c73eb414b32f9f1616b5e4e58ac1077a0449dd5b6887c0291369b73ce9ca9f'
assert sha(base / 'process-identity-reviewed.fragment.py') == cfg['processHelperSha256']
stages = cfg['stages']; stage_by_id = {s['id']: s for s in stages}; batches = cfg['batches']; batch_by_id = {b['id']: b for b in batches}
assert len(stages) == len(stage_by_id) and len(batches) == len(batch_by_id) and batch_id in batch_by_id
assert all(re.fullmatch(r'[a-z0-9_-]+', s['id']) for s in stages + batches)
assert [sid for b in batches for sid in b['stageIds']] == [s['id'] for s in stages], 'batches must partition the exact ordered selection once'
assert all(b['stageIds'] and isinstance(b['wallSeconds'], int) and 0 < b['wallSeconds'] <= cfg['overallWallSeconds'] for b in batches)
assert [(s['kind'], s.get('file')) for s in stages[:2]] == [('catalog', None), ('compiler', None)]
expected = {'src': [r['file'] for r in inventory['srcFiles']], 'node': [r['file'] for r in inventory['nodeFiles']], 'python': [r['file'] for r in inventory['pythonFiles']]}
assert len(expected['node']) == 15 and len(expected['python']) == 5
for kind in expected: assert sorted(s['file'] for s in stages if s['kind'] == kind) == sorted(expected[kind])
tracked = subprocess.check_output(['git', 'ls-files', '-z'], cwd=cwd).decode().split('\0')
assert sorted(p for p in tracked if p.startswith('src/') and re.search(r'\.(test|spec)\.[cm]?[jt]sx?$', p)) == sorted(expected['src'])
assert sorted(p for p in tracked if p.endswith('.test.mjs')) == sorted(expected['node'])
assert sorted(p for p in tracked if p.endswith('.test.py')) == sorted(expected['python'])
assert sorted(str(p.relative_to(cwd)) for p in (cwd / 'src').rglob('*') if p.is_file() and re.search(r'\.(test|spec)\.[cm]?[jt]sx?$', str(p))) == sorted(expected['src'])
case_inventory = {r['file']: r['expectedCases'] for key in ['srcFiles', 'nodeFiles', 'pythonFiles'] for r in inventory[key]}
assert len(stages) == 2 + sum(map(len, expected.values()))
assert stages[-1]['file'] == 'src/host/world/ActualFirstBasePlayEndPositive.test.ts'
assert stages[-2]['file'] == 'src/host/world/OwnedScheduledMotionIntegrity.test.ts'
assert batches[-1]['stageIds'] == [stages[-1]['id']] and batches[-2]['stageIds'] == [stages[-2]['id']]
optional = collections.defaultdict(list)
for case in inventory['optionalArtifactCases']: optional[case['file']].append(case['fullName'])
assert len(optional) == 7 and sum(map(len, optional.values())) == 9
for s in stages:
    assert isinstance(s['wallSeconds'], int) and 0 < s['wallSeconds'] <= cfg['overallWallSeconds']
    allowed = (1408, 1504, 2048) if s['kind'] == 'compiler' else (1024, 1120, 1536) if s['kind'] == 'src' else (192, 288, 384)
    assert tuple(s[k] for k in ['oldSpaceMiB', 'heapMiB', 'rssMiB']) == allowed
    assert s['stopReserveGiB'] in (5, 6) and (s['kind'] == 'compiler' or s['stopReserveGiB'] == 6)
    if s['kind'] in expected:
        assert isinstance(s['caseNames'], list) and s['caseNames'] and all(isinstance(n, str) and n for n in s['caseNames'])
        assert s['caseNames'] == case_inventory[s['file']], 'selection differs from independently reviewed collection'
        assert s['expectedSkippedNames'] == (sorted(optional.get(s['file'], [])) if s['kind'] == 'src' else [])
        if s['file'] in optional: assert sorted(s['caseNames']) == sorted(optional[s['file']])
required_tools = [node, pathlib.Path(sys.executable).resolve(), base / 'runtime-probe.cjs', base / 'receipt-reporter.mjs', base / 'per-file.vitest.config.mjs', base / 'python-file-loader.py', base / 'process-identity-reviewed.fragment.py']
assert set(map(str, required_tools)) == set(cfg['toolHashes'])
assert all(sha(path) == value for path, value in cfg['toolHashes'].items())
controls = {str(pathlib.Path(__file__).resolve()): sys.argv[4], str(base / 'cumulative.config.json'): sys.argv[6],
    str(source_path): cfg['sourceManifestSha256'], str(dep_path): cfg['dependencyManifestSha256'],
    str(inventory_path): cfg['inventorySha256']}
controls.update(cfg['toolHashes'])
trusted_prior_ledger_hashes = {}
def source_manifest():
    names = set(subprocess.check_output(['git', 'ls-files', '-z'], cwd=cwd).decode().split('\0')) - {''}
    for folder in ['src', 'docs', 'tools']:
        directory = cwd / folder
        assert not directory.is_symlink(), 'source/import root must not be a symlink'
        entries = list(directory.rglob('*'))
        assert not any(p.is_symlink() for p in entries), 'source/import symlinks are outside the immutable file inventory'
        names |= {str(p.relative_to(cwd)) for p in entries if p.is_file()}
    return ''.join(sha(cwd / n) + '  ' + n + '\n' for n in sorted(names))
def dependency_manifest():
    assert not deps.is_symlink(), 'declared dependency root must be concrete; only the pinned checkout alias is allowed'
    entries = sorted(deps.rglob('*'))
    links = {}
    for path in entries:
        if path.is_symlink():
            relative = str(path.relative_to(deps))
            assert relative in cfg['dependencyBinLinks'] and path.is_file() and not path.is_dir(), 'unreviewed dependency link'
            assert path.resolve(strict=True).is_relative_to(deps.resolve(strict=True)), 'dependency bin target escaped'
            links[relative] = os.readlink(path)
    assert links == cfg['dependencyBinLinks'], 'dependency bin links changed'
    assert {str(path.relative_to(deps)) for path in (deps / '.bin').iterdir()} == set(cfg['dependencyBinLinks']), 'unreviewed bin entry'
    return {str(p.relative_to(deps)): sha(p) for p in entries if p.is_file() and not {'.vite', '.cache', '.bin'}.intersection(p.relative_to(deps).parts)}
def reject_workspace_autodiscovery(directory):
    # Exact installed Vitest 2.1.9 workspacesFiles: both prefixes and all seven extensions.
    names = {prefix + extension for prefix in ['vitest.workspace', 'vitest.projects']
             for extension in ['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs', '.json']}
    found = sorted(p.name for p in pathlib.Path(directory).iterdir() if p.name in names)
    assert not found, 'unpinned Vitest workspace autodiscovery: ' + repr(found)

def unchanged():
    reject_workspace_autodiscovery(base)
    return (subprocess.check_output(['git', 'rev-parse', 'HEAD', 'HEAD:src', 'HEAD^{tree}'], cwd=cwd, text=True).splitlines() == [cfg['sourceCommit'], cfg['sourceTree'], cfg['tree']]
        and (cwd / 'node_modules').resolve(strict=True) == deps.resolve(strict=True) and source_manifest() == prepared_source
        and dependency_manifest() == prepared_deps and all(sha(p) == h for p, h in controls.items())
        and all(sha(p) == h for p, h in trusted_prior_ledger_hashes.items()))
def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def mem(): return next(int(l.split()[1]) for l in pathlib.Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:'))
def rss_self(): return next(int(l.split()[1]) for l in pathlib.Path('/proc/self/status').read_text().splitlines() if l.startswith('VmRSS:'))
def write(path, value):
    with pathlib.Path(path).open('x') as stream:
        json.dump(value, stream, indent=2); stream.write('\n'); stream.flush(); os.fsync(stream.fileno())
def census():
    rows = {}
    for path in pathlib.Path('/proc').iterdir():
        if not path.name.isdigit(): continue
        try:
            fields = (path / 'stat').read_text().rsplit(') ', 1)[1].split()
            status = dict(line.split(':', 1) for line in (path / 'status').read_text().splitlines() if ':' in line)
            rows[int(path.name)] = dict(pid=int(path.name), ppid=int(fields[1]), processGroup=int(fields[2]),
                                       startTime=int(fields[19]), state=fields[0], rssKiB=int(status.get('VmRSS', '0 kB').split()[0]))
        except (FileNotFoundError, ProcessLookupError, ValueError, IndexError): pass
    return rows
def members(child, known):
    rows = census()
    owned = {pid for pid, started in known['generations'] if pid in rows and rows[pid]['startTime'] == started}
    root_identity = known['root']
    root_current = root_identity is not None and root_identity[0] in rows and rows[root_identity[0]]['startTime'] == root_identity[1]
    for pid, row in rows.items():
        if (root_current and row['processGroup'] == root_identity[0]) or row['ppid'] == os.getpid(): owned.add(pid)
    while True:
        expanded = owned | {pid for pid, row in rows.items() if row['ppid'] in owned}
        if expanded == owned: break
        owned = expanded
    known['generations'].update((pid, rows[pid]['startTime']) for pid in owned)
    return [rows[pid] for pid in sorted(owned)]
def signal_owned(pid, expected_start, sig):
    current = census().get(pid)
    if current is None or current['startTime'] != expected_start or current['state'] == 'Z': return
    descriptor = None
    try:
        descriptor = os.pidfd_open(pid)
        current = census().get(pid)
        if current is None or current['startTime'] != expected_start or current['state'] == 'Z': return
        signal.pidfd_send_signal(descriptor, sig)
    except ProcessLookupError: pass
    finally:
        if descriptor is not None: os.close(descriptor)
def stop(child, known):
    child.poll()
    for sig, grace in [(signal.SIGTERM, 3), (signal.SIGKILL, 3)]:
        for row in members(child, known):
            if row['state'] == 'Z': continue
            signal_owned(row['pid'], row['startTime'], sig)
        deadline = time.monotonic() + grace
        while time.monotonic() < deadline:
            child.poll()
            for row in members(child, known):
                if (row['pid'], row['startTime']) == known['root']: continue
                try: os.waitpid(row['pid'], os.WNOHANG)
                except ChildProcessError: pass
            if not members(child, known): break
            time.sleep(.025)
        if not members(child, known): break
    child.wait(timeout=1)

# Keep each stage history keyed by its Popen object, not its recyclable numeric PID.
# Immediately after Popen and before the first poll/census cleanup:
# children.append(child); knowns[child] = {'root': None, 'generations': set()}; receipt['childPid'] = child.pid
# initial = census().get(child.pid)
# assert initial is not None and initial['ppid'] == os.getpid() and initial['processGroup'] == child.pid, 'cannot pin initial owned root identity'
# knowns[child]['root'] = (child.pid, initial['startTime']); knowns[child]['generations'].add(knowns[child]['root'])
# receipt['rootStartTime'] = initial['startTime']

def assert_clean_vitest_close(text):
    text = re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]', '', text)
    markers = ['error during close', 'close timed out after', 'Tests closed successfully but something prevents']
    assert not any(marker in text for marker in markers), 'Vitest shutdown did not complete cleanly'

def outcome(spec, directory, code):
    """Only complete ordinary assertion failures are continuation eligible."""
    if spec['kind'] in ('catalog', 'compiler'):
        assert code == 0, 'prerequisite failed'
        return 'passed', {}, []
    names = spec['caseNames']; expected_skips = spec['expectedSkippedNames']
    if spec['kind'] == 'src':
        assert_clean_vitest_close((directory / 'output.log').read_text())
        raw = read(directory / 'results.json'); detail = read(directory / 'evidence.json'); collected = read(directory / 'collection.json')
        assert detail['unhandled'] == [] and len(raw['testResults']) == 1
        suite = raw['testResults'][0]
        assert pathlib.Path(suite['name']).resolve() == cwd / spec['file'] and not suite['message']
        cases = suite['assertionResults']; evidence = detail['cases']
        assert collections.Counter(c['fullName'] for c in cases) == collections.Counter(names)
        for rows in (evidence, collected['cases']):
            assert collections.Counter(c['fullName'] for c in rows) == collections.Counter(names)
            assert all(pathlib.Path(c['file']).resolve() == cwd / spec['file'] for c in rows)
        assert all(not c['errors'] and all(v == 'pass' for v in c['hooks'].values()) for c in detail['containers'])
        assert all(all(v == 'pass' for v in c['hooks'].values()) for c in evidence), 'every observed hook must have terminal successful evidence'
        assert len(evidence) == len(cases)
        for case, ev in zip(cases, evidence):
            assert case['fullName'] == ev['fullName'] and case['ancestorTitles'] == ev['ancestorTitles'] and case['title'] == ev['title']
            expected_state = {'passed': 'pass', 'failed': 'fail', 'skipped': 'skip'}.get(case['status'])
            assert expected_state is not None
            assert ev['state'] == expected_state or (expected_state == 'skip' and ev['mode'] == 'skip' and ev['state'] is None)
            assert (case['status'] == 'skipped') == (case['fullName'] in expected_skips)
            if case['status'] == 'failed':
                assert ev['errors'] and all(e['name'] == 'AssertionError' for e in ev['errors']), 'unclassified exception stops coverage'
                assert case['failureMessages']
            else: assert ev['errors'] == [] and not case['failureMessages']
        counts = {k: raw[k] for k in ['numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests', 'numTodoTests']}
        n_pass = sum(c['status'] == 'passed' for c in cases); n_fail = sum(c['status'] == 'failed' for c in cases)
        assert counts == dict(numTotalTests=len(names), numPassedTests=n_pass, numFailedTests=n_fail, numPendingTests=len(expected_skips), numTodoTests=0)
        assert code == (1 if n_fail else 0) and raw['success'] is (not n_fail)
        return ('assertion_failure_complete' if n_fail else 'passed'), counts, [{'name': c['fullName'], 'status': c['status']} for c in cases]
    if spec['kind'] == 'node':
        text = (directory / 'output.log').read_text()
        totals = {key: int(values[-1]) for key in ['tests', 'pass', 'fail', 'skipped', 'cancelled', 'todo'] if (values := re.findall(r'^# ' + key + r' (\d+)$', text, re.M))}
        labels = re.findall(r'^ok \d+ - (.*)$', text, re.M)
        assert code == 0 and totals == {'tests': len(names), 'pass': len(names), 'fail': 0, 'skipped': 0, 'cancelled': 0, 'todo': 0}
        assert collections.Counter(labels) == collections.Counter(names), 'unexpected Node TAP labels'
        assert len(re.findall(r'^1\.\.(\d+)$', text, re.M)) == 1 and not re.search(r'^(?:not ok|Bail out!)', text, re.M)
        return 'passed', totals, [{'name': n, 'status': 'passed'} for n in labels]
    assert spec['kind'] == 'python'
    raw = read(directory / 'python.json')
    assert pathlib.Path(raw['file']) == cwd / spec['file'] and pathlib.Path(raw['executable']).resolve() == pathlib.Path(sys.executable).resolve()
    assert code == 0 and raw['successful'] is True and raw['testsRun'] == len(names)
    assert collections.Counter(c['name'] for c in raw['cases']) == collections.Counter(names) and all(c['status'] == 'passed' for c in raw['cases'])
    return 'passed', {'tests': len(names), 'pass': len(names)}, raw['cases']

def validate_receipt(receipt, spec, directory):
    assert receipt['stage'] == spec and receipt['sourceCommit'] == cfg['sourceCommit'] and receipt['controlHashes'] == controls
    assert receipt['coverageComplete'] and receipt['sourceDependenciesControlsUnchanged'] and receipt['runtimeVerified'] and receipt['reaped'] and not receipt['remainingOwnedProcesses']
    assert receipt['stopReason'] is None and receipt['failure'] is None and receipt['cancellationSignal'] is None
    assert receipt['seconds'] <= spec['wallSeconds'] and receipt['peakAggregateRssKiB'] <= spec['rssMiB'] * 1024
    assert all(sha(directory / p) == value for p, value in receipt['artifacts'].items())
    status, counts, cases = outcome(spec, directory, receipt['exitCode'])
    assert receipt['classification'] == status and receipt['counts'] == counts and receipt['perTest'] == cases
    return receipt


def read_pinned_ledger(path, expected):
    assert isinstance(expected, str) and re.fullmatch('[a-f0-9]{64}', expected)
    payload = pathlib.Path(path).read_bytes()
    assert hashlib.sha256(payload).hexdigest() == expected, 'predecessor differs from the caller-captured hash'
    return json.loads(payload)

def make_compact_ledger(terminal, completed):
    done = {r['stage']['id']: r for r in completed}
    assert len(done) == len(completed)
    locations = {sid: base / 'batches' / b['id'] / sid / 'receipt.json' for b in batches for sid in b['stageIds']}
    return {'schema': 'cumulative_same_source_file_ledger_v2', 'sourceCommit': cfg['sourceCommit'], 'srcTree': cfg['sourceTree'], 'tree': cfg['tree'],
        'sourceManifestSha256': cfg['sourceManifestSha256'], 'dependencyManifestSha256': cfg['dependencyManifestSha256'],
        'controllerSha256': sys.argv[4], 'configurationSha256': sys.argv[6], 'lastBatch': terminal['batchId'],
        'previousLedgerSha256': terminal['previousLedgerSha256'], 'batchComplete': terminal['batchComplete'],
        'wholeDefaultSuitePassed': terminal['wholeDefaultSuitePassed'], 'physicalArtifactCasesExecuted': False,
        'optionalArtifactCases': inventory['optionalArtifactCases'], 'cancellationSignal': terminal['cancellationSignal'],
        'qualificationRequiresMatchingTerminal': True, 'terminalEvidence': terminal,
        'stages': [{'stageId': s['id'], 'kind': s['kind'], 'file': s.get('file'),
            'classification': done[s['id']]['classification'] if s['id'] in done else 'pending',
            'receiptSha256': sha(locations[s['id']]) if s['id'] in done else None,
            'artifactHashes': done[s['id']]['artifacts'] if s['id'] in done else None,
            'counts': done[s['id']]['counts'] if s['id'] in done else None,
            'perTest': done[s['id']]['perTest'] if s['id'] in done else None} for s in stages]}

def commit_final_outputs(ledger_path, ledger, terminal_path, terminal):
    # Acyclic: the ledger owns terminalEvidence; the final terminal owns the ledger digest.
    assert not os.path.lexists(ledger_path) and not os.path.lexists(terminal_path), 'stale final output'
    write(ledger_path, ledger)
    assert read(ledger_path) == ledger, 'ledger persistence/readback differs'
    final = {**terminal, 'ledgerPath': ledger_path.name, 'ledgerSha256': sha(ledger_path)}
    pending = terminal_path.with_name('.terminal.pending.json')
    payload = (json.dumps(final, indent=2) + '\n').encode()
    with pending.open('xb') as stream:
        stream.write(payload); stream.flush(); os.fsync(stream.fileno())
    assert pending.read_bytes() == payload, 'terminal persistence/readback differs'
    # Exclusive atomic publication: any earlier output error leaves no final terminal.
    os.link(pending, terminal_path)
    # Keep the fully persisted pending alias as evidence; no fallible cleanup after publication.

pending_signal = None

def cancelled(signum, _frame):
    global pending_signal
    if pending_signal is None: pending_signal = signum
for sig in (signal.SIGTERM, signal.SIGINT): signal.signal(sig, cancelled)
children = []; knowns = {}; receipts = []; prior_receipts = []; prior_batch_seconds = 0
batch = batch_by_id[batch_id]; batch_index = batches.index(batch); out = base / 'batches' / batch_id
ledger_path = base / ('ledger-' + batch_id + '.json')
assert not os.path.lexists(out) and not os.path.lexists(ledger_path), 'stale batch or ledger output; no automatic retry or receipt overwrite'
assert sys.argv[8] == 'none' if batch_index == 0 else re.fullmatch('[a-f0-9]{64}', sys.argv[8]), 'explicit caller-captured predecessor pin required'
assert hasattr(os, 'pidfd_open') and hasattr(signal, 'pidfd_send_signal')
final_failure = None; final_signal = None; batch_complete = False; whole_passed = False
with contextlib.ExitStack() as stack:
    locks = []
    for name in ['baseball-native-check.lock', 'baseball-native-aux-check.lock', 'baseball-light-check.lock']:
        handle = stack.enter_context(open('/workspace/shared/' + name, 'a')); fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB); locks.append(handle)
    assert pending_signal is None and unchanged() and mem() >= 7 * 1024 * 1024
    assert ctypes.CDLL(None, use_errno=True).prctl(36, 1, 0, 0, 0) == 0
    # Authenticate the latest predecessor before trusting JSON, then follow its pinned chain.
    trusted_hash = None if batch_index == 0 else sys.argv[8]
    for previous in reversed(batches[:batch_index]):
        previous_path = base / ('ledger-' + previous['id'] + '.json')
        ledger = read_pinned_ledger(previous_path, trusted_hash)
        trusted_prior_ledger_hashes[previous_path] = trusted_hash
        trusted_hash = ledger['previousLedgerSha256']
    assert trusted_hash is None, 'predecessor chain does not end at the first batch'
    # Recompute full cumulative accounting from authenticated raw receipts.
    previous_ledger_sha = None
    for previous in batches[:batch_index]:
        previous_dir = base / 'batches' / previous['id']; terminal = read(previous_dir / 'terminal.json')
        previous_ledger_path = base / ('ledger-' + previous['id'] + '.json'); ledger = read_pinned_ledger(previous_ledger_path, trusted_prior_ledger_hashes[previous_ledger_path])
        assert terminal == {**ledger['terminalEvidence'], 'ledgerPath': previous_ledger_path.name, 'ledgerSha256': trusted_prior_ledger_hashes[previous_ledger_path]}
        assert ledger['sourceCommit'] == cfg['sourceCommit'] and ledger['controllerSha256'] == sys.argv[4] and ledger['configurationSha256'] == sys.argv[6]
        assert terminal['previousLedgerSha256'] == previous_ledger_sha
        assert terminal['batchId'] == previous['id'] and terminal['batch'] == previous
        assert terminal['previousCompletedStages'] == len(prior_receipts) and terminal['priorBatchSeconds'] == prior_batch_seconds
        assert terminal['sourceCommit'] == cfg['sourceCommit'] and terminal['controlHashes'] == controls
        assert terminal['batchComplete'] and terminal['fatalFailure'] is None and terminal['cancellationSignal'] is None
        assert terminal['sourceDependenciesControlsUnchanged'] and terminal['reaped'] and not terminal['remainingOwnedProcesses']
        assert terminal['batchSeconds'] <= previous['wallSeconds'] and [r['stageId'] for r in terminal['receipts']] == previous['stageIds']
        for ref in terminal['receipts']:
            path = previous_dir / ref['receiptPath']
            receipt = pinned_json(path, ref['sha256']); spec = stage_by_id[ref['stageId']]
            prior_receipts.append(validate_receipt(receipt, spec, path.parent))
        expected_whole = previous == batches[-1] and len(prior_receipts) == len(stages) and all(r['classification'] == 'passed' for r in prior_receipts)
        assert terminal['wholeDefaultSuitePassed'] is expected_whole
        assert ledger == make_compact_ledger(ledger['terminalEvidence'], prior_receipts), 'compact cumulative accounting changed'
        previous_ledger_sha = trusted_prior_ledger_hashes[previous_ledger_path]
        prior_batch_seconds += terminal['batchSeconds']
    assert prior_batch_seconds < cfg['overallWallSeconds']
    out.mkdir(parents=True)
    started_batch = time.monotonic()
    admission = {'batchId': batch_id, 'sourceCommit': cfg['sourceCommit'], 'srcTree': cfg['sourceTree'], 'tree': cfg['tree'],
        'controlHashes': controls, 'sourceManifestSha256': cfg['sourceManifestSha256'], 'dependencyManifestSha256': cfg['dependencyManifestSha256'], 'previousLedgerSha256': previous_ledger_sha,
        'startedAt': now(), 'previousCompletedStages': len(prior_receipts), 'priorBatchSeconds': prior_batch_seconds,
        'reviewedControllerSha256': sys.argv[4], 'reviewedConfigurationSha256': sys.argv[6], 'batch': batch,
        'locks': [{'path': h.name, 'fd': h.fileno(), 'inode': os.fstat(h.fileno()).st_ino} for h in locks]}
    write(out / 'admission.json', admission)
    try:
        for sid in batch['stageIds']:
            spec = stage_by_id[sid]; directory = out / sid; directory.mkdir(); (directory / 'tmp').mkdir()
            started = time.monotonic(); child = None; code = None; guard = None; failure = None; peak = 0; runtime = []; stable = False; valid_runtime = False
            classification = 'incomplete'; counts = {}; cases = []; last_telemetry = -1
            receipt = {'stage': spec, 'sourceCommit': cfg['sourceCommit'], 'controlHashes': controls, 'startedAt': now()}
            try:
                assert pending_signal is None and unchanged(), 'cancelled or source/dependency/control drift before launch'
                assert mem() >= 7 * 1024 * 1024, '7 GiB launch reserve'
                assert time.monotonic() - started_batch + prior_batch_seconds < cfg['overallWallSeconds']
                assert time.monotonic() - started_batch < batch['wallSeconds']
                env = {k: v for k, v in os.environ.items() if not k.startswith(('BASEBALL_', 'OWNED_', 'VITEST_', 'TINYPOOL_')) and k not in ['NODE_OPTIONS', 'NODE_PATH', 'ESBUILD_BINARY_PATH', 'PYTHONPATH', 'PYTHONHOME', 'PYTHONSTARTUP', 'PYTHONUSERBASE', 'PYTHONINSPECT']}
                env.update(WS_NO_BUFFER_UTIL='1', WS_NO_UTF_8_VALIDATE='1', NODE_OPTIONS=f"--max-old-space-size={spec['oldSpaceMiB']} --require={base / 'runtime-probe.cjs'}",
                    BASEBALL_RUNTIME_LOG=str(directory / 'runtime.jsonl'), BASEBALL_EXPECTED_HEAP=str(spec['heapMiB']), BASEBALL_STAGE=sid,
                    BASEBALL_SELECTED_FILE=spec.get('file', ''), BASEBALL_CACHE_DIR=str(directory / 'tmp' / 'vite-cache'),
                    BASEBALL_COLLECTION_LOG=str(directory / 'collection.json'), BASEBALL_EVIDENCE_LOG=str(directory / 'evidence.json'),
                    BASEBALL_PYTHON_REPORT=str(directory / 'python.json'), TMPDIR=str(directory / 'tmp'), PYTHONDONTWRITEBYTECODE='1')
                if spec['kind'] == 'catalog': command = [str(node), 'tools/catalog/compile-catalog.mjs', '--check']
                elif spec['kind'] == 'compiler': command = [str(node), 'node_modules/typescript/bin/tsc', '--noEmit', '--project', 'tools/verification/actual-live-pipeline/tsconfig.next-input.json']
                elif spec['kind'] == 'src': command = [str(node), 'node_modules/vitest/vitest.mjs', 'run', '--config', str(base / 'per-file.vitest.config.mjs'), '--reporter=verbose', '--reporter=json', '--reporter=' + str(base / 'receipt-reporter.mjs'), '--outputFile=' + str(directory / 'results.json')]
                elif spec['kind'] == 'node': command = [str(node), '--test', '--test-concurrency=1', '--test-reporter=tap', spec['file']]
                else: command = [sys.executable, '-I', '-B', str(base / 'python-file-loader.py'), str(cwd / spec['file'])]
                receipt['command'] = command
                with (directory / 'output.log').open('x') as log, (directory / 'rss.jsonl').open('x') as telemetry:
                    child = subprocess.Popen(command, cwd=cwd, env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True, pass_fds=tuple(h.fileno() for h in locks))
                    children.append(child); knowns[child] = {'root': None, 'generations': set()}; receipt['childPid'] = child.pid
                    initial = census().get(child.pid)
                    assert initial is not None and initial['ppid'] == os.getpid() and initial['processGroup'] == child.pid, 'cannot pin initial owned root identity'
                    knowns[child]['root'] = (child.pid, initial['startTime']); knowns[child]['generations'].add(knowns[child]['root']); receipt['rootStartTime'] = initial['startTime']
                    try:
                        while True:
                            code = child.poll(); processes = members(child, knowns[child]); rss = sum(p['rssKiB'] for p in processes) + rss_self(); peak = max(peak, rss)
                            elapsed = time.monotonic() - started; batch_elapsed = time.monotonic() - started_batch; available = mem()
                            if pending_signal is not None: guard = 'cancelled'
                            elif elapsed > spec['wallSeconds']: guard = 'file_wall_cap'
                            elif batch_elapsed > batch['wallSeconds']: guard = 'batch_wall_cap'
                            elif batch_elapsed + prior_batch_seconds > cfg['overallWallSeconds']: guard = 'overall_wall_cap'
                            elif rss > spec['rssMiB'] * 1024: guard = 'rss_cap'
                            elif available < spec['stopReserveGiB'] * 1024 * 1024: guard = 'memory_reserve'
                            if elapsed - last_telemetry >= 1 or guard is not None or code is not None:
                                telemetry.write(json.dumps({'seconds': elapsed, 'aggregateRssKiB': rss, 'peakAggregateRssKiB': peak, 'memAvailableKiB': available, 'processes': processes}) + '\n'); telemetry.flush(); last_telemetry = elapsed
                            if guard is not None: break
                            if code is not None:
                                if any(p['state'] != 'Z' for p in processes): guard = 'owned_descendants_survived_stage'
                                break
                            time.sleep(.025)
                    finally: stop(child, knowns[child])
            except BaseException as error: failure = type(error).__name__ + ': ' + str(error)
            finally:
                if child is not None:
                    try: stop(child, knowns[child])
                    except BaseException as error: failure = (failure + '; ' if failure else '') + 'cleanup: ' + str(error)
                remaining = [p for c in children for p in members(c, knowns[c])]
                try:
                    stable = unchanged()
                    if spec['kind'] == 'python':
                        proof = read(directory / 'python.json'); valid_runtime = child is not None and proof['pid'] == child.pid and pathlib.Path(proof['executable']).resolve() == pathlib.Path(sys.executable).resolve()
                    else:
                        runtime = [json.loads(line) for line in (directory / 'runtime.jsonl').read_text().splitlines() if line]
                        valid_runtime = bool(runtime) and all(r['nodeVersion'] == '26.10.0' and r['heapLimitMiB'] == spec['heapMiB'] and r['stage'] == sid and r['nodePathAbsent'] and r['optionalWsExtensionsDisabled'] for r in runtime)
                        valid_runtime = valid_runtime and child is not None and any(r['pid'] == child.pid and not r['worker'] for r in runtime)
                        if spec['kind'] == 'src': valid_runtime = valid_runtime and any(r['worker'] is True and r['pid'] != child.pid for r in runtime)
                        if spec['kind'] == 'node': valid_runtime = valid_runtime and len({r['pid'] for r in runtime}) >= 2
                    classification, counts, cases = outcome(spec, directory, child.returncode if child else None)
                except BaseException as error: failure = (failure + '; ' if failure else '') + 'evidence: ' + type(error).__name__ + ': ' + str(error)
                elapsed = time.monotonic() - started; stage_signal = pending_signal
                if elapsed > spec['wallSeconds'] and guard is None: guard = 'file_wall_cap'
                if time.monotonic() - started_batch > batch['wallSeconds'] and guard is None: guard = 'batch_wall_cap'
                if time.monotonic() - started_batch + prior_batch_seconds > cfg['overallWallSeconds'] and guard is None: guard = 'overall_wall_cap'
                if stage_signal is not None: guard = 'cancelled'
                complete = failure is None and guard is None and stable and valid_runtime and not remaining and child is not None and child.returncode is not None
                if not complete: classification = 'incomplete'
                receipt.update(terminalAt=now(), seconds=elapsed, exitCode=child.returncode if child else None, stopReason=guard, failure=failure,
                    classification=classification, coverageComplete=complete, counts=counts, perTest=cases, runtime=runtime, runtimeVerified=valid_runtime,
                    peakAggregateRssKiB=peak, sourceDependenciesControlsUnchanged=stable, remainingOwnedProcesses=remaining,
                    reaped=child is not None and child.returncode is not None and not remaining, cancellationSignal=stage_signal,
                    artifacts={str(p.relative_to(directory)): sha(p) for p in sorted(directory.iterdir()) if p.is_file()})
                write(directory / 'receipt.json', receipt); receipts.append(receipt)
                print(json.dumps({'batch': batch_id, 'stage': sid, 'classification': classification, 'counts': counts, 'seconds': elapsed}), flush=True)
            if not receipt['coverageComplete']:
                final_failure = 'incomplete stage ' + sid + ': ' + str(receipt['stopReason'] or receipt['failure'] or 'runtime/source/process audit failed')
                break
            # Complete assertion-only failures are retained, and independent files continue.
    except BaseException as error: final_failure = type(error).__name__ + ': ' + str(error)
    finally:
        for child in children:
            try: stop(child, knowns[child])
            except BaseException as error: final_failure = (final_failure + '; ' if final_failure else '') + 'cleanup: ' + str(error)
        remaining = [p for c in children for p in members(c, knowns[c])]; stable = False
        try:
            stable = unchanged()
            for receipt in receipts:
                if receipt['coverageComplete']: validate_receipt(receipt, receipt['stage'], out / receipt['stage']['id'])
        except BaseException as error: final_failure = (final_failure + '; ' if final_failure else '') + 'final evidence: ' + str(error)
        elapsed_batch = time.monotonic() - started_batch
        if elapsed_batch > batch['wallSeconds'] or prior_batch_seconds + elapsed_batch > cfg['overallWallSeconds']: final_failure = final_failure or 'batch or overall wall cap'
        final_signal = pending_signal
        if final_signal is not None: final_failure = final_failure or 'verification cancelled by signal ' + str(final_signal)
        batch_complete = final_failure is None and final_signal is None and stable and not remaining and len(receipts) == len(batch['stageIds']) and all(r['coverageComplete'] for r in receipts)
        all_receipts = prior_receipts + receipts
        whole_passed = batch_complete and batch_index == len(batches) - 1 and len(all_receipts) == len(stages) and all(r['classification'] == 'passed' for r in all_receipts)
        refs = [{'stageId': r['stage']['id'], 'receiptPath': r['stage']['id'] + '/receipt.json', 'sha256': sha(out / r['stage']['id'] / 'receipt.json')} for r in receipts]
        terminal = {**admission, 'terminalAt': now(), 'batchSeconds': elapsed_batch, 'batchComplete': batch_complete, 'wholeDefaultSuitePassed': whole_passed,
            'physicalArtifactCasesExecuted': False, 'optionalArtifactCases': 9, 'receipts': refs, 'fatalFailure': final_failure,
            'cancellationSignal': final_signal, 'sourceDependenciesControlsUnchanged': stable, 'remainingOwnedProcesses': remaining,
            'reaped': all(c.returncode is not None for c in children) and not remaining}
        try:
            compact = make_compact_ledger(terminal, all_receipts)
            commit_final_outputs(ledger_path, compact, out / 'terminal.json', terminal)
        except BaseException as error:
            batch_complete = False; whole_passed = False
            final_failure = 'unsafe final output: ' + type(error).__name__ + ': ' + str(error)
            # Keep partial evidence; a missing final terminal is unqualified. No retry or overwrite.
            try:
                write(out / 'output-failure.json', {'batchComplete': False, 'wholeDefaultSuitePassed': False,
                    'fatalFailure': final_failure, 'cancellationSignal': final_signal, 'exitCode': 2})
            except BaseException: pass
        # No fallible output follows successful terminal publication.
# Exit 1 preserves complete assertion-failure coverage; exit 2 means incomplete/unsafe.
exit_code = 0 if batch_complete and all(r['classification'] == 'passed' for r in prior_receipts + receipts) else 1 if batch_complete else 2
raise SystemExit(exit_code)
