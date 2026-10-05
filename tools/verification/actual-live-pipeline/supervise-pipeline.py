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
from scope_contract import validate_scope_terminal
from replay_scope_contract import validate_official_read_replay_terminal


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


def read_pinned_json(ref):
    path=Path(ref['path'])
    assert path.is_absolute() and str(path)==ref['path'] and '..' not in path.parts and path.resolve(strict=True)==path, 'receipt path identity differs'
    data=path.read_bytes();assert hashlib.sha256(data).hexdigest()==ref['sha256'], 'receipt bytes changed'
    value=json.loads(data)
    assert isinstance(value,dict) and not any(key in value for key in ['publicationProjection','originalRawReceiptSha256']), 'raw receipt required'
    return value


def replay_control_hashes():
    return {name:sha256(wrapper_root/file) for name,file in [('launcher','run-official-read-replay.py'),('runtimeProbe','runtime-probe.cjs'),('replayRunner','official-read-replay.mjs')]}



def audit_inherited_inputs():
    # Concrete ancestor references only. Semantic admission remains the Node
    # validator's job; this supervisor independently rechecks retained bytes.
    expected = [('inheritedOfficial', '01-official')]
    if execution_scope == 'next': expected.append(('inheritedRole', '02-role-workload'))
    if execution_scope not in ['role', 'next', 'official_read_replay']: return []
    sealed = []
    roles = ['handoff','outerTerminal','stageTerminal','supervisorTerminal','receipt','configuration','sourceManifest','artifact']
    for key, stage in expected:
        binding = c[key]; files = binding['files']
        assert sorted(files) == sorted(roles), 'inherited file roles differ'
        refs = list(files.values()) + (list(binding['regressionArtifacts'].values()) if key == 'inheritedRole' else [])
        if key == 'inheritedRole': assert sorted(binding['regressionArtifacts']) == ['recovery','stale']
        assert len({ref['path'] for ref in refs}) == len(refs), 'inherited paths collide'
        for ref in refs:
            path = Path(ref['path'])
            assert path.is_absolute() and str(path) == ref['path'] and '..' not in path.parts
            assert path.resolve(strict=True) == path, 'inherited file resolved identity changed'
            assert sha256(path) == ref['sha256'], 'inherited file changed'
        sealed_main_hash(files['artifact']['path'], files['artifact']['sha256'])
        if key == 'inheritedRole':
            for ref in binding['regressionArtifacts'].values(): sealed_main_hash(ref['path'],ref['sha256'])
        manifest = json.loads(Path(files['sourceManifest']['path']).read_text()); prior = Path(binding['sourceRoot'])
        assert prior.is_absolute() and prior.resolve(strict=True) == prior, 'inherited Source root resolved identity changed'
        assert manifest['schema'] == 'actual_artifact_pipeline_source_v1'
        assert manifest['sourceRoot'] == str(prior) and manifest['sourceCommit'] == binding['sourceCommit']
        assert files['sourceManifest']['sha256'] == binding['sourceManifestSha256']
        assert subprocess.check_output(['git','-C',str(prior),'rev-parse','HEAD'],text=True).strip() == binding['sourceCommit']
        assert subprocess.check_output(['git','-C',str(prior),'rev-parse','HEAD^{tree}'],text=True).strip() == manifest['sourceTree']
        assert not subprocess.check_output(['git','-C',str(prior),'diff','--name-only','HEAD'],text=True).strip()
        names = set(filter(None,subprocess.check_output(['git','-C',str(prior),'ls-files','-z']).decode().split('\0')))
        def source_paths(directory):
            assert directory.resolve(strict=True) == directory, 'inherited Source directory resolved identity changed'
            for entry in os.scandir(directory):
                assert not entry.is_symlink(), 'inherited Source symlink is not admitted'
                path = Path(entry.path)
                if entry.is_dir(follow_symlinks=False): yield from source_paths(path)
                elif entry.is_file(follow_symlinks=False): yield str(path.relative_to(prior))
        names |= set(source_paths(prior/'src'))
        assert names == {row['path'] for row in manifest['files']} and len(names) == len(manifest['files'])
        for row in manifest['files']:
            relative = Path(row['path']); assert not relative.is_absolute() and '..' not in relative.parts
            path = prior/relative
            assert path.resolve(strict=True) == path, 'inherited Source file resolved identity changed'
            assert sha256(path) == row['sha256'], 'inherited Source changed'
        sealed.append({'stage':stage,'path':files['receipt']['path'],'sha256':files['receipt']['sha256']})
    return sealed


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
    files = c['physicalProducer']['files']
    producer_refs = [files[name] for name in ['admission', 'results', 'artifactAudit', 'inputManifest', 'sourceBeforeManifest', 'sourceAfterManifest', 'runtime', 'originalInput']]
    producer_refs += list(files['controls'].values()) + list(files['negativeEvidence'].values())
    for ref in producer_refs:
        assert Path(ref['path']).is_absolute() and sha256(ref['path']) == ref['sha256'], 'bound producer evidence changed'
    sealed_main_hash(files['originalInput']['path'], files['originalInput']['sha256'])
    inherited = audit_inherited_inputs()
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
            receipt = read_pinned_json(record)
            replay = execution_scope=='official_read_replay'
            assert receipt['schema'] == ('actual_official_read_replay_receipt_v1' if replay else 'actual_artifact_stage_receipt_v1') and receipt['status'] == 'passed'
            assert receipt['sourceIdentity']['sourceCommit'] == c['sourceCommit']
            assert receipt['sourceIdentity']['sourceManifestSha256'] == c['sourceManifestSha256']
            assert receipt['originalPhysicalArtifactSha256'] == c['physicalArtifactSha256']
            if replay:
                assert record['stage']=='official-read-replay'
                assert receipt['originalOfficialBinding']==c['inheritedOfficial'] and receipt['sourceTransition']==c['sourceTransition']
                assert receipt['originalOfficialReceipt']==receipt['inheritedFaultReceipt']==c['inheritedOfficial']['files']['receipt']
                original=read_pinned_json(c['inheritedOfficial']['files']['receipt'])
                assert receipt['inheritedSourceIdentity']==original['sourceIdentity'] and receipt['physicalProducerReference']==original['physicalProducerReference']
                assert receipt['newlyExecutedOfficialFaults']==[] and receipt['openSqliteHandles']==[]
                assert len(receipt['passes'])==2
                for index,read_pass in enumerate(receipt['passes']):
                    assert read_pass['index']==index and read_pass['connectionId']==index+1 and read_pass['totalChanges']==0
                    assert all(read_pass[field] is True for field in ['readOnly','queryOnly','transactionOwned','transactionClosed','connectionClosed'])
                    assert read_pass['walBytesBefore'] in [None,0] and read_pass['walBytesAfter'] in [None,0]
                    assert read_pass['observation']['artifact']==original['output']
                    for field in ['artifactSha256Before','artifactSha256After']:assert read_pass[field]==c['inheritedOfficial']['files']['artifact']['sha256']
                assert receipt['passes'][0]['observation']==receipt['passes'][1]['observation']
                assert receipt['passes'][0]['observationSha256']==receipt['passes'][1]['observationSha256']
                sealed_main_hash(original['output']['path'],original['output']['sha256'])
            else:
                assert receipt['physicalEndSourceId'] == c['physicalEndSourceId']
                sealed_main_hash(receipt['input']['path'], receipt['input']['sha256'])
                sealed_main_hash(receipt['output']['path'], receipt['output']['sha256'])
                if record['stage'] == '02-role-workload':
                    for key in ['recoveryRegression','staleCasRegression']:
                        disk = receipt[key]['disk']; sealed_main_hash(disk['path'],disk['sha256'])
            sealed.append(record)
    result={'passed': True, 'preservedPhaseReceipts': sealed, 'inheritedStageReceipts': inherited}
    if execution_scope=='official_read_replay':
        assert replay_control_hashes()==c['controlHashes'], 'replay controls changed'
        result.update(originalOfficialBinding=c['inheritedOfficial'],sourceTransition=c['sourceTransition'])
    return result


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
execution_scope = c.get('executionScope', 'all')
assert c['schema'] == ('actual_official_read_replay_run_v1' if execution_scope=='official_read_replay' else 'actual_artifact_pipeline_run_v2')
assert execution_scope in ['all', 'official', 'supervisor_smoke', 'official_read_replay'], 'unsupported execution scope'
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
        str(wrapper_root / ('official-read-replay.mjs' if execution_scope=='official_read_replay' else 'pipeline.mjs')), '--run', str(config_path)]
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
scope_status = None
handoff_receipt = None
try:
    scope_status = validate_official_read_replay_terminal(terminal,audit.get('preservedPhaseReceipts',[]),audit.get('inheritedStageReceipts',[])) if execution_scope=='official_read_replay' else validate_scope_terminal(execution_scope, terminal, audit.get('preservedPhaseReceipts', []), audit.get('inheritedStageReceipts', []))
    assert terminal['sourceIdentity']['sourceCommit'] == c['sourceCommit']
    assert terminal['sourceIdentity']['sourceManifestSha256'] == c['sourceManifestSha256']
    if execution_scope=='official_read_replay':
        receipt=read_pinned_json(audit['preservedPhaseReceipts'][0])
        expected_checks=dict(sourceUnchanged=True,configUnchanged=True,controlsUnchanged=True,originalEvidenceUnchanged=True,
            artifactUnchanged=True,closeReopenEqual=True,readOnlyEnforced=True)
        assert receipt['checks']==terminal['checks']==expected_checks and all(value is True for value in receipt['checks'].values())
        assert receipt['executed']==terminal['executed'] and terminal['auditedClosedPasses']==[1,2]
        assert worker['node']=='v26.10.0' and worker['nodeSha256']==runtime['nodeSha256']
        assert receipt['sourceIdentity']==terminal['sourceIdentity']
    if execution_scope == 'supervisor_smoke':
        assert all(terminal.get(key) == 0 for key in ['artifactHelpersImported', 'artifactHelpersExecuted', 'nativeArtifactsOpened'])
        assert terminal.get('lockProbes') == [dict(path=lock['path'], competingAcquisitionExitCode=1) for lock in native_locks]
    if execution_scope == 'official':
        sealed = audit['preservedPhaseReceipts'][0]
        handoff_receipt = json.loads(Path(sealed['path']).read_text())
        assert handoff_receipt['faultChecks'] is True and handoff_receipt['faultEvidence'] == dict(adjudicationDependencyAfterInsert=True, officialApplicationAfterInsert=True)
        assert handoff_receipt['executed'] == dict(helperCalls=1, newOfficialApplications=1, newPhysicalPitchActions=0)
        assert terminal['resumableOfficial'] == dict(receipt=sealed, output=handoff_receipt['output'], closureSourceId=handoff_receipt['closureSourceId'], applicationId=handoff_receipt['applicationId'])

    if execution_scope == 'role':
        sealed = audit['preservedPhaseReceipts'][0]
        handoff_receipt = json.loads(Path(sealed['path']).read_text())
        assert handoff_receipt['faultChecks'] is True
        assert handoff_receipt['faultEvidence'] == dict(assessmentAfterInsert=True,freezeAfterInsert=True,workloadAfterInsert=True,staleCurrentHeadRejected=True,interruptedAfterFirstInsert=True)
        assert handoff_receipt['executed'] == dict(helperCalls=1,participantSettlements=10,newMatchWorkloadActivities=10,newPhysicalPitchActions=0)
        assert handoff_receipt['settlement']['kind'] == 'complete' and len(handoff_receipt['settlement']['participants']) == 10
        assert all(value['applied'] is True for value in handoff_receipt['settlement']['participants'])
        assert handoff_receipt['inheritedStageReceipts'] == audit['inheritedStageReceipts']
        assert terminal['resumableRole'] == dict(receipt=sealed,output=handoff_receipt['output'],closureSourceId=handoff_receipt['settlement']['closureSourceId'],applicationId=handoff_receipt['settlement']['closureApplicationId'])
    if execution_scope == 'next':
        receipt = json.loads(Path(audit['preservedPhaseReceipts'][0]['path']).read_text())
        assert receipt['faultChecks'] is True and receipt['faultEvidence'] == dict(wrongActivationRejected=True,actorReadinessAfterInsert=True)
        assert receipt['executed'] == dict(helperCalls=1,newActorAdmissions=1,newPhysicalPitchActions=1,newWorkloadActivities=0)
        assert receipt['physicalWorldRecoveryProven'] is False and terminal['physicalWorldRecoveryProven'] is False
        assert receipt['inheritedStageReceipts'] == audit['inheritedStageReceipts']

