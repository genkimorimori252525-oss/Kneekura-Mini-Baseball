"""One owned read-replay attempt with an actual supervisor-exit receipt."""
import fcntl,hashlib,json,os,pathlib,signal,subprocess,sys,time
assert len(sys.argv)==3 and sys.argv[2]=='--coordinator-slot-granted'
def checked(path):
    value=pathlib.Path(path)
    assert value.is_absolute() and os.path.normpath(str(path))==str(path) and value.resolve(strict=True)==value, 'resolved path identity differs'
    return value
def sha(path):
    digest=hashlib.sha256()
    with checked(path).open('rb') as stream:
        for chunk in iter(lambda:stream.read(1024*1024),b''):digest.update(chunk)
    return digest.hexdigest()
def read_pin(path,expected=None):
    path=checked(path);data=path.read_bytes();digest=hashlib.sha256(data).hexdigest()
    if expected is not None:assert digest==expected, 'JSON bytes differ'
    value=json.loads(data)
    assert isinstance(value,dict) and not any(key in value for key in ['publicationProjection','originalRawReceiptSha256']), 'raw JSON evidence required'
    return value,dict(path=str(path),sha256=digest)
def read_ref(ref):return read_pin(ref['path'],ref['sha256'])[0]
def closed(ref):
    assert sha(ref['path'])==ref['sha256'];wal=pathlib.Path(ref['path']+'-wal');assert not wal.exists() or wal.stat().st_size==0
def members(group):
    values=[]
    for path in pathlib.Path('/proc').iterdir():
        if not path.name.isdigit():continue
        try:
            fields=(path/'stat').read_text().rsplit(') ',1)[1].split()
            if int(fields[2])==group and fields[0]!='Z':values.append(int(path.name))
        except (OSError,ValueError,IndexError):pass
    return values
def run_supervisor(command,root,log,maximum_wall_seconds,light_fd):
    child=None;code=None;outer_guard=None
    try:
        # Signals only set a flag, so a successfully forked child is assigned
        # before interruption can enter the ownership/cleanup path.
        child=subprocess.Popen(command,cwd=root,stdout=log,stderr=subprocess.STDOUT,start_new_session=True,pass_fds=(light_fd,))
        deadline=time.monotonic()+maximum_wall_seconds+60
        while True:
            if pending_signal is not None:raise InterruptedError(f'outer replay interrupted: {pending_signal}')
            remaining=deadline-time.monotonic()
            if remaining<=0:raise subprocess.TimeoutExpired(command,maximum_wall_seconds+60)
            try:code=child.wait(timeout=min(.1,remaining));break
            except subprocess.TimeoutExpired:continue
    except BaseException as error:
        outer_guard=repr(error)
        if child is not None:
            try:os.killpg(child.pid,signal.SIGTERM)
            except ProcessLookupError:pass
            try:child.wait(timeout=15)
            except subprocess.TimeoutExpired:os.killpg(child.pid,signal.SIGKILL);child.wait()
            code=child.returncode
    if pending_signal is not None:outer_guard=outer_guard or f'outer replay interrupted: {pending_signal}'
    return child,code,outer_guard
config_path=checked(sys.argv[1]);c,config_pin=read_pin(config_path);root=checked(c['sourceRoot'])
assert c['schema']=='actual_role_read_replay_run_v1' and c['executionScope']=='role_read_replay'
assert pathlib.Path(__file__).resolve().parent==root/'tools/verification/actual-live-pipeline', 'outer belongs to a different Source'
run=pathlib.Path(c['runDirectory']);runtime=pathlib.Path(str(run)+'.runtime');out=config_path.parent/'replay-outer'
assert run.is_absolute() and not any(path.exists() for path in [run,runtime,out]), 'fresh attempt required; no automatic retry'
light=open('/workspace/shared/baseball-light-check.lock','a');fcntl.flock(light,fcntl.LOCK_EX|fcntl.LOCK_NB)
available=next(int(line.split()[1]) for line in pathlib.Path('/proc/meminfo').read_text().splitlines() if line.startswith('MemAvailable:'))
assert available>=c['runtime']['minimumAvailableMiB']*1024
manifest=read_ref(dict(path=c['sourceManifestPath'],sha256=c['sourceManifestSha256']))
def source_check():
    manifest=read_ref(dict(path=c['sourceManifestPath'],sha256=c['sourceManifestSha256']))
    assert subprocess.check_output(['git','-C',str(root),'rev-parse','HEAD'],text=True).strip()==c['sourceCommit']
    for row in manifest['files']:
        relative=pathlib.Path(row['path']);assert not relative.is_absolute() and '..' not in relative.parts
        assert sha(root/relative)==row['sha256']
    assert sha(config_path)==config_pin['sha256']
