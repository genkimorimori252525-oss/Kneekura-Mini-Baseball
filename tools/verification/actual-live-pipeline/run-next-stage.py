"""One owned next-actor/pitch attempt with an actual supervisor-exit receipt."""
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
            if pending_signal is not None:raise InterruptedError(f'outer next interrupted: {pending_signal}')
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
    if pending_signal is not None:outer_guard=outer_guard or f'outer next interrupted: {pending_signal}'
    return child,code,outer_guard
config_path=checked(sys.argv[1]);c,config_pin=read_pin(config_path);root=checked(c['sourceRoot'])
assert c['schema']=='actual_artifact_pipeline_run_v2' and c['executionScope']=='next'
assert pathlib.Path(__file__).resolve().parent==root/'tools/verification/actual-live-pipeline', 'outer belongs to a different Source'
run=pathlib.Path(c['runDirectory']);runtime=pathlib.Path(str(run)+'.runtime');out=config_path.parent/'next-outer'
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
ancestor_pins=[*c['inheritedOfficial']['files'].values(),*c['inheritedRole']['files'].values(),*c['inheritedRole']['regressionArtifacts'].values(),*c['officialReadReplay']['files'].values()]
if 'roleReadReplay' in c:ancestor_pins += list(c['roleReadReplay']['files'].values())
assert len(ancestor_pins)==len({ref['path'] for ref in ancestor_pins})==(30 if 'roleReadReplay' in c else 24)
for ref in ancestor_pins:checked(ref['path'])
out.mkdir()
def write(name,value):
    with (out/name).open('x') as stream:json.dump(value,stream,indent=2);stream.write('\n');stream.flush();os.fsync(stream.fileno())
