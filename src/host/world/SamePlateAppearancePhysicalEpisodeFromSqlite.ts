import { assertSamePaExactRunnerControllerOwnership } from './SamePlateAppearanceExactRunnerControllerPiece';
import { assertSamePaOccupiedRunnerCatchOwnership } from './SamePlateAppearanceOccupiedRunnerCatchResponse';
import { assertNoSamePaCatchReviewSeal } from './SamePlateAppearanceCatchReviewSeal';
import { assertSamePaBatterCatchOwnership } from './SamePlateAppearanceBatterCatchOwnership';
import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { SeedRoot } from '../../core/rng/SeedRoot';
import { resolveCanonicalPitchDelivery } from '../../core/sim/pitch/CanonicalPitchDelivery';
import { applyPitchFatigueToExecution } from '../../core/sim/pitch/PitchFatigueExecution';
import { sampleAerodynamicPitchTrajectory } from '../../core/sim/pitching/AerodynamicPitchTrajectory';
import { resolveAndRecordAerodynamicRigidPitchAgainstBatter } from '../../core/sim/pitching/AerodynamicRigidPitchAgainstBatter';
import { createRigidBatSwingWindowFromKinematicsV1 } from '../../core/sim/pitching/AerodynamicRigidBatSwingingPitchPhysicalResult';
import { NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1 } from '../../core/sim/contact/WoodBatProductionProfileV1';
import { resolveWoodBatSpeedResponse } from '../../core/sim/contact/WoodBatSpeedResponseProfile';
import { calculateBattingExecution } from '../../core/world/psychology/batting/BattingCommitment';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaReferenceValid, samePaText, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaMetadataClaim as claim } from './SamePlateAppearanceReservationGuard';
import { samePaNativeAdapterImplemented, deriveSamePaDispatchRoles } from './SamePlateAppearanceDispatchRoles';
import { readSamePaOriginalParticipants } from './SamePlateAppearanceOriginalParticipants';
import { readHistoricalSamePaExecutionView } from './SamePlateAppearanceHistoricalExecutionEvidenceFromSqlite';
import { readHistoricalSamePaLifecycleViewFromSqlite, readCurrentSamePaLifecycleViewFromSqlite, readSamePaLifecycleNextPitchBasisFromSqlite,
  readSamePaLifecycleCalibrationFromSqlite, readCurrentSamePaLifecycleCalibrationFromSqlite, withSamePaLifecycleReadPhase,
  assertSamePaLifecycleReservedStateFromSqlite, assertSamePaLifecycleWorkCoverage, readSamePaLifecycleRecordFromSqlite, memoSamePaLifecycleRead } from './SamePlateAppearanceLifecycleFromSqlite';
import { readSamePaContinuationOriginalPitchFromSqlite } from './SamePlateAppearanceContinuationFromSqlite';
import { readPlayerPitchTimingPrefixFromSqlite, selectPlayerPitchTimingProfileFromSqlitePrefix, assertCurrentPlayerPitchTimingPrefixFromSqlite } from './SqlitePlayerPitchTimingStore';
import { readPlayerReleaseGeometryPrefixFromSqlite, assertCurrentPlayerReleaseGeometryPrefixFromSqlite } from './SqlitePlayerReleaseGeometryStore';
import { readPitchFatiguePolicyFromSqlite } from './SqlitePitchFatiguePolicyStore';
import { playerBattingModelEvidenceFromSqlite } from './PlayerBattingModelEvidence';
import { readSamePaBattingExecutionInputFromSqlite, readCurrentSamePaBattingExecutionInputFromSqlite, readSamePaBattingIntentFromSqlite } from './SqliteBattingExecutionInputStore';
import { readBattingPerceptionFromSqlite } from './SqliteBattingPerceptionStore';
import { readEmotionWorldRevisionFromSqlite, readHistoricalEmotionWorldRevisionFromSqlite } from './EmotionWorldRevisionFromSqlite';
import { battingInvocationTransaction } from './BattingInvocationTransaction';
import { physicalEpisodeTables as tables, samePaPhysicalEpisodeSchema as schemas, assertSamePaPhysicalEpisodeStorage as storage, type SamePaPhysicalTableKind } from './SamePlateAppearancePhysicalEpisodeStorage';
import { samePaPhysicalEpisodeSourceInput as input, samePaPhysicalOperationOwners, type SamePaPhysicalEpisodeSource as Source,
  type SamePaPhysicalEpisodeRecord as RecordValue, type SamePaPhysicalOperation, type SamePaPhysicalOperationReference, type SamePaPhysicalOperationProof,
  type SamePaPhysicalAction, type SamePaPhysicalRight, type SamePaPhysicalLaunch, type SamePaPhysicalCommitment, type SamePaPhysicalResolution, type SamePaPhysicalFieldCalibration } from './SamePlateAppearancePhysicalEpisode';
import { deriveSamePaPhysicalFieldRoot, deriveSamePaPhysicalFieldStep } from './SamePlateAppearancePhysicalFieldCalculation';
import { deriveSamePaPhysicalFieldCalibration } from './SamePlateAppearancePhysicalFieldCalibration';
import { deriveSamePaPhysicalFieldAction } from './SamePlateAppearancePhysicalFieldActionFromSqlite';
import { assertSamePaPhysicalThrowOwnership, samePaPhysicalHasThrowRelease } from './SamePlateAppearancePhysicalFieldThrow';
import { samePaBuntProfileAvailable } from './SamePlateAppearanceBuntProfile';

type Kind = Exclude<SamePaPhysicalTableKind, 'head' | 'consumer' | 'consumption' | 'admission'>;
type Pending = Readonly<{ kind: 'pending'; reason: string; missingSourceIds: readonly string[] }>;
const pending = (reason: string, ids: readonly string[] = []): Pending => freeze({ kind: 'pending', reason, missingSourceIds: ids });
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('same-PA physical original input, cut or row differs'); };
const required = <T>(v: T | null, message = 'same-PA physical prerequisite missing'): T => { if (v === null) throw new Error(message); return v; };
const ownerKinds = { same_pa_physical_action_v1: 'action', same_pa_physical_right_v1: 'right', same_pa_physical_launch_v1: 'launch',
  same_pa_physical_cut_v1: 'cut', same_pa_physical_commitment_v1: 'commitment', same_pa_physical_resolution_v1: 'resolution',
  same_pa_physical_field_root_v1: 'fieldRoot', same_pa_physical_field_step_v1: 'fieldStep', same_pa_physical_field_calibration_v1:'fieldCalibration' } as const;
const kindOf = (source: Source): Kind => ownerKinds[source.capability];
const kindForOwner = (owner: string): Kind => {
  const entry = Object.entries(tables).find(([, name]) => name === owner);
  if (!entry || ['head', 'consumer', 'consumption', 'admission'].includes(entry[0])) throw new Error('physical original owner differs');
  return entry[0] as Kind;
};
const names = Object.values(tables), archiveTables = names.filter(name => name !== tables.head);
const work = (kind: Kind) => kind !== 'action' && kind !== 'right' && kind !== 'fieldCalibration';
// Only this owner's exact append proof may observe its own transient row/head
// interval. The marker is private, synchronous, and removed before the proof
// ends; ordinary historical readers always require a complete committed tail.
const stagedHeads = new WeakMap<DatabaseSync, Readonly<{ enrollment: string; head: unknown }>>();
const canonical = (value: RecordValue) => json([value.lineage.enrollmentReference, value.pitchOrdinal,
  !work(kindOf(value.source)) ? value.source.viewReference : value.operationOrdinal]);