ancestor_refs=[*c['inheritedOfficial']['files'].values(),*c['inheritedRole']['files'].values(),*c['inheritedRole']['regressionArtifacts'].values(),*c['officialReadReplay']['files'].values()]
assert len(ancestor_refs)==len({ref['path'] for ref in ancestor_refs})==24
for ref in ancestor_refs:checked(ref['path'])
artifact_paths={c['inheritedOfficial']['files']['artifact']['path'],c['inheritedRole']['files']['artifact']['path'],*[ref['path'] for ref in c['inheritedRole']['regressionArtifacts'].values()]}
source_check();assert sha(__file__)==c['controlHashes']['launcher']
out.mkdir()
def write(name,value):
    with (out/name).open('x') as stream:json.dump(value,stream,indent=2);stream.write('\n');stream.flush();os.fsync(stream.fileno())
command=['bash',str(root/'tools/verification/actual-live-pipeline/run-pipeline.sh'),str(config_path)]
write('admission.json',dict(kind='role_read_replay',sourceCommit=c['sourceCommit'],sourceManifestSha256=c['sourceManifestSha256'],config=config_pin,
    argv=command,launcherSha256=sha(__file__),availableKiB=available,scope='one read-only replay attempt; no retries'))
started=time.monotonic();outer_guard=None
pending_signal=None
def interrupted(signum,_frame):
    global pending_signal
    if pending_signal is None:pending_signal=signum
signal.signal(signal.SIGTERM,interrupted);signal.signal(signal.SIGINT,interrupted)
with (out/'launch.log').open('x') as log:
    child,code,outer_guard=run_supervisor(command,root,log,c['runtime']['maximumWallSeconds'],light.fileno())
owned=None
try:owned=json.loads((runtime/'pid.json').read_text())['processGroup']
except (OSError,ValueError,KeyError):pass
if isinstance(owned,int) and members(owned):
    outer_guard=outer_guard or 'supervisor left its owned execution group alive'
    try:os.killpg(owned,signal.SIGTERM)
    except ProcessLookupError:pass
    until=time.monotonic()+3
    while members(owned) and time.monotonic()<until:time.sleep(.025)
    if members(owned):
        try:os.killpg(owned,signal.SIGKILL)
        except ProcessLookupError:pass
    until=time.monotonic()+3
    while members(owned) and time.monotonic()<until:time.sleep(.025)