except (AssertionError, KeyError, TypeError, OSError, ValueError) as error:
    scope_status = None
    audit = {**audit, 'scopeValidationError': repr(error)}
passed = exit_code == 0 and guard is None and worker_valid and audit['passed'] and not remaining_processes and scope_status is not None
process_terminal={'status': scope_status if passed else 'failed', 'executionScope': execution_scope,
    'wholePipelinePassed': passed and execution_scope == 'all', 'exitCode': exit_code,
    'guard': guard, 'elapsedSeconds': time.monotonic() - started, 'sampledPeakProcessGroupRssKiB': peak_rss_kib,
    'executingProcessReceiptValid': worker_valid, 'sourceInputAndReceiptAudit': audit,
    'remainingOwnedProcesses': remaining_processes, 'inheritedStageReceipts': audit.get('inheritedStageReceipts', []),
    'pipelineTerminalStatus': terminal.get('status') if isinstance(terminal, dict) else 'absent',
    'preservedPhaseReceipts': [str(path) for path in sorted(run_directory.glob('*.receipt.json'))] if run_directory.exists() else []}
if execution_scope=='official_read_replay':
    process_terminal.update(controlHashes=replay_control_hashes(),runtime=dict(nodeSha256=worker.get('nodeSha256') if isinstance(worker,dict) else None,
        heapLimitMiB=worker.get('heapLimitMiB') if isinstance(worker,dict) else None,elapsedSeconds=time.monotonic()-started,peakRssKiB=peak_rss_kib))