const rowFor = (value: RecordValue): Record<string, string | number> => ({ source_id: value.source.sourceId, source_version: value.source.sourceVersion,
  enrollment_source_id: value.lineage.enrollmentReference.sourceId, career_id: value.lineage.careerId, game_id: value.lineage.gameId, play_id: value.lineage.playId,
  physical_pitch_source_id: value.physicalPitchSourceId, pitch_ordinal: value.pitchOrdinal, operation_ordinal: value.operationOrdinal, view_source_id: value.source.viewReference.sourceId,
  previous_owner: 'previousOperationReference' in value.source ? value.source.previousOperationReference.owner : '',
  previous_source_id: 'previousOperationReference' in value.source ? value.source.previousOperationReference.sourceId : '',
  canonical_key: canonical(value), source_json: json(value.source), source_hash: hash(value.source), snapshot_json: json(value), snapshot_hash: hash(value) });
const assertNoMissingTypedClaims=(db:DatabaseSync,owner:string,id:string)=>{
  const candidates=db.prepare("SELECT name FROM main.sqlite_master WHERE type='table' AND (name GLOB 'pa_physical_v1_*' OR name GLOB 'pa_lifecycle_v1_*' OR name GLOB 'batting_*' OR name GLOB 'pa_terminal_v1_*')").all();
  for(const candidate of candidates){const name=String(candidate.name).replaceAll('"','""'),columns=db.prepare('PRAGMA main.table_info("'+name+'")').all().map(r=>r.name);
    for(const column of ['source_json','snapshot_json'].filter(c=>columns.includes(c)))if(db.prepare(`SELECT 1 FROM main."${name}",json_tree(CASE WHEN json_valid(${column}) THEN ${column} ELSE 'null' END) j
      WHERE j.type='object' AND EXISTS(SELECT 1 FROM json_each(j.value) o WHERE o.key='owner' AND o.atom=$owner)
      AND EXISTS(SELECT 1 FROM json_each(j.value) i WHERE i.key='sourceId' AND i.atom=$id) LIMIT 1`).get({owner,id}))throw new Error('physical original owner missing with typed descendants; repair forbidden');}
};
const identityRow = (db: DatabaseSync, table: string, id: string) => {
  if (!storage(db)){assertNoMissingTypedClaims(db,table,id);return null;}
  const rows = archiveTables.flatMap(name => db.prepare(`SELECT * FROM main.${name} WHERE source_id=$id OR ${claim('source_json', ['sourceId'], '$id')}
    OR ${claim('snapshot_json', ['source','sourceId'], '$id')}`).all({ id }).map(row => ({ table: name, row })));
  if (rows.length > 1 || rows.length === 1 && (rows[0].table !== table || rows[0].row.source_id !== id)) throw new Error('physical Source identity aliased');
  if (!rows.length) {
    assertNoMissingTypedClaims(db,table,id);
    if (db.prepare(`SELECT 1 FROM main.${tables.head} WHERE last_source_id=? OR launch_source_id=?`).get(id, id)) throw new Error('physical Source missing with head claim; repair forbidden');
    for (const name of archiveTables) if (db.prepare(`SELECT 1 FROM main.${name} WHERE (previous_owner=$owner AND previous_source_id=$id)
      ${name === tables.action || name === tables.right || name === tables.fieldCalibration ? '' : 'OR (physical_pitch_source_id=$id AND $owner=\'pa_physical_v1_launches\')'}
      OR EXISTS(SELECT 1 FROM json_tree(CASE WHEN json_valid(source_json) THEN source_json ELSE 'null' END) j WHERE j.type='object'
        AND EXISTS(SELECT 1 FROM json_each(j.value) o WHERE o.key='owner' AND o.atom=$owner)
        AND EXISTS(SELECT 1 FROM json_each(j.value) i WHERE i.key='sourceId' AND i.atom=$id)) LIMIT 1`).get({ owner: table, id })) {
      throw new Error('physical Source missing with descendants; repair forbidden');
    }
  }
  return rows[0]?.row ?? null;
};
const headFor = (value: SamePaPhysicalOperation) => ({ enrollment_source_id: value.lineage.enrollmentReference.sourceId, career_id: value.lineage.careerId,
  game_id: value.lineage.gameId, play_id: value.lineage.playId, pitch_ordinal: value.pitchOrdinal, launch_source_id: value.physicalPitchSourceId,
  operation_ordinal: value.operationOrdinal, last_owner: tables[kindOf(value.source)], last_source_id: value.source.sourceId, last_snapshot_hash: hash(value) });
const head = (db: DatabaseSync, enrollment: string) => storage(db) ? db.prepare(`SELECT * FROM main.${tables.head} WHERE enrollment_source_id=?`).get(enrollment) ?? null : null;
const metadata = (db: DatabaseSync, enrollment: string) => storage(db) ? samePaPhysicalOperationOwners.flatMap(table => db.prepare(`SELECT source_id,enrollment_source_id,career_id,game_id,play_id,
  physical_pitch_source_id,pitch_ordinal,operation_ordinal,previous_owner,previous_source_id,snapshot_hash FROM main.${table}
  WHERE enrollment_source_id=$id OR ${claim('snapshot_json',['lineage','enrollmentReference','sourceId'],'$id')}`).all({ id: enrollment }).map(row => ({ table, row })))
  .sort((a,b) => Number(a.row.pitch_ordinal) - Number(b.row.pitch_ordinal) || Number(a.row.operation_ordinal) - Number(b.row.operation_ordinal)) : [];