refs={};passed=False;error=None
try:
    assert code==0 and outer_guard is None, 'supervisor did not exit cleanly'
    source_check()
    process,process_pin=read_pin(runtime/'process-terminal.json');stage,stage_pin=read_pin(run/'terminal.json')
    assert process['status']==stage['status']=='read_replay_passed' and process['exitCode']==0
    assert process['wholePipelinePassed'] is False and stage['wholePipelinePassed'] is False
    assert process['guard'] is None and process['remainingOwnedProcesses']==[] and process['executingProcessReceiptValid'] is True
    audit=process['sourceInputAndReceiptAudit'];assert audit['passed'] is True
    assert stage['phaseReceipts']==audit['preservedPhaseReceipts'] and stage['inheritedStageReceipts']==audit['inheritedStageReceipts']
    assert audit['originalRoleBinding']==c['inheritedRole'] and audit['roleSourceTransition']==c['roleSourceTransition']
    assert len(stage['phaseReceipts'])==1 and stage['phaseReceipts'][0]['stage']=='role-read-replay'
    sealed=stage['phaseReceipts'][0];receipt=read_ref(sealed)
    assert receipt['sourceIdentity']==stage['sourceIdentity']==c['roleSourceTransition']['toSourceIdentity']
    assert receipt['inheritedSourceIdentity']==c['roleSourceTransition']['fromSourceIdentity']
    assert receipt['originalOfficialBinding']==c['inheritedOfficial'] and receipt['originalRoleBinding']==c['inheritedRole'] and receipt['roleSourceTransition']==c['roleSourceTransition']
    assert receipt['originalRoleReceipt']==c['inheritedRole']['files']['receipt']
    inherited=[dict(stage='01-official',**c['inheritedOfficial']['files']['receipt']),dict(stage='02-role-workload',**c['inheritedRole']['files']['receipt'])]
    assert receipt['inheritedFaultReceipts']==stage['inheritedStageReceipts']==inherited
    checks=dict(sourceUnchanged=True,configUnchanged=True,controlsUnchanged=True,originalEvidenceUnchanged=True,artifactUnchanged=True,closeReopenEqual=True,readOnlyEnforced=True)
    assert receipt['checks']==stage['checks']==checks and all(value is True for value in receipt['checks'].values())
    executed=dict(readOnlyConnections=2,readTransactions=2,settlementReads=2,currentHeadReads=20,
        officialHelperCalls=0,roleHelperCalls=0,nextHelperCalls=0,newOfficialApplications=0,newWorkloadActivities=0,newPhysicalPitchActions=0)
    assert receipt['executed']==stage['executed']==executed and all(type(value) is int for value in receipt['executed'].values())
    assert receipt['newlyExecutedDomainFaults']==[] and receipt['openSqliteHandles']==stage['openSqliteHandles']==[]
    assert stage['auditedClosedPasses']==[1,2] and stage['remainingStages']==['next'] and stage['inheritedStages']==['official','role']
    assert process['controlHashes']==c['controlHashes'] and process['runtime']['nodeSha256']==c['runtime']['nodeSha256']
    assert process['runtime']['heapLimitMiB']==c['runtime']['expectedHeapLimitMiB']
    assert process['runtime']['elapsedSeconds']<=c['runtime']['maximumWallSeconds'] and 0<process['runtime']['peakRssKiB']<=c['runtime']['maximumRssMiB']*1024
    assert len(receipt['passes'])==2 and receipt['passes'][0]['observation']==receipt['passes'][1]['observation']
    assert receipt['passes'][0]['observationSha256']==receipt['passes'][1]['observationSha256']
    for ref in ancestor_refs:
        if ref['path'] in artifact_paths:closed(ref)
        else:read_ref(ref)
    original=read_ref(c['inheritedRole']['files']['receipt'])
    assert receipt['originalOfficialReadReplay']==original['inheritedReadReplay']
    assert receipt['expectedSettlementSha256']==c['expectedSettlementSha256']
    for value in receipt['passes']:
        assert value['observation']['settlement']==original['settlement']
        assert value['observation']['currentHeads']==[p['after'] for p in original['settlement']['participants']]
        assert value['observation']['artifact']==original['output']
    closed(dict(path=c['physicalArtifactPath'],sha256=c['physicalArtifactSha256']))
    refs=dict(receipt=dict(path=sealed['path'],sha256=sealed['sha256']),stageTerminal=stage_pin,supervisorTerminal=process_pin)
    for ref in refs.values():assert sha(ref['path'])==ref['sha256']
    assert pending_signal is None, 'outer replay interrupted before final audit completed'
    assert not members(child.pid) and (not isinstance(owned,int) or not members(owned))
    passed=True
except (AssertionError,KeyError,OSError,TypeError,ValueError) as problem:error=repr(problem)
if pending_signal is not None:outer_guard=outer_guard or f'outer replay interrupted: {pending_signal}';passed=False
terminal=dict(kind='role_read_replay',sourceCommit=c['sourceCommit'],sourceManifestSha256=c['sourceManifestSha256'],configSha256=config_pin['sha256'],
    supervisorExitCode=code,outerGuard=outer_guard,seconds=time.monotonic()-started,passed=passed,wholePipelinePassed=False,references=refs,error=error,
    remainingSupervisorGroup=members(child.pid) if child is not None else [],remainingExecutionGroup=members(owned) if isinstance(owned,int) else [],supervisorReaped=child is not None and child.returncode is not None)
write('terminal.json',terminal);print(json.dumps(terminal));raise SystemExit(0 if passed else 1)
