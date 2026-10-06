"""Held serial fresh-input continuation. Requires an explicitly released slot."""
import argparse, contextlib, ctypes, datetime, fcntl, hashlib, json, os, pathlib, re, signal, subprocess, sys, time

if not __debug__: raise SystemExit('optimized Python is forbidden')
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--coordinator-slot-granted', action='store_true'); parser.add_argument('--run', action='store_true')
parser.add_argument('--config', required=True); parser.add_argument('--config-sha256', required=True)
parser.add_argument('--phase', required=True, choices=['all', 'compiler', 'raw', 'reauthenticate', 'official', 'role', 'next'])
parser.add_argument('--preceding-terminal-sha256'); args = parser.parse_args()
if not args.coordinator_slot_granted or not args.run: raise SystemExit('explicit coordinator release and --run required')
def sha(path): return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()
def pinned_json(path, expected_hash=None):
    data = pathlib.Path(path).read_bytes(); digest = hashlib.sha256(data).hexdigest()
    if expected_hash is not None: assert re.fullmatch('[0-9a-f]{64}', expected_hash) and digest == expected_hash, 'pinned JSON bytes differ'
    return json.loads(data), digest
config_path = pathlib.Path(args.config).resolve()
cfg, _config_digest = pinned_json(config_path, args.config_sha256); cwd = pathlib.Path(cfg['cwd']); flow = pathlib.Path(cfg['output']); out = flow / 'controls' / args.phase
deps = pathlib.Path(cfg['dependencies']); node = pathlib.Path(cfg['node']); probe = cwd / 'tools/verification/actual-live-pipeline/runtime-probe.cjs'
assert cfg['schema'] == 'fresh_closed_input_continuation_supervision_v1'
assert list(cfg['stages']) == ['compiler', 'raw', 'reauthenticate', 'official', 'role', 'next']
selected = list(cfg['stages']) if args.phase == 'all' else [args.phase]
if args.phase in ['all', 'compiler']: assert not flow.exists(), 'compiler/all must start a new declared flow'
assert not (flow / 'checkpoints' / (args.phase + '-terminal.json')).exists(), 'preserve already qualified checkpoint'
assert not out.exists(), 'each attempt must be new; no automatic retry'
m, _input_digest = pinned_json(cfg['inputManifest'], cfg['inputManifestSha256']); assert m['sourceCommit'] == cfg['sourceCommit']
assert m['origin'] == {'kind': 'published_closed_snapshot', 'notRawProducerAdmission': True, 'historicalReceiptsInherited': False}
def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def mem(): return next(int(x.split()[1]) for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:'))
def git(*args): return subprocess.check_output(['git', *args], cwd=cwd, text=True, env={**os.environ, 'GIT_OPTIONAL_LOCKS': '0'}).strip()
def source_manifest():
    names = set(subprocess.check_output(['git', 'ls-files', '-z'], cwd=cwd).decode().split('\0')) - {''}
    names |= {str(p.relative_to(cwd)) for folder in ['src', 'docs', 'tools', 'data'] for p in (cwd / folder).rglob('*') if p.is_file()}
    names.add('tsconfig.fresh-continuation.json')
    return ''.join(sha(cwd / name) + '  ' + name + '\n' for name in sorted(names))
def dependency_manifest():
    return {str(p.relative_to(deps)): sha(p) for p in sorted(deps.rglob('*')) if p.is_file()
            and not {'.vite', '.cache', '.bin'}.intersection(p.relative_to(deps).parts)}
identity = cwd / 'tools/verification/repeated-batted-recovery/process-identity-reviewed.fragment.py'
assert sha(identity) == '17c73eb414b32f9f1616b5e4e58ac1077a0449dd5b6887c0291369b73ce9ca9f'
scope = {'pathlib': pathlib, 'os': os, 'signal': signal, 'time': time}
exec(identity.read_text(), scope)
census, members, stop = (scope[name] for name in ['census', 'members', 'stop'])
prepared_bytes = pathlib.Path(cfg['sourceManifest']).read_bytes()
assert hashlib.sha256(prepared_bytes).hexdigest() == cfg['sourceManifestSha256']; prepared = prepared_bytes.decode()
prepared_deps, _dependency_digest = pinned_json(cfg['dependencyManifest'], cfg['dependencyManifestSha256'])
def audit():
    assert git('rev-parse', 'HEAD') == cfg['sourceCommit'] and git('rev-parse', 'HEAD:src') == cfg['srcTree']
    assert git('diff', '--name-only', 'HEAD') == '', 'tracked Source changed'
    assert (cwd / 'node_modules').is_symlink() and (cwd / 'node_modules').resolve() == deps.resolve(), 'bind reviewed dependencies before launch'
    assert source_manifest() == prepared and dependency_manifest() == prepared_deps
    assert all(sha(path) == digest for path, digest in cfg['controlHashes'].items())
    assert sha(config_path) == args.config_sha256 and sha(cfg['inputManifest']) == cfg['inputManifestSha256']
    assert sha(m['input']['path']) == m['input']['sha256']
def write(name, value):
    with (out / name).open('x') as file:
        json.dump(value, file, indent=2); file.write('\n'); file.flush(); os.fsync(file.fileno())
checkpoint_pins = {}
def checkpoint(name, expected_hash=None):
    path = flow / 'checkpoints' / (name + '-terminal.json')
    retained = checkpoint_pins.get(name)
    if expected_hash is not None and retained is not None: assert expected_hash == retained, 'preceding terminal pin changed'
    value, actual = pinned_json(path, expected_hash if expected_hash is not None else retained)
    checkpoint_pins.setdefault(name, actual); assert checkpoint_pins[name] == actual, 'captured terminal bytes changed'
    assert value['phase'] == name and value['phaseVerified'] is True and value['reaped'] is True
    assert value['sourceCommit'] == cfg['sourceCommit'] and value['configurationSha256'] == args.config_sha256
    assert value['inputManifestSha256'] == cfg['inputManifestSha256'] and value['sourceManifestSha256'] == cfg['sourceManifestSha256']
    assert value['dependencyManifestSha256'] == cfg['dependencyManifestSha256'] and value['sourceDependenciesControlsInputUnchanged'] is True
    proof = value['proof']
    if proof is not None: assert sha(proof['path']) == proof['sha256'], 'preceding proof changed'
    predecessor = value['predecessorTerminal']
    if name in preceding:
        assert predecessor['phase'] == preceding[name], 'preceding phase attribution differs'
        checkpoint(preceding[name], predecessor['sha256'])
    else: assert predecessor is None
    return value
preceding = {'raw': 'compiler', 'reauthenticate': 'raw', 'official': 'reauthenticate', 'role': 'official', 'next': 'role'}
if args.phase not in ['all', 'compiler']:
    assert args.preceding_terminal_sha256 is not None, 'independently pinned preceding terminal required'
    checkpoint(preceding[args.phase], args.preceding_terminal_sha256)
else: assert args.preceding_terminal_sha256 is None, 'fresh root invocation cannot claim an inherited terminal pin'
def supervisor_rss(): return next(int(x.split()[1]) for x in pathlib.Path('/proc/self/status').read_text().splitlines() if x.startswith('VmRSS:'))
cancellation_signal = None
def cancelled(signum, frame):
    global cancellation_signal
    cancellation_signal = signum
for sig in [signal.SIGTERM, signal.SIGINT]: signal.signal(sig, cancelled)
assert hasattr(os, 'pidfd_open') and hasattr(signal, 'pidfd_send_signal'), 'reviewed supervision requires Linux pidfd'
children = []; knowns = {}; receipts = []; failure = None; verified = False
audit()
with contextlib.ExitStack() as stack:
    locks = []
    for name in ['baseball-native-check.lock', 'baseball-native-aux-check.lock', 'baseball-light-check.lock']:
        handle = stack.enter_context(open('/workspace/shared/' + name, 'a')); fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB); locks.append(handle)
    assert mem() >= 7 * 1024 * 1024, '7 GiB launch reserve required'
    assert ctypes.CDLL(None, use_errno=True).prctl(36, 1, 0, 0, 0) == 0, 'cannot reap orphaned descendants'
    out.mkdir(parents=True); (out / 'tmp').mkdir(); write('admission.json', {'schema': cfg['schema'], 'sourceCommit': cfg['sourceCommit'],
        'inputManifestSha256': cfg['inputManifestSha256'], 'origin': m['origin'], 'historicalRawProducerAdmission': False,
        'originalConstructionProven': False, 'originalSealRollbackProven': False, 'sourceManifestSha256': cfg['sourceManifestSha256']})
    try:
        for name in selected:
            spec = cfg['stages'][name]
            audit(); child = None; guard = None; stage_failure = None; phase_valid = False; runtime_valid = name == 'raw'; peak = 0; started = time.monotonic()
            prior = checkpoint(preceding[name], checkpoint_pins.get(preceding[name])) if name in preceding else None
            predecessor_pin = {'phase': preceding[name], 'sha256': checkpoint_pins[preceding[name]]} if prior is not None else None
            receipt = {'phase': name, 'startedAt': now(), 'bounds': spec, 'sourceCommit': cfg['sourceCommit'],
                       'configurationSha256': args.config_sha256, 'inputManifestSha256': cfg['inputManifestSha256'],
                       'sourceManifestSha256': cfg['sourceManifestSha256'], 'dependencyManifestSha256': cfg['dependencyManifestSha256'],
                       'predecessorTerminal': predecessor_pin}
            env = dict(os.environ)
            for key in list(env):
                if key == 'TINYPOOL_WORKER_ID' or key.startswith(('BASEBALL_', 'ACTUAL_PIPELINE_')) or key == 'NODE_OPTIONS': del env[key]
            env.update(TMPDIR=str(out / 'tmp'), GIT_OPTIONAL_LOCKS='0', BASEBALL_FRESH_INPUT_MANIFEST=cfg['inputManifest'],
                       BASEBALL_FRESH_INPUT_SHA256=cfg['inputManifestSha256'], BASEBALL_FRESH_PHASE=name, BASEBALL_FRESH_OUTPUT=str(flow))
            if prior is not None and prior['proof'] is not None: env['BASEBALL_FRESH_PREDECESSOR_RECEIPT_SHA256'] = prior['proof']['sha256']
            if predecessor_pin is not None: env['BASEBALL_FRESH_PREDECESSOR_TERMINAL_SHA256'] = predecessor_pin['sha256']
            if name == 'raw':
                command = [cfg['python'], str(cwd / 'tools/verification/repeated-batted-recovery/preflight.py'), '--manifest', cfg['inputManifest'],
                           '--manifest-sha256', cfg['inputManifestSha256'], '--output', str(flow / 'raw-preflight.json')]
            else:
                env.update(NODE_OPTIONS=f"--max-old-space-size={spec['oldSpaceMiB']} --require={probe}",
                           BASEBALL_PIPELINE_OLD_SPACE_MIB=str(spec['oldSpaceMiB']), BASEBALL_PIPELINE_EXPECTED_HEAP_MIB=str(spec['heapMiB']),
                           BASEBALL_PIPELINE_RUNTIME_LOG=str(out / (name + '-runtime.jsonl')), ACTUAL_PIPELINE_CACHE_DIR=str(out / 'tmp' / ('vite-' + name)))
                command = [str(node), 'node_modules/typescript/bin/tsc', '--project', 'tsconfig.fresh-continuation.json', '--noEmit', '--pretty', 'false'] if name == 'compiler' else [str(node), 'node_modules/vite-node/vite-node.mjs', '--config', 'tools/verification/actual-live-pipeline/vite.config.mjs', 'tools/verification/repeated-batted-recovery/phase.ts']
            receipt['command'] = command
            try:
                with (out / (name + '.log')).open('x') as log, (out / (name + '-rss.jsonl')).open('x') as telemetry:
                    child = subprocess.Popen(command, cwd=cwd, env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True,
                                             pass_fds=tuple(handle.fileno() for handle in locks))
                    children.append(child); knowns[child] = {'root': None, 'generations': set()}; receipt['childPid'] = child.pid
                    initial = census().get(child.pid)
                    assert initial is not None and initial['ppid'] == os.getpid() and initial['processGroup'] == child.pid, 'cannot pin initial owned root identity'
                    knowns[child]['root'] = (child.pid, initial['startTime']); knowns[child]['generations'].add(knowns[child]['root']); receipt['rootStartTime'] = initial['startTime']
                    while True:
                        code = child.poll(); processes = members(child, knowns[child]); elapsed = time.monotonic() - started
                        rss = sum(p['rssKiB'] for p in processes) + supervisor_rss(); peak = max(peak, rss)
                        telemetry.write(json.dumps({'elapsedSeconds': elapsed, 'aggregateRssKiB': rss, 'memAvailableKiB': mem(), 'processes': processes}) + '\n'); telemetry.flush()
                        if cancellation_signal is not None: guard = 'cancelled'; break
                        if elapsed > spec['wallSeconds'] or rss > spec['rssMiB'] * 1024 or mem() < spec['stopReserveGiB'] * 1024 * 1024:
                            guard = 'wall_cap' if elapsed > spec['wallSeconds'] else 'rss_cap' if rss > spec['rssMiB'] * 1024 else 'memory_reserve'; break
                        if code is not None:
                            if any(p['state'] != 'Z' for p in processes): guard = 'owned_descendants_survived_stage'
                            break
                        time.sleep(.25)
            except BaseException as error: stage_failure = type(error).__name__ + ': ' + str(error)
            finally:
                if child is not None:
                    try: stop(child, knowns[child])
                    except BaseException as error: stage_failure = (stage_failure + '; ' if stage_failure else '') + 'cleanup: ' + str(error)
            remaining = members(child, knowns[child]) if child is not None else []
            unchanged = False
            proof = None
            try:
                audit(); unchanged = True
                if prior is not None: checkpoint(preceding[name], predecessor_pin['sha256'])
                if name != 'raw':
                    runtime = [json.loads(line) for line in (out / (name + '-runtime.jsonl')).read_text().splitlines()]
                    assert len(runtime) == 1 and runtime[0]['pid'] == child.pid and runtime[0]['ppid'] == os.getpid()
                    assert runtime[0]['node'] == cfg['nodeVersion'] and runtime[0]['requestedOldSpaceMiB'] == spec['oldSpaceMiB'] and runtime[0]['heapLimitMiB'] == spec['heapMiB']
                    runtime_valid = True
                if name == 'raw':
                    proof_path = flow / 'raw-preflight.json'; report, proof_hash = pinned_json(proof_path)
                    proof = {'path': str(proof_path), 'sha256': proof_hash}
                    assert report['nativeReauthenticated'] is False and report['readOnly'] is True and report['allConnectionsClosed'] is True
                elif name != 'compiler':
                    proof_path = flow / (name + '-receipt.json'); report, proof_hash = pinned_json(proof_path)
                    proof = {'path': str(proof_path), 'sha256': proof_hash}
                    assert report['phase'] == name and report['inputManifestSha256'] == cfg['inputManifestSha256'] and report['sourceCommit'] == cfg['sourceCommit']
                    assert report['input']['predecessorTerminalSha256'] == predecessor_pin['sha256'], 'consumed terminal attribution differs'
                    assert report['historicalReceiptsInherited'] is False and report['originalConstructionProven'] is False and report['geometryRedObserved'] is False
                    if name == 'reauthenticate': assert report['result']['nativePersistedEndReauthenticated'] is True
                phase_valid = True
            except BaseException as error: stage_failure = (stage_failure + '; ' if stage_failure else '') + 'audit/output: ' + str(error)
            ok = child is not None and child.returncode == 0 and not remaining and stage_failure is None and guard is None and unchanged and runtime_valid and phase_valid
            receipt.update(terminalAt=now(), exitCode=child.returncode if child is not None else None, seconds=time.monotonic() - started,
                           peakAggregateRssKiB=peak, stopReason=guard, failure=stage_failure, reaped=child is not None and child.returncode is not None and not remaining,
                           remainingOwnedProcesses=remaining, sourceDependenciesControlsInputUnchanged=unchanged, phaseVerified=ok, proof=proof)
            receipts.append(receipt); write(name + '-terminal.json', receipt); print(json.dumps(receipt), flush=True)
            if ok:
                checkpoint_path = flow / 'checkpoints' / (name + '-terminal.json'); checkpoint_path.parent.mkdir(exist_ok=True)
                checkpoint_bytes = (json.dumps(receipt, indent=2) + '\n').encode()
                checkpoint_pins[name] = hashlib.sha256(checkpoint_bytes).hexdigest()
                with checkpoint_path.open('xb') as file: file.write(checkpoint_bytes); file.flush(); os.fsync(file.fileno())
            if not ok: break
    except BaseException as error: failure = type(error).__name__ + ': ' + str(error)
    finally:
        for child in children:
            try: stop(child, knowns[child])
            except BaseException as error: failure = (failure + '; ' if failure else '') + 'final cleanup: ' + str(error)
        remaining = [p for child in children for p in members(child, knowns[child])]
        unchanged = False
        try: audit(); unchanged = True
        except BaseException as error: failure = (failure + '; ' if failure else '') + 'final audit: ' + str(error)
        try:
            for name, digest in list(checkpoint_pins.items()): checkpoint(name, digest)
        except BaseException as error: failure = (failure + '; ' if failure else '') + 'captured checkpoint audit: ' + str(error)
        verified = failure is None and cancellation_signal is None and unchanged and not remaining and len(receipts) == len(selected) and all(r['phaseVerified'] for r in receipts)
        whole = False
        if verified and all((flow / 'checkpoints' / (name + '-terminal.json')).is_file() for name in cfg['stages']):
            try:
                whole = all(checkpoint(name, checkpoint_pins.get(name))['phaseVerified'] for name in cfg['stages'])
                for name in ['official', 'role', 'next']:
                    captured = checkpoint(name, checkpoint_pins[name]); report, _proof_digest = pinned_json(captured['proof']['path'], captured['proof']['sha256']); result = report['result']
                    assert report['input']['predecessorTerminalSha256'] == captured['predecessorTerminal']['sha256'], 'final predecessor attribution differs'
                    assert sha(result['destinationPath']) == result['destinationSha256'], 'closed checkpoint bytes changed'
            except BaseException as error: whole = False; failure = (failure + '; ' if failure else '') + 'whole-flow audit: ' + str(error); verified = False
        terminal = {'schema': 'fresh_closed_input_continuation_terminal_v1', 'at': now(), 'invocationVerified': verified, 'freshContinuationVerified': whole, 'phases': receipts,
                    'sourceCommit': cfg['sourceCommit'], 'inputManifestSha256': cfg['inputManifestSha256'], 'failure': failure,
                    'externallySuppliedPredecessorTerminalSha256': args.preceding_terminal_sha256, 'capturedCheckpointPins': dict(checkpoint_pins),
                    'sourceDependenciesControlsInputUnchanged': unchanged, 'reaped': all(c.returncode is not None for c in children) and not remaining,
                    'remainingOwnedProcesses': remaining, 'cancellationSignal': cancellation_signal, 'historicalReceiptsInherited': False,
                    'originalConstructionProven': False, 'originalSealRollbackProven': False, 'elapsedWorldRecoveryProven': False,
                    'historicalRawProducerAdmission': False, 'geometryRedObserved': False, 'wholePipelinePassed': False}
        write('terminal.json', terminal); print(json.dumps(terminal), flush=True)
raise SystemExit(0 if verified else 2)