const assertHead = (db: DatabaseSync, enrollment: string) => {
  const rows = metadata(db,enrollment), h = head(db,enrollment); if (!rows.length) {
    same(h,null);
    if(storage(db))for(const role of ['consumer','consumption','admission'] as const)if(db.prepare(`SELECT 1 FROM main.${tables[role]} WHERE enrollment_source_id=$id
      OR ${claim('snapshot_json',['lineage','enrollmentReference','sourceId'],'$id')} LIMIT 1`).get({id:enrollment}))throw new Error('physical partial launch companions; repair forbidden');
    return;
  }
  let pitch = 2, ordinal = -1, previous: typeof rows[number] | null = null;
  for (const value of rows) { const r=value.row;
    if (r.enrollment_source_id !== enrollment) throw new Error('physical moved enrollment claim');
    if (value.table === tables.launch) { if (r.pitch_ordinal !== pitch+1 || r.operation_ordinal !== 0 || r.source_id !== r.physical_pitch_source_id || r.previous_owner !== '' || r.previous_source_id !== '') throw new Error('physical launch rank differs'); pitch++; ordinal=0; }
    else { if (!previous || r.pitch_ordinal !== pitch || r.operation_ordinal !== ++ordinal || r.previous_owner !== previous.table || r.previous_source_id !== previous.row.source_id
      || r.physical_pitch_source_id !== previous.row.physical_pitch_source_id) throw new Error('physical operation rank differs'); }
    previous=value;
  }
  const last=rows.at(-1)!; same(h,{ enrollment_source_id: enrollment,career_id:last.row.career_id,game_id:last.row.game_id,play_id:last.row.play_id,
    pitch_ordinal:last.row.pitch_ordinal,launch_source_id:last.row.physical_pitch_source_id,operation_ordinal:last.row.operation_ordinal,last_owner:last.table,last_source_id:last.row.source_id,last_snapshot_hash:last.row.snapshot_hash });
  const launches=rows.filter(r=>r.table===tables.launch);
  for(const role of ['consumer','consumption','admission'] as const){
    const companions=db.prepare(`SELECT * FROM main.${tables[role]} WHERE enrollment_source_id=$id OR ${claim('snapshot_json',['lineage','enrollmentReference','sourceId'],'$id')} ORDER BY pitch_ordinal`).all({id:enrollment});
    same(companions,launches.map(r=>{
      const raw=required(identityRow(db,tables.launch,String(r.row.source_id)));
      return launchCompanion(JSON.parse(String(raw.snapshot_json)) as SamePaPhysicalLaunch,role);
    }));
  }
};
const normalizeCore = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const launchCompanion = (value: SamePaPhysicalLaunch, role: 'consumer'|'consumption'|'admission') => {
  const s={sourceId:'same-pa-physical:'+role+':'+hash(value.source),sourceVersion:'same-pa-physical-v1',capability:'same_pa_physical_'+role+'_v1',
    launchSourceReference:{sourceId:value.source.sourceId,sourceVersion:value.source.sourceVersion,sourceHash:hash(value.source)},viewReference:value.source.viewReference};
  const receipt={kind:s.capability,source:s,lineage:value.lineage,pitchOrdinal:value.pitchOrdinal,physicalPitchSourceId:value.physicalPitchSourceId,launchReference:role==='consumer'?null:reference(tables.launch,value)};
  return {...rowFor(value),source_id:s.sourceId,source_version:s.sourceVersion,canonical_key:json([value.lineage.enrollmentReference,value.pitchOrdinal,role]),source_json:json(s),source_hash:hash(s),snapshot_json:json(receipt),snapshot_hash:hash(receipt)};
};
const commitmentWorldEvent=(value:SamePaPhysicalCommitment)=>({kind:'SAME_PA_EFFECTIVE_BATTING_COMMITMENT_V1',reference:reference(tables.commitment,value),beforeWorldRevision:value.beforeWorldRevision,afterWorldRevision:value.afterWorldRevision,actionKey:value.actionKey});