write_new(runtime_directory / 'process-terminal.json',process_terminal)
if passed and execution_scope == 'official':
    sealed = audit['preservedPhaseReceipts'][0]
    receipt = handoff_receipt
    write_new(run_directory / 'official-handoff.json', {
        'schema': 'actual_official_stage_handoff_v1', 'status': 'stage_passed', 'wholePipelinePassed': False,
        'remainingStages': ['role', 'next'], 'sourceIdentity': receipt['sourceIdentity'],
        'physicalProducerReference': receipt['physicalProducerReference'],
        'config': {'path': str(config_path), 'sha256': config_hash},
        'officialReceipt': sealed,
        'stageTerminal': {'path': str(run_directory / 'terminal.json'), 'sha256': sha256(run_directory / 'terminal.json')},
        'supervisorTerminal': {'path': str(runtime_directory / 'process-terminal.json'), 'sha256': sha256(runtime_directory / 'process-terminal.json')},
        'output': receipt['output'], 'closureSourceId': receipt['closureSourceId'], 'applicationId': receipt['applicationId'],
        'continuation': 'Use the pinned closed output as the next helper input; authenticate these receipts and original lineage before any continuation. Do not rerun official or infer downstream success.'})
if passed and execution_scope == 'role':
    sealed = audit['preservedPhaseReceipts'][0]; receipt = handoff_receipt
    write_new(run_directory / 'role-handoff.json', {
        'schema':'actual_role_stage_handoff_v1','status':'stage_passed','wholePipelinePassed':False,
        'remainingStages':['next'],'inheritedStages':['official'],'inheritedOfficial':c['inheritedOfficial'],
        'inheritedStageReceipts':audit['inheritedStageReceipts'],'sourceIdentity':receipt['sourceIdentity'],
        'physicalProducerReference':receipt['physicalProducerReference'],
        'config':{'path':str(config_path),'sha256':config_hash},'roleReceipt':sealed,
        'stageTerminal':{'path':str(run_directory/'terminal.json'),'sha256':sha256(run_directory/'terminal.json')},
        'supervisorTerminal':{'path':str(runtime_directory/'process-terminal.json'),'sha256':sha256(runtime_directory/'process-terminal.json')},
        'output':receipt['output'],'closureSourceId':receipt['settlement']['closureSourceId'],
        'applicationId':receipt['settlement']['closureApplicationId']})
sys.exit(0 if passed else 1)
