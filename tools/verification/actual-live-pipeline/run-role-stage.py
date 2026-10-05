"""One owned all-ten role attempt with an actual supervisor-exit receipt."""
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
            if pending_signal is not None:raise InterruptedError(f'outer role interrupted: {pending_signal}')
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
    if pending_signal is not None:outer_guard=outer_guard or f'outer role interrupted: {pending_signal}'
    return child,code,outer_guard
config_path=checked(sys.argv[1]);c,config_pin=read_pin(config_path);root=checked(c['sourceRoot'])
assert c['schema']=='actual_artifact_pipeline_run_v2' and c['executionScope']=='role'
assert pathlib.Path(__file__).resolve().parent==root/'tools/verification/actual-live-pipeline', 'outer belongs to a different Source'
run=pathlib.Path(c['runDirectory']);runtime=pathlib.Path(str(run)+'.runtime');out=config_path.parent/'role-outer'
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
source_check();assert sha(__file__)==c['controlHashes']['launcher']
out.mkdir()
def write(name,value):
    with (out/name).open('x') as stream:json.dump(value,stream,indent=2);stream.write('\n');stream.flush();os.fsync(stream.fileno())
command=['bash',str(root/'tools/verification/actual-live-pipeline/run-pipeline.sh'),str(config_path)]
write('admission.json',dict(kind='role',sourceCommit=c['sourceCommit'],sourceManifestSha256=c['sourceManifestSha256'],config=config_pin,
    argv=command,launcherSha256=sha(__file__),availableKiB=available,scope='one complete role attempt with original faults and retries; no automatic retry'))
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
    assert process['status']==stage['status']=='stage_passed' and process['exitCode']==0
    assert process['executionScope']==stage['executionScope']=='role'
    assert process['wholePipelinePassed'] is False and stage['wholePipelinePassed'] is False
    assert process['guard'] is None and process['remainingOwnedProcesses']==[] and process['executingProcessReceiptValid'] is True
    audit=process['sourceInputAndReceiptAudit'];assert audit['passed'] is True
    assert stage['phaseReceipts']==audit['preservedPhaseReceipts'] and stage['inheritedStageReceipts']==audit['inheritedStageReceipts']
    assert len(stage['phaseReceipts'])==1 and stage['phaseReceipts'][0]['stage']=='02-role-workload'
    sealed=stage['phaseReceipts'][0];receipt=read_ref(sealed)
    assert receipt['schema']=='actual_artifact_stage_receipt_v1' and receipt['status']=='passed'
    expected=dict(binding=c['officialReadReplay'],sourceTransition=c['sourceTransition'],expectedObservationSha256=c.get('expectedObservationSha256'))
    assert receipt['inheritedReadReplay']==stage['inheritedReadReplay']==audit['inheritedReadReplay']==expected
    counts=dict(officialStarted=0,officialCompleted=0,roleStarted=1,roleCompleted=1,nextStarted=0,nextCompleted=0)
    assert receipt['counts']==stage['counts']==counts
    assert receipt['executed']==dict(helperCalls=1,participantSettlements=10,newMatchWorkloadActivities=10,newPhysicalPitchActions=0)
    assert receipt['faultChecks'] is True and receipt['faultEvidence']==dict(assessmentAfterInsert=True,freezeAfterInsert=True,workloadAfterInsert=True,staleCurrentHeadRejected=True,interruptedAfterFirstInsert=True)
    assert receipt['settlement']['kind']=='complete' and len(receipt['settlement']['participants'])==10 and all(p['applied'] is True for p in receipt['settlement']['participants'])
    assert receipt['sourceIdentity']==stage['sourceIdentity'] and receipt['sourceIdentity']['sourceCommit']==c['sourceCommit'] and receipt['sourceIdentity']['sourceManifestSha256']==c['sourceManifestSha256']
    original=read_ref(c['inheritedOfficial']['files']['receipt']);assert receipt['input']==original['output']
    assert receipt['output']['path']==str(run/'02-role-workload.sqlite') and receipt['output']['rowCounts']['world_player_workload_activities']==10
    assert receipt['output']['workloadActivityKinds']==[dict(kind='MATCH',n=10)]
    assert stage['openSqliteHandles']==[] and stage['remainingStages']==['next'] and stage['inheritedStages']==['official']
    for field in ['physicalSourceUnchanged','sourceCutUnchanged','recoveryOnlyOnIsolatedCopy']:assert stage[field] is True
    assert stage['automaticEffortGeneration'] is False and stage['elapsedWorldRecoveryTimeProven'] is False
    handoff,handoff_pin=read_pin(run/'role-handoff.json')
    assert handoff['schema']=='actual_role_stage_handoff_v1' and handoff['status']=='stage_passed' and handoff['wholePipelinePassed'] is False
    assert handoff['config']==config_pin and handoff['roleReceipt']==sealed and handoff['output']==receipt['output']
    assert handoff['stageTerminal']==stage_pin and handoff['supervisorTerminal']==process_pin
    assert handoff['sourceIdentity']==receipt['sourceIdentity'] and handoff['inheritedOfficial']==c['inheritedOfficial']
    assert handoff['inheritedStageReceipts']==stage['inheritedStageReceipts'] and handoff['inheritedReadReplay']==expected
    for name,ref in c['inheritedOfficial']['files'].items():
        if name=='artifact':closed(ref)
        else:read_ref(ref)
    for ref in c['officialReadReplay']['files'].values():read_ref(ref)
    closed(receipt['output'])
    for name in ['recoveryRegression','staleCasRegression']:closed(receipt[name]['disk'])
    closed(dict(path=c['physicalArtifactPath'],sha256=c['physicalArtifactSha256']))
    refs={'role-handoff.json':handoff_pin,'terminal.json':stage_pin,'process-terminal.json':process_pin}
    for ref in refs.values():assert sha(ref['path'])==ref['sha256']
    assert pending_signal is None, 'outer role interrupted before final audit completed'
    assert not members(child.pid) and (not isinstance(owned,int) or not members(owned))
    passed=True
except (AssertionError,KeyError,OSError,TypeError,ValueError) as problem:error=repr(problem)
if pending_signal is not None:outer_guard=outer_guard or f'outer role interrupted: {pending_signal}';passed=False
terminal=dict(kind='role',sourceCommit=c['sourceCommit'],sourceManifestSha256=c['sourceManifestSha256'],configSha256=config_pin['sha256'],
    supervisorExitCode=code,outerGuard=outer_guard,seconds=time.monotonic()-started,passed=passed,wholePipelinePassed=False,references=refs,error=error,
    remainingSupervisorGroup=members(child.pid) if child is not None else [],remainingExecutionGroup=members(owned) if isinstance(owned,int) else [],supervisorReaped=child is not None and child.returncode is not None)
write('terminal.json',terminal);print(json.dumps(terminal));raise SystemExit(0 if passed else 1)