const assembly = <T>(db: DatabaseSync, body: (own: { read(kind: Kind,id: string): RecordValue|null; derive(source: Source,current: boolean): RecordValue|Pending }) => T): T =>
withSamePaLifecycleReadPhase(db, () => {
  const linked = (kind: Kind, ref: SamePaReference): RecordValue => { if (!samePaReferenceValid(ref,tables[kind])) throw new Error('physical owner ref differs');
    const value=required(read(kind,ref.sourceId)); same(reference(tables[kind],value),ref); return value; };
  const actionInputs = (source: Extract<Source,{capability:'same_pa_physical_action_v1'}>,current: boolean) => {
    const basis=readSamePaLifecycleNextPitchBasisFromSqlite(db,source.viewReference,current?'current':'historical');
    if (basis.kind !== 'ready') return basis;
    if (basis.nextPitchOrdinal < 3 || basis.timeline.status.kind !== 'active' || source.nominalPitch.delivery.readyAtUs < Math.max(basis.bodyCut.completedAtTick,basis.view.cut.evaluationTick)) throw new Error('physical next action precedes owned readiness');
    const actor=basis.actor, timing=readPlayerPitchTimingPrefixFromSqlite(db,source.timingReference), timingProfile=selectPlayerPitchTimingProfileFromSqlitePrefix(db,source.timingReference,actor.binding.gameDay);
    const release=readPlayerReleaseGeometryPrefixFromSqlite(db,source.releaseReference), geometry=release.changes.filter(c=>c.effectiveDay<=actor.binding.gameDay).at(-1)??release.baseline;
    const policy=readPitchFatiguePolicyFromSqlite(db,source.pitchResponseReference), models=playerBattingModelEvidenceFromSqlite(db), model=required(models.read(source.batterModelReference.sourceId));
    same(reference('world_player_batting_models',model),source.batterModelReference);
    // The lifecycle basis already authenticates this completed first pitch.
    // Reuse it only inside the enclosing immutable continuation proof.
    const original=readSamePaContinuationOriginalPitchFromSqlite(db,{owner:'pa_dispatch_v1_pitch_actions',sourceId:basis.view.lineage.firstPhysicalPitchSourceId,
      ...(() => { const row=db.prepare('SELECT source_hash,snapshot_hash FROM main.pa_dispatch_v1_pitch_actions WHERE source_id=?').get(basis.view.lineage.firstPhysicalPitchSourceId); if(!row)throw new Error('original pitch missing'); return {sourceHash:String(row.source_hash),snapshotHash:String(row.snapshot_hash)}; })()});
    for(const key of ['timingReference','releaseReference','pitchResponseReference','batterModelReference'] as const) same(source[key],original.action.source[key]);
    for(const key of ['matchSeed','outingId','moundReference'] as const) same(source.nominalPitch.delivery[key],original.action.source.nominalPitch.delivery[key]);
    if(current){assertCurrentPlayerPitchTimingPrefixFromSqlite(db,source.timingReference,actor.binding.gameDay);assertCurrentPlayerReleaseGeometryPrefixFromSqlite(db,source.releaseReference,actor.binding.gameDay);same(models.selectAtDay(actor.binding.careerId,actor.binding.playerId,actor.binding.gameDay),model);}
    if(source.nominalPitch.batter.ballRadiusMeters!==model.equipment.values.ball.radiusM
      ||source.actualFlightParameters.aerodynamics.ballRadiusM!==model.equipment.values.ball.radiusM
      ||source.actualFlightParameters.aerodynamics.ballMassKg!==model.equipment.values.ball.massKg
      )throw new Error('physical original equipment differs');
    return {kind:'ready' as const,basis,timing,timingProfile,geometry,policy,model,original};
  };
  const derive = (source: Source,current: boolean): RecordValue|Pending => {
    if(current){const b=readHistoricalSamePaLifecycleViewFromSqlite(db,source.viewReference);assertNoSamePaCatchReviewSeal(db,b.view.lineage.gameId,b.view.lineage.playId);}
    if(source.capability==='same_pa_physical_action_v1'){
      const x=actionInputs(source,current);if(x.kind!=='ready')return pending(x.reason);
      const b=x.basis;return freeze({kind:'same_pa_physical_action_prepared_v1',source,lineage:b.view.lineage,pitchOrdinal:b.nextPitchOrdinal,operationOrdinal:0,evaluationTick:b.view.cut.evaluationTick,
        physicalPitchSourceId:source.physicalPitchSourceId,viewReference:source.viewReference,timeline:b.timeline,actor:b.actor,physicalWorld:b.physicalWorld,baseCenters:b.baseCenters,bodyCut:b.bodyCut,
        previousPitchReference:b.previousPitchReference,outcomeReference:b.outcomeReference,nominalTimingHash:hash(x.timingProfile),nominalReleaseHash:hash(x.geometry),nominalBattingModelHash:hash(x.model)});
    }
    if(source.capability==='same_pa_physical_field_calibration_v1'){
      const action=linked('action',source.actionReference) as SamePaPhysicalAction;
      const x=actionInputs(action.source,current);if(x.kind!=='ready')return pending(x.reason);
      const posture=readBattingPerceptionFromSqlite(db,'posture',source.postureReference);if(posture.kind!=='batting_invocation_posture')throw new Error('field calibration posture missing');
      const calibration=deriveSamePaPhysicalFieldCalibration(db,source,action,posture);
      return freeze({kind:'same_pa_physical_field_calibration_prepared_v1',source,lineage:action.lineage,pitchOrdinal:action.pitchOrdinal,operationOrdinal:0,evaluationTick:action.evaluationTick,
        physicalPitchSourceId:action.physicalPitchSourceId,viewReference:source.viewReference,timeline:action.timeline,calibration});
    }
    if(source.capability==='same_pa_physical_right_v1'){
      const action=linked('action',source.actionReference) as SamePaPhysicalAction;same(action.source.viewReference,source.viewReference);
      const x=actionInputs(action.source,current);if(x.kind!=='ready')return pending(x.reason);
      const posture=readBattingPerceptionFromSqlite(db,'posture',source.postureReference);
      if(posture.kind!=='batting_invocation_posture'||posture.source.capability!=='owned_in_flight_batting_posture_v1')throw new Error('physical right requires its original in-flight posture');
      same(posture.source.actionReference,source.actionReference);same(posture.source.viewReference,source.viewReference);same(posture.lineage,action.lineage);
      same(posture.source.member,x.basis.members.find(m=>m.playerId===action.actor.binding.playerId));same(posture.source.modelReference,action.source.batterModelReference);
      const g=posture.source.geometry,ready=action.source.nominalPitch.delivery.readyAtUs;
      if(posture.physicalPitchSourceId!==action.physicalPitchSourceId||g.startedAtTick!==action.bodyCut.completedAtTick||g.bodyReadyTick>ready||ready>g.validUntilTick)throw new Error('physical right per-pitch body readiness differs');
      const old=readHistoricalSamePaExecutionView(db,x.original.pitch.viewReference).view,roles=deriveSamePaDispatchRoles(x.basis.actor,old,
        x.basis.actor.world.runners.length?readSamePaOriginalParticipants(db,x.basis.actor):undefined);
      if(source.participantInputs.length!==roles.length)throw new Error('physical exact participant input set differs');
      for(const [i,role]of roles.entries()){const p=source.participantInputs[i],member=x.basis.members.find(m=>m.playerId===role.member.playerId)!;same(p.member,member);same(p.calibrationReferences.map(r=>r.route),role.routes);
        for(const r of p.calibrationReferences){if(!samePaNativeAdapterImplemented(r.route))return pending('required_native_adapter_missing');
          const c=(current?readCurrentSamePaLifecycleCalibrationFromSqlite:readSamePaLifecycleCalibrationFromSqlite)(db,r.calibrationReference);same(c.source.member,member);same(c.source.viewReference,source.viewReference);same(c.source.route,r.route);}}
      return freeze({kind:'same_pa_physical_right_prepared_v1',source,lineage:action.lineage,pitchOrdinal:action.pitchOrdinal,operationOrdinal:0,evaluationTick:action.evaluationTick,
        physicalPitchSourceId:action.physicalPitchSourceId,viewReference:source.viewReference,timeline:action.timeline});
    }
    if(source.capability==='same_pa_physical_launch_v1'){
      const action=linked('action',source.actionReference) as SamePaPhysicalAction,right=linked('right',source.rightReference) as SamePaPhysicalRight;
      same(right.source.actionReference,source.actionReference);same(source.viewReference,action.source.viewReference);if(source.sourceId!==action.physicalPitchSourceId)throw new Error('physical prospective identity differs');
      const checked=derive(right.source,current);if(checked.kind==='pending')return checked;same(checked,right);
      const x=actionInputs(action.source,current);if(x.kind!=='ready')return pending(x.reason);
      const player=x.basis.physicalWorld.defenders.find(d=>d.registeredPosition==='P')!.playerId,p=right.source.participantInputs.find(p=>p.member.playerId===player)!;
      const pin=p.calibrationReferences.find(r=>r.route==='pitch_delivery')!,calibration=(current?readCurrentSamePaLifecycleCalibrationFromSqlite:readSamePaLifecycleCalibrationFromSqlite)(db,pin.calibrationReference);
      if(calibration.source.route!=='pitch_delivery')throw new Error('physical pitch route differs');same(calibration.source.nominalReference,action.source.timingReference);same(calibration.source.response.policyReference,action.source.pitchResponseReference);
      const state=x.basis.view.participants.find(p=>p.playerId===player)!,nominal=action.source.nominalPitch,{sourceId:_id,sourceVersion:_version,...policy}=x.policy;
      const effective=applyPitchFatigueToExecution(x.timingProfile,nominal.delivery.physics,state.projectedState.fatigue,policy,x.basis.actor.binding.gameDay);
      const delivery=resolveCanonicalPitchDelivery({root:new SeedRoot(nominal.delivery.matchSeed),outingId:nominal.delivery.outingId,playId:action.lineage.playId,pitchIndex:action.pitchOrdinal-1,
        readyAtUs:nominal.delivery.readyAtUs,timingProfile:effective.timingProfile,timingIntent:nominal.delivery.timingIntent,
        body:{...x.geometry.body,moundReference:nominal.delivery.moundReference},releaseProfile:x.geometry.profile,physics:effective.physics});
      const trajectory={start:{tick:delivery.release.releaseAtUs,position:delivery.release.position,velocity:delivery.release.velocity,spin:delivery.release.spin},
        endTick:delivery.release.releaseAtUs+nominal.flight.durationUs,parameters:action.source.actualFlightParameters};
      const posture=readBattingPerceptionFromSqlite(db,'posture',right.source.postureReference);
      if(posture.kind!=='batting_invocation_posture'||trajectory.endTick>posture.source.geometry.validUntilTick||delivery.timeline.followThroughEndUs>posture.source.geometry.validUntilTick)throw new Error('physical launch exceeds owned body/posture readiness');
      sampleAerodynamicPitchTrajectory(trajectory,trajectory.start.tick);
      return freeze({kind:'same_pa_physical_launch_v1',stage:'in_flight',source,lineage:action.lineage,pitchOrdinal:action.pitchOrdinal,operationOrdinal:0,evaluationTick:trajectory.start.tick,
        physicalPitchSourceId:source.sourceId,viewReference:source.viewReference,timeline:action.timeline,delivery,trajectory,pitcherMember:p.member,reservedPitcherStateHash:hash(state.reservedState),projectedPitcherStateHash:hash(state.projectedState)});
    }
    const launch=linked('launch',source.launchReference) as SamePaPhysicalLaunch,action=linked('action',launch.source.actionReference) as SamePaPhysicalAction;
    const previous=linked(kindForOwner(source.previousOperationReference.owner),source.previousOperationReference) as SamePaPhysicalOperation;
    if(!work(kindOf(previous.source))||previous.physicalPitchSourceId!==launch.source.sourceId||previous.pitchOrdinal!==launch.pitchOrdinal)throw new Error('physical previous operation belongs to another episode');
    const b=(current?readCurrentSamePaLifecycleViewFromSqlite:readHistoricalSamePaLifecycleViewFromSqlite)(db,source.viewReference);
    // An outcome keeps the old physical predecessor for evidence; it does not
    // authorize reopening that episode. A new launch has its own arm above.
    if(b.view.cut.outcomeReference!==null||b.view.cut.resetReference!==null
      ||['foul_official_pending','foul_reset_ready','terminal'].includes(b.view.cut.stage))throw new Error('physical continuation cannot reopen an owned outcome or reset');
    same(b.view.lineage,launch.lineage);same(b.view.cut.physicalPitchReference,source.launchReference);
    same(b.view.cut.physicalOperationReference,source.previousOperationReference);
    same(b.view.cut.bodyCut,action.bodyCut);
    if(b.view.cut.evaluationTick<previous.evaluationTick)throw new Error('physical operation view backdates preceding work');
    const common={source,lineage:launch.lineage,pitchOrdinal:launch.pitchOrdinal,operationOrdinal:previous.operationOrdinal+1,evaluationTick:b.view.cut.evaluationTick,
      physicalPitchSourceId:launch.source.sourceId,viewReference:source.viewReference,timeline:previous.timeline};
    const commitmentInPrefix=():SamePaPhysicalCommitment|null=>{let p:SamePaPhysicalOperation=previous;for(;;){if(p.kind==='same_pa_physical_commitment_v1')return p;
      if(!('previousOperationReference'in p.source))return null;const r=p.source.previousOperationReference;p=linked(kindForOwner(r.owner),r) as SamePaPhysicalOperation;}};
    if(source.capability==='same_pa_physical_cut_v1'){
      if(!['in_flight','committed'].includes(previous.stage)||source.throughTick<=b.view.cut.evaluationTick||source.throughTick>launch.trajectory.endTick)throw new Error('physical cut is stale or outside the owned trajectory');
      const commitment=commitmentInPrefix(),boundary=resolve(action,launch,commitment);
      // Before adoption the plate crossing bounds the open sensory interval.
      // This calculation does not append a TAKE/count result; it prevents an
      // advance Source from silently crossing a due physical event.
      if(boundary.kind!=='unresolved'&&source.throughTick>boundary.timeline.lastEventTick)throw new Error('physical cut crosses a due event');
      return freeze({...common,source,kind:'same_pa_physical_cut_v1',stage:commitment?'committed':'in_flight',evaluationTick:source.throughTick,ball:sampleAerodynamicPitchTrajectory(launch.trajectory,source.throughTick)});
    }
    if(source.capability==='same_pa_physical_commitment_v1'){
      if(action.source.battingMode!=='observer_decision'||previous.stage!=='in_flight'||commitmentInPrefix())throw new Error('physical commitment is already owned or not applicable');
      const request=(current?readCurrentSamePaBattingExecutionInputFromSqlite:readSamePaBattingExecutionInputFromSqlite)(db,source.inputReference);
      if(request.source.capability!=='owned_in_flight_same_pa_batting_execution_input_v1')throw new Error('physical adoption requires the original in-flight input Source');
      same(request.source.viewReference,source.viewReference);same(request.physicalPitchReference,source.launchReference);same(request.source.intentReference,source.intentReference);
      const right=linked('right',launch.source.rightReference) as SamePaPhysicalRight;same(request.source.postureReference,right.source.postureReference);
      const intent=readSamePaBattingIntentFromSqlite(db,source.intentReference);same(intent.lineage,launch.lineage);if(intent.originalIntent.actorSourceId!==action.actor.source.sourceId)throw new Error('physical original batting intent differs');
      const computed=calculateBattingExecution({nominalRequest:request.nominalRequest,effectiveValues:request.effectiveValues});if(!computed.ok)throw new Error('physical effective batting calculation invalid');
      const calculation=computed.value,commitment=calculation.commitment;if(calculation.status!=='READY'||!commitment)return pending('effective_batting_commitment_not_ready');
      if(!samePaBuntProfileAvailable(source.buntProfileBinding,{intentReference:source.intentReference,originalIntent:intent.originalIntent,input:request,
        modelReference:action.source.batterModelReference,calculation}))return pending('owned_bunt_physical_profile_required');
      if(commitment.decisionTick!==b.view.cut.evaluationTick||commitment.action==='SWING'&&(!commitment.trajectory||commitment.trajectory.startTick<b.view.cut.evaluationTick||commitment.trajectory.endTick>launch.trajectory.endTick))throw new Error('physical commitment timing differs');
      const world=current?readEmotionWorldRevisionFromSqlite(db,b.view.lineage.careerId):readHistoricalEmotionWorldRevisionFromSqlite(db,b.view.lineage.careerId,request.nominalRequest.currentFrame.worldRevision);
      if(!world)return pending('actual_world_head_missing');same(world.head.worldRevision,request.nominalRequest.currentFrame.worldRevision);
      const value:SamePaPhysicalCommitment=freeze({...common,source,kind:'same_pa_physical_commitment_v1',stage:'committed',commitment,calculation,inputSource:request.source,originalIntent:intent.originalIntent,
        beforeWorldRevision:world.head.worldRevision,afterWorldRevision:world.head.worldRevision+1,controlRevision:world.head.control.revision,controlHash:hash(world.head.control),
        actionKey:json(['same-pa-effective-commitment-v1',launch.lineage.enrollmentReference,source.launchReference])});
      const physical=resolve(action,launch,value);if(physical.kind!=='unresolved'&&physical.timeline.lastEventTick<value.evaluationTick)throw new Error('physical commitment cannot adopt an already elapsed outcome');return value;
    }
    if(source.capability==='same_pa_physical_resolution_v1'){
      if(!['in_flight','committed'].includes(previous.stage))throw new Error('physical episode already resolved');
      const commitment=commitmentInPrefix();if(action.source.battingMode==='observer_decision'&&!commitment)return pending('owned_batting_commitment_missing');
      same(source.commitmentReference,commitment?reference(tables.commitment,commitment):null);
      const resolution=resolve(action,launch,commitment);if(resolution.kind==='unresolved')return pending('pitch_did_not_reach_plate');
      const due=resolution.timeline.lastEventTick;
      if(source.throughTick>launch.trajectory.endTick)throw new Error('physical resolution horizon exceeds accepted trajectory');
      if(due<b.view.cut.evaluationTick)throw new Error('physical due event was skipped');
      if(source.throughTick<due)return pending('owned_physical_event_not_yet_due');
      const event=resolution.timeline.events.slice(launch.timeline.events.length).find(e=>e.kind==='BatBallContact');
      return freeze({...common,source,kind:'same_pa_physical_resolution_v1',stage:'resolved',evaluationTick:due,timeline:resolution.timeline,resolution,contact:event?.kind==='BatBallContact'?event.payload.contact:null});
    }
    if(source.capability==='same_pa_physical_field_root_v1'){
      const resolution=linked('resolution',source.resolutionReference) as SamePaPhysicalResolution;same(source.previousOperationReference,source.resolutionReference);
      const right=linked('right',launch.source.rightReference) as SamePaPhysicalRight;same(source.postureReference,right.source.postureReference);
      const calibration=source.fieldInputs.kind==='fresh_physical_field_calibration_v1'?linked('fieldCalibration',source.fieldInputs.calibrationReference) as SamePaPhysicalFieldCalibration:null;
      if(calibration){same(calibration.source.actionReference,launch.source.actionReference);same(calibration.source.postureReference,source.postureReference);same(calibration.lineage,launch.lineage);}
      const result=deriveSamePaPhysicalFieldRoot(db,source,{launch,action,resolution,currentView:b.view,commitment:commitmentInPrefix(),calibration});
      return freeze({...common,source,kind:'same_pa_physical_field_root_v1',stage:'field',...result});
    }
    const root=linked('fieldRoot',source.fieldRootReference);if(root.kind!=='same_pa_physical_field_root_v1')throw new Error('physical field root kind differs');
    same(source.previousFieldReference,source.previousOperationReference);if(previous.kind!=='same_pa_physical_field_root_v1'&&previous.kind!=='same_pa_physical_field_step_v1')throw new Error('physical field predecessor differs');
    const prefix:(typeof root|typeof previous)[]=[];let value=previous;
      for(;;){prefix.unshift(value);if(value.kind==='same_pa_physical_field_root_v1')break;
        same(value.source.fieldRootReference,source.fieldRootReference);const ref=value.source.previousFieldReference;
        const prior=linked(kindForOwner(ref.owner),ref);if(prior.kind!=='same_pa_physical_field_root_v1'&&prior.kind!=='same_pa_physical_field_step_v1')throw new Error('physical field action prefix differs');value=prior;}
    assertSamePaExactRunnerControllerOwnership(source,prefix);
    assertSamePaPhysicalThrowOwnership(source,prefix);
    assertSamePaBatterCatchOwnership(source,prefix);
    assertSamePaOccupiedRunnerCatchOwnership(source,prefix);
    if(source.action){
      const result=deriveSamePaPhysicalFieldAction(db,source,root,previous,action,b,prefix,current);
      return freeze({...common,source,kind:'same_pa_physical_field_step_v1',stage:'field',...result});
    }
    return freeze({...common,source,kind:'same_pa_physical_field_step_v1',stage:'field',...deriveSamePaPhysicalFieldStep(source,root,previous,b.view.cut.evaluationTick,!samePaPhysicalHasThrowRelease(prefix))});
  };
  const resolve=(action:SamePaPhysicalAction,launch:SamePaPhysicalLaunch,commitment:SamePaPhysicalCommitment|null)=>normalizeCore(commitment?.commitment.action==='SWING'
    ?resolveAndRecordAerodynamicRigidPitchAgainstBatter(launch.timeline,{action:{kind:'swing',swing:createRigidBatSwingWindowFromKinematicsV1(commitment.commitment.trajectory!,commitment.calculation.nominalRequest.source.batPhysical)},
      trajectory:launch.trajectory,ball:commitment.calculation.nominalRequest.source.ball,parameterResolver:k=>resolveWoodBatSpeedResponse(NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1,k.normalApproachSpeedMps)})
    :resolveAndRecordAerodynamicRigidPitchAgainstBatter(launch.timeline,{action:{kind:'take'},trajectory:launch.trajectory,plateZ:action.source.nominalPitch.batter.plateZ,
      strikeZone:action.source.nominalPitch.batter.strikeZone,ballRadiusMeters:action.source.nominalPitch.batter.ballRadiusMeters}));
  const read=(kind:Kind,id:string):RecordValue|null=>memoSamePaLifecycleRead(db,'physical:record:'+kind+':'+id,()=>{
      const row=identityRow(db,tables[kind],id);if(!row)return null;const source=input(JSON.parse(String(row.source_json)),id);if(kindOf(source)!==kind)throw new Error('physical Source kind differs');
      const value=derive(source,false);if(value.kind==='pending')throw new Error('accepted physical record lost prerequisite');same(row,rowFor(value));
      if(value.kind==='same_pa_physical_launch_v1')for(const role of ['consumer','consumption','admission'] as const){const expected=launchCompanion(value,role);same(identityRow(db,tables[role],String(expected.source_id)),expected);}
      if(value.kind==='same_pa_physical_commitment_v1'){const event=commitmentWorldEvent(value);same(db.prepare('SELECT * FROM main.world_decision_revision_events WHERE career_id=? AND world_revision=?').get(value.lineage.careerId,value.afterWorldRevision),
        {career_id:value.lineage.careerId,world_revision:value.afterWorldRevision,source_kind:event.kind,source_event_id:value.source.sourceId,event_json:json(event)});}
      return value;
    });
  return body({read,derive});
});