command=['bash',str(root/'tools/verification/actual-live-pipeline/run-pipeline.sh'),str(config_path)]
write('admission.json',dict(kind='next',sourceCommit=c['sourceCommit'],sourceManifestSha256=c['sourceManifestSha256'],config=config_pin,
    argv=command,launcherSha256=sha(__file__),availableKiB=available,scope='one complete next actor/pitch attempt with both faults, retries and reopen; no automatic retry'))
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
    assert process['executionScope']==stage['executionScope']=='next'
    assert process['wholePipelinePassed'] is False and stage['wholePipelinePassed'] is False
    assert process['guard'] is None and process['remainingOwnedProcesses']==[] and process['executingProcessReceiptValid'] is True
    audit=process['sourceInputAndReceiptAudit'];assert audit['passed'] is True
    assert stage['phaseReceipts']==audit['preservedPhaseReceipts'] and stage['inheritedStageReceipts']==audit['inheritedStageReceipts']
    assert len(stage['phaseReceipts'])==1 and stage['phaseReceipts'][0]['stage']=='03-next-actor-pitch'
    sealed=stage['phaseReceipts'][0];receipt=read_ref(sealed)
    assert receipt['schema']=='actual_artifact_stage_receipt_v1' and receipt['status']=='passed'
    expected=dict(binding=c['officialReadReplay'],sourceTransition=c['sourceTransition'],expectedObservationSha256=c.get('expectedObservationSha256'))
    assert receipt['inheritedReadReplay']==stage['inheritedReadReplay']==audit['inheritedReadReplay']==expected
    if 'roleReadReplay' in c:
        expected_role=dict(binding=c['roleReadReplay'],roleSourceTransition=c['roleSourceTransition'],expectedSettlementSha256=c['expectedSettlementSha256'])
        assert receipt['inheritedRoleReadReplay']==stage['inheritedRoleReadReplay']==audit['inheritedRoleReadReplay']==expected_role
    counts=dict(officialStarted=0,officialCompleted=0,roleStarted=0,roleCompleted=0,nextStarted=1,nextCompleted=1)
    assert receipt['counts']==stage['counts']==counts
    assert receipt['executed']==dict(helperCalls=1,newActorAdmissions=1,newPhysicalPitchActions=1,newWorkloadActivities=0)
    assert receipt['faultChecks'] is True and receipt['faultEvidence']==dict(wrongActivationRejected=True,actorReadinessAfterInsert=True)
    assert receipt['physicalWorldRecoveryProven'] is False and stage['physicalWorldRecoveryProven'] is False
    assert receipt['autonomousLineupSelection'] is False and receipt['nextBatterSelection']=='explicit_fixture_input'
    assert receipt['sourceIdentity']==stage['sourceIdentity'] and receipt['sourceIdentity']['sourceCommit']==c['sourceCommit'] and receipt['sourceIdentity']['sourceManifestSha256']==c['sourceManifestSha256']
    original=read_ref(c['inheritedOfficial']['files']['receipt']);role=read_ref(c['inheritedRole']['files']['receipt'])
    assert role['input']==original['output'] and receipt['input']==role['output']
    inherited=[dict(stage=stage_name,**c[key]['files']['receipt']) for key,stage_name in [('inheritedOfficial','01-official'),('inheritedRole','02-role-workload')]]
    assert stage['inheritedStageReceipts']==receipt['inheritedStageReceipts']==audit['inheritedStageReceipts']==inherited
    assert receipt['output']['path']==str(run/'03-next-actor-pitch.sqlite')
    assert receipt['output']['rowCounts']['world_player_workload_activities']==10 and receipt['output']['workloadActivityKinds']==[dict(kind='MATCH',n=10)]
    for table in ['physical_plate_appearance_actors','physical_pitch_progress_actions']:
        assert receipt['output']['rowCounts'][table]==role['output']['rowCounts'][table]+1
    for table in ['applications','actual_first_base_play_ends','actual_live_play_fences','actual_role_workload_assessments','actual_role_workload_settlements']:
        assert receipt['output']['rowCounts'][table]==role['output']['rowCounts'][table]
    actor=receipt['actor'];pitch=receipt['pitch'];settlement=role['settlement']
    assert actor['source']['playerId']==c['nextBatterPlayerId']=='away-2' and actor['source']['activationApplicationId']==original['applicationId']
    assert actor['origin']['scoringHash'] is None and actor['origin']['actualLiveReadiness']['closureSourceId']==original['closureSourceId']
    assert pitch['actorSourceId']==actor['source']['sourceId'] and pitch['gameId']==settlement['gameId'] and pitch['playId']==settlement['playId']+1
    assert pitch['progressRevision']==1 and pitch['source']['request']['batter']==c['nextTake']
    assert pitch['workload']==next(value['after'] for value in settlement['participants'] if value['playerId']=='p2')
    assert pitch['afterEventCount']>pitch['beforeEventCount']
    assert stage['openSqliteHandles']==[] and stage['remainingStages']==[] and stage['inheritedStages']==['official','role']
    for field in ['physicalSourceUnchanged','sourceCutUnchanged','recoveryOnlyOnIsolatedCopy']:assert stage[field] is True
    assert stage['automaticEffortGeneration'] is False and stage['elapsedWorldRecoveryTimeProven'] is False
    ancestors=[*c['inheritedOfficial']['files'].values(),*c['inheritedRole']['files'].values(),*c['inheritedRole']['regressionArtifacts'].values(),*c['officialReadReplay']['files'].values()]
    if 'roleReadReplay' in c:ancestors += list(c['roleReadReplay']['files'].values())
    assert len(ancestors)==len({ref['path'] for ref in ancestors})==(30 if 'roleReadReplay' in c else 24)
    for ref in ancestors:checked(ref['path'])
    artifacts={c['inheritedOfficial']['files']['artifact']['path'],c['inheritedRole']['files']['artifact']['path'],*[ref['path'] for ref in c['inheritedRole']['regressionArtifacts'].values()]}
    for ref in ancestors:
        if ref['path'] in artifacts:closed(ref)
        else:read_ref(ref)
    closed(receipt['output']);closed(dict(path=c['physicalArtifactPath'],sha256=c['physicalArtifactSha256']))
    refs={'terminal.json':stage_pin,'process-terminal.json':process_pin,'03-next-actor-pitch.receipt.json':dict(path=sealed['path'],sha256=sealed['sha256']),
        'output':dict(path=receipt['output']['path'],sha256=receipt['output']['sha256'])}
    for ref in refs.values():assert sha(ref['path'])==ref['sha256']
    assert pending_signal is None, 'outer next interrupted before final audit completed'
    assert not members(child.pid) and (not isinstance(owned,int) or not members(owned))
    passed=True
except (AssertionError,KeyError,OSError,TypeError,ValueError) as problem:error=repr(problem)
if pending_signal is not None:outer_guard=outer_guard or f'outer next interrupted: {pending_signal}';passed=False
terminal=dict(kind='next',sourceCommit=c['sourceCommit'],sourceManifestSha256=c['sourceManifestSha256'],configSha256=config_pin['sha256'],
    supervisorExitCode=code,outerGuard=outer_guard,seconds=time.monotonic()-started,passed=passed,wholePipelinePassed=False,references=refs,error=error,
    remainingSupervisorGroup=members(child.pid) if child is not None else [],remainingExecutionGroup=members(owned) if isinstance(owned,int) else [],supervisorReaped=child is not None and child.returncode is not None)
write('terminal.json',terminal);print(json.dumps(terminal));raise SystemExit(0 if passed else 1)