export const readSamePaPhysicalActionFromSqlite=(db:DatabaseSync,ref:SamePaReference<'pa_physical_v1_action_plans'>):SamePaPhysicalAction=>assembly(db,own=>{
  if(!samePaReferenceValid(ref,tables.action))throw new Error('invalid physical action reference');const value=required(own.read('action',ref.sourceId));if(value.kind!=='same_pa_physical_action_prepared_v1')throw new Error('physical action kind differs');same(reference(tables.action,value),ref);return value;});
export const readSamePaPhysicalFieldCalibrationFromSqlite=(db:DatabaseSync,ref:SamePaReference<'pa_physical_v1_field_calibrations'>):SamePaPhysicalFieldCalibration=>assembly(db,own=>{
  if(!samePaReferenceValid(ref,tables.fieldCalibration))throw new Error('invalid physical field calibration reference');const value=required(own.read('fieldCalibration',ref.sourceId));if(value.kind!=='same_pa_physical_field_calibration_prepared_v1')throw new Error('physical field calibration kind differs');same(reference(tables.fieldCalibration,value),ref);return value;});
export const readSamePaPhysicalOperationFromSqlite=(db:DatabaseSync,raw:SamePaPhysicalOperationReference):SamePaPhysicalOperationProof=>assembly(db,own=>{
  const ref=cloneInert(raw);if(!samePaPhysicalOperationOwners.some(o=>samePaReferenceValid(ref,o)))throw new Error('invalid physical operation reference');
  const kind=kindForOwner(ref.owner),value=required(own.read(kind,ref.sourceId)) as SamePaPhysicalOperation;same(reference(ref.owner,value),ref);
  // Historical ancestry stops at this committed operation. A later owned
  // transaction may currently be between its row and head CAS; it must not make
  // the earlier immutable cut unreadable or serve as proof for the new row.
  const committed=head(db,value.lineage.enrollmentReference.sourceId);
  const stage=stagedHeads.get(db);
  if(stage?.enrollment===value.lineage.enrollmentReference.sourceId)same(committed,stage.head);
  else memoSamePaLifecycleRead(db,'physical:historical-tail:'+value.lineage.enrollmentReference.sourceId,()=>{assertHead(db,value.lineage.enrollmentReference.sourceId);return true;});
  if(!committed||Number(committed.pitch_ordinal)<value.pitchOrdinal||committed.pitch_ordinal===value.pitchOrdinal&&Number(committed.operation_ordinal)<value.operationOrdinal)
    throw new Error('physical operation is not covered by its committed head');
  const launch=value.kind==='same_pa_physical_launch_v1'?value:required(own.read('launch',value.source.launchReference.sourceId)) as SamePaPhysicalLaunch;
  const action=required(own.read('action',launch.source.actionReference.sourceId)) as SamePaPhysicalAction;
  return freeze({reference:ref,record:value,viewReference:value.source.viewReference,lineage:value.lineage,evaluationTick:value.evaluationTick,pitchOrdinal:value.pitchOrdinal,timeline:value.timeline,kind:value.kind,stage:value.stage,
    physicalPitchReference:reference(tables.launch,launch),actor:action.actor,physicalWorld:action.physicalWorld,bodyCut:action.bodyCut});});
export const readSamePaPhysicalEpisodeFromSqlite=readSamePaPhysicalOperationFromSqlite;
const readInFlightCut=(db:DatabaseSync,ref:SamePaPhysicalOperationReference,current:boolean)=>{
  const proof=readSamePaPhysicalOperationFromSqlite(db,ref);if(proof.stage!=='in_flight'&&proof.stage!=='committed')throw new Error('physical pitch is no longer in flight');
  if(current){assertHead(db,proof.lineage.enrollmentReference.sourceId);same(head(db,proof.lineage.enrollmentReference.sourceId),headFor(proof.record));}
  return assembly(db,own=>{const launch=required(own.read('launch',proof.physicalPitchReference.sourceId)) as SamePaPhysicalLaunch,action=required(own.read('action',launch.source.actionReference.sourceId)) as SamePaPhysicalAction;
    return freeze({...proof,trajectory:launch.trajectory,action,ball:sampleAerodynamicPitchTrajectory(launch.trajectory,proof.evaluationTick),batterModelReference:action.source.batterModelReference});});};
export const readCurrentSamePaInFlightCutFromSqlite=(db:DatabaseSync,ref:SamePaPhysicalOperationReference)=>readInFlightCut(db,ref,true);
export const readHistoricalSamePaInFlightCutFromSqlite=(db:DatabaseSync,ref:SamePaPhysicalOperationReference)=>readInFlightCut(db,ref,false);

type Authority=Readonly<{readAcceptedAction?(id:string):unknown;readAcceptedRight?(id:string):unknown;readAcceptedFieldCalibration?(id:string):unknown;readAcceptedOperation?(id:string):unknown}>;
export const openSqliteSamePlateAppearancePhysicalEpisodeStore=(path:string,authority?:Authority)=>{
  if(!samePaText(path)||authority&&Object.values(authority).some(fn=>typeof fn!=='function'))throw new Error('invalid physical episode owner');
  const Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync,db=new Native(path),tx=battingInvocationTransaction(db,()=>storage(db));
  const allRows=()=>storage(db)?names.map(t=>db.prepare('SELECT * FROM main.'+t+' ORDER BY rowid').all()):names.map(()=>[]);
  const completeCurrentProof=(value:RecordValue)=>withSamePaLifecycleReadPhase(db,()=>{
    const b=readHistoricalSamePaLifecycleViewFromSqlite(db,value.source.viewReference);
    const prefix=readSamePaLifecycleRecordFromSqlite(db,'prefix',b.view.source.prefixReference.sourceId);
    if(!prefix||prefix.kind!=='same_pa_lifecycle_prefix')throw new Error('physical original current coverage missing');
    same(reference('pa_lifecycle_v1_work_prefixes',prefix),b.view.source.prefixReference);
    assertSamePaLifecycleReservedStateFromSqlite(db,b);
    const events=[...prefix.source.eventReferences];
    if(work(kindOf(value.source)))events.push(reference(tables[kindOf(value.source)],value) as SamePaPhysicalOperationReference);
    assertSamePaLifecycleWorkCoverage(db,value.lineage.enrollmentReference,prefix.source.anchorViewReference,events);
    if(value.kind==='same_pa_physical_commitment_v1'){
      const world=required(readEmotionWorldRevisionFromSqlite(db,value.lineage.careerId),'physical commitment actual World head missing');
      same(world.head.worldRevision,value.afterWorldRevision);same(world.head.control.revision,value.controlRevision);same(hash(world.head.control),value.controlHash);
    }
  });
  const read=(kind:Kind,id:string)=>{
    if(!samePaText(id))throw new Error('invalid physical identity');
    const original=()=>assembly(db,own=>{
      const value=own.read(kind,id);return value&&work(kind)
        ?readSamePaPhysicalOperationFromSqlite(db,reference(tables[kind],value) as SamePaPhysicalOperationReference).record:value;
    });
    return tx.run(false,proof=>proof(original),value=>same(original(),value));
  };
  const accept=(id:string,kind?:'action'|'right'|'fieldCalibration'):RecordValue|Pending=>{
    if(!samePaText(id))throw new Error('invalid physical Source identity');const raw=(kind==='action'?authority?.readAcceptedAction:kind==='right'?authority?.readAcceptedRight:kind==='fieldCalibration'?authority?.readAcceptedFieldCalibration:authority?.readAcceptedOperation)?.(id)??null;
    const source=raw===null?null:input(raw,id);if(source&&kind&&kindOf(source)!==kind)throw new Error('physical accepted Source owner differs');
    if(source&&!kind&&!work(kindOf(source)))throw new Error('physical operation API requires actual work Source');
    const archived = !source && !kind ? tx.run(false, proof => proof(() => {
      const found = storage(db) ? archiveTables.flatMap(owner => db.prepare(`SELECT source_id FROM main.${owner} WHERE source_id=$id
        OR ${claim('source_json',['sourceId'],'$id')} OR ${claim('snapshot_json',['source','sourceId'],'$id')}`).all({id}).map(() => owner)) : [];
      if (found.length > 1 || found.length === 1 && !samePaPhysicalOperationOwners.some(owner => owner === found[0])) throw new Error('physical operation identity aliased');
      if (!found.length) for (const owner of samePaPhysicalOperationOwners) identityRow(db,owner,id);
      return found.length ? kindForOwner(found[0]) : undefined;
    }), () => {}) : undefined;
    const requested=source?kindOf(source):kind??archived;if(!requested)return pending('accepted_source_missing',[id]);const prior=read(requested,id);if(prior){if(source)same(prior.source,source);return prior;}if(!source)return pending('accepted_source_missing',[id]);
    const pre=tx.run(false,proof=>proof(()=>{const value=assembly(db,own=>own.derive(source,true));if(value.kind!=='pending'&&work(requested))assertHead(db,value.lineage.enrollmentReference.sourceId);return {value,rows:allRows()};}),()=>{});
    if(pre.value.kind==='pending')return pre.value;const value=pre.value,expected=pre.rows.map(r=>[...r]);
    return tx.run(true,(proof,step)=>{
      same(proof(()=>({value:assembly(db,own=>own.derive(source,true)),rows:allRows()})),pre);
      if(!storage(db)){if(requested!=='action')throw new Error('physical preparation namespace absent');for(const ddl of Object.values(schemas))step(()=>db.exec(ddl),0,1);}
      const row=rowFor(value),beforeHead=work(requested)?head(db,value.lineage.enrollmentReference.sourceId):null;
      if(work(requested)){assertHead(db,value.lineage.enrollmentReference.sourceId);if(value.kind==='same_pa_physical_launch_v1'){
        if((beforeHead?.pitch_ordinal??2)!==value.pitchOrdinal-1)throw new Error('physical launch progress changed');
      }else if('previousOperationReference'in value.source){if(!beforeHead||beforeHead.last_owner!==value.source.previousOperationReference.owner||beforeHead.last_source_id!==value.source.previousOperationReference.sourceId||beforeHead.last_snapshot_hash!==value.source.previousOperationReference.snapshotHash)throw new Error('physical predecessor no longer current');}}
      const insert=(table:typeof names[number],r:Record<string,string|number>)=>{step(()=>{const changed=db.prepare(`INSERT INTO main.${table}(${Object.keys(r).join(',')}) VALUES(${Object.keys(r).map(()=>'?').join(',')})`).run(...Object.values(r));if(changed.changes!==1)throw new Error('physical exact row append differs');},1);expected[names.indexOf(table)].push(r);};
      const reproof=()=>proof(()=>{
        same(allRows(),expected);
        const enrollment=value.lineage.enrollmentReference.sourceId;
        const expectedHead=expected[names.indexOf(tables.head)].find(r=>r.enrollment_source_id===enrollment)??null;
        if(stagedHeads.has(db))throw new Error('physical append proof is already active');
        stagedHeads.set(db,{enrollment,head:expectedHead});
        try{same(assembly(db,own=>own.derive(source,false)),value);same(allRows(),expected);}
        finally{stagedHeads.delete(db);}
      });
      if(value.kind==='same_pa_physical_launch_v1'){insert(tables.consumer,launchCompanion(value,'consumer'));reproof();}
      insert(tables[requested],row);reproof();
      if(work(requested)){const next=headFor(value as SamePaPhysicalOperation);step(()=>{const changed=beforeHead===null?db.prepare(`INSERT INTO main.${tables.head} VALUES(${Object.keys(next).map(()=>'?').join(',')})`).run(...Object.values(next))
          :db.prepare(`UPDATE main.${tables.head} SET pitch_ordinal=?,launch_source_id=?,operation_ordinal=?,last_owner=?,last_source_id=?,last_snapshot_hash=? WHERE enrollment_source_id=? AND pitch_ordinal=? AND operation_ordinal=? AND last_source_id=? AND last_snapshot_hash=?`)
            .run(next.pitch_ordinal,next.launch_source_id,next.operation_ordinal,next.last_owner,next.last_source_id,next.last_snapshot_hash,next.enrollment_source_id,beforeHead.pitch_ordinal,beforeHead.operation_ordinal,beforeHead.last_source_id,beforeHead.last_snapshot_hash);if(changed.changes!==1)throw new Error('physical head CAS differs');},1);
        const h=expected[names.indexOf(tables.head)],i=h.findIndex(r=>r.enrollment_source_id===next.enrollment_source_id);if(i<0)h.push(next);else h[i]=next;reproof();}
      if(value.kind==='same_pa_physical_launch_v1'){insert(tables.consumption,launchCompanion(value,'consumption'));reproof();insert(tables.admission,launchCompanion(value,'admission'));reproof();}
      if(value.kind==='same_pa_physical_commitment_v1'){
        const world=proof(()=>readEmotionWorldRevisionFromSqlite(db,value.lineage.careerId));if(!world||world.head.worldRevision!==value.beforeWorldRevision||world.head.control.revision!==value.controlRevision||hash(world.head.control)!==value.controlHash)throw new Error('physical commitment World changed');
        step(()=>{const changed=db.prepare('UPDATE main.world_control_heads SET world_revision=? WHERE career_id=? AND world_revision=? AND control_revision=? AND control_json=?').run(value.afterWorldRevision,value.lineage.careerId,value.beforeWorldRevision,value.controlRevision,world.controlJson);if(changed.changes!==1)throw new Error('physical commitment World CAS differs');},1);
        proof(()=>{same(db.prepare('SELECT * FROM main.world_control_heads WHERE career_id=?').get(value.lineage.careerId),{career_id:value.lineage.careerId,world_revision:value.afterWorldRevision,control_revision:value.controlRevision,control_json:world.controlJson});
          same(db.prepare('SELECT count(*) n FROM main.world_decision_revision_events WHERE career_id=?').get(value.lineage.careerId)!.n,value.beforeWorldRevision);same(allRows(),expected);});
        const event=commitmentWorldEvent(value);
        step(()=>{const changed=db.prepare('INSERT INTO main.world_decision_revision_events VALUES(?,?,?,?,?)').run(value.lineage.careerId,value.afterWorldRevision,event.kind,value.source.sourceId,json(event));if(changed.changes!==1)throw new Error('physical commitment World event differs');},1);reproof();
      }
      proof(()=>{same(assembly(db,own=>own.read(requested,id)),value);if(work(requested))assertHead(db,value.lineage.enrollmentReference.sourceId);completeCurrentProof(value);same(allRows(),expected);});return value;
    },saved=>{same(assembly(db,own=>own.read(requested,id)),saved);if(work(requested))assertHead(db,saved.lineage.enrollmentReference.sourceId);completeCurrentProof(saved);same(allRows(),expected);});
  };
  return Object.freeze({acceptAction:(id:string)=>accept(id,'action'),acceptRight:(id:string)=>accept(id,'right'),acceptFieldCalibration:(id:string)=>accept(id,'fieldCalibration'),acceptOperation:(id:string)=>accept(id),
    readAction:(id:string)=>read('action',id),readRight:(id:string)=>read('right',id),readFieldCalibration:(id:string)=>read('fieldCalibration',id),readOperation:(ref:SamePaPhysicalOperationReference)=>tx.run(false,proof=>proof(()=>readSamePaPhysicalOperationFromSqlite(db,ref)),()=>{}),close:tx.close});
};
