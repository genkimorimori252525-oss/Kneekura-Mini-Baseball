import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createRequire } from 'node:module';
import { readAuthoredNativeMatchV1, type AuthoredNativeMatchReadPinsV1 } from './AuthoredNativeMatchV1';
import { openSqlitePlayerPersonLinkStore } from '../../host/world/SqlitePlayerPersonLinkStore';
import { openSqlitePlayerWorkloadRecoveryStore, type AcceptedPlayerWorkloadBaseline } from '../../host/world/SqlitePlayerWorkloadRecoveryStore';
import { openSqliteSamePlateAppearanceEnrollmentStore } from '../../host/world/SqliteSamePlateAppearanceEnrollmentStore';
import type { AcceptedSamePlateAppearanceEnrollment } from '../../host/world/SamePlateAppearanceEnrollment';
import { actorHash as hash, actorJson as json, actorFreeze as freeze } from '../../host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { playerBattingModelEvidenceFromSqlite } from '../../host/world/PlayerBattingModelEvidence';
import { withBodyCompositionTransaction } from '../../host/world/BodyMaterializationSqliteOwnership';
import { samePaReferenceValid, type SamePaReference } from '../../host/world/SamePlateAppearanceWorkPrefix';

export type AuthoredNativeReservationDeclarationV1=Readonly<{
  version:'authored_native_reservation_v1'; genesisPins:AuthoredNativeMatchReadPinsV1;
  battingModelReference:SamePaReference<'world_player_batting_models'>;
  /** Explicit SI fatigue/recovery policies for both original nine-player rosters. */
  baselines:readonly AcceptedPlayerWorkloadBaseline[];
  enrollment:Readonly<{sourceId:string;sourceVersion:string;firstPhysicalPitchSourceId:string}>;
}>;
const fields=(v:unknown,ks:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)
  &&Object.keys(v).sort().join('|')===[...ks].sort().join('|');

/** Initialize original accepted workload owners and acquire the existing real
 * SamePA ten-person reservation. No take/swing/pitch outcome is manufactured.
 * Invalid membership is rejected before new owner storage is opened. Failures
 * after independent owner acceptance retain those accepted rows for diagnosis. */
export function reserveAuthoredNativePlateAppearanceV1(path:string,raw:AuthoredNativeReservationDeclarationV1){
  const d=cloneInert(raw);
  if(!fields(d,['version','genesisPins','battingModelReference','baselines','enrollment'])||d.version!=='authored_native_reservation_v1'
    ||!samePaReferenceValid(d.battingModelReference,'world_player_batting_models')
    ||!fields(d.enrollment,['sourceId','sourceVersion','firstPhysicalPitchSourceId'])
    ||Object.values(d.enrollment).some(id=>typeof id!=='string'||!id.trim()||id.trim()!==id)
    ||!Array.isArray(d.baselines)||d.baselines.length!==18)throw new Error('invalid authored Native reservation declaration');
  const genesis=readAuthoredNativeMatchV1(path,d.genesisPins),actor=genesis.actor;
  const Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync,db=new Native(path,{readOnly:true});
  const battingModel=(()=>{try{return withBodyCompositionTransaction(db,false,()=>playerBattingModelEvidenceFromSqlite(db).read(d.battingModelReference.sourceId));}finally{db.close();}})();
  if(!battingModel||hash(battingModel.source)!==d.battingModelReference.sourceHash||hash(battingModel)!==d.battingModelReference.snapshotHash
    ||battingModel.source.playerId!==actor.binding.playerId||battingModel.source.personId!==actor.binding.personId
    ||battingModel.source.careerId!==actor.binding.careerId||battingModel.source.acceptedAtDay>actor.binding.gameDay)
    throw new Error('authored Native reservation batting model differs from original batter');
  const people=new Map(genesis.materializations.map(m=>[m.person.playerId,m.person]));
  const ids=[d.enrollment.sourceId,d.enrollment.firstPhysicalPitchSourceId,...d.baselines.map(b=>b.sourceId)];
  if(genesis.models.length!==18||new Set(genesis.models.map(m=>m.playerId)).size!==18||people.size!==18
    ||new Set(ids).size!==ids.length||new Set(d.baselines.map(b=>b.playerId)).size!==18
    ||d.baselines.some(b=>{
      const p=people.get(b.playerId);
      return !p||!genesis.models.some(m=>m.playerId===b.playerId)||b.careerId!==actor.binding.careerId
        ||b.personLinkSourceId!==p.sourceId||b.createdAtDay<p.acceptedAtDay||b.createdAtDay>actor.binding.gameDay;
    }))throw new Error('authored Native reservation original participant or baseline scope differs');
  const stores:{close():void}[]=[],track=<T extends {close():void}>(s:T):T=>{stores.push(s);return s;};
  try{
    const links=track(openSqlitePlayerPersonLinkStore(path));
    const workload=track(openSqlitePlayerWorkloadRecoveryStore(path,links,{
      readAcceptedBaseline:id=>d.baselines.find(b=>b.sourceId===id)??null,readAcceptedActivity:()=>null,
    }));
    const states=d.baselines.map(b=>({baselineSourceId:b.sourceId,state:workload.initialize(b.sourceId)}));
    const participants=[actor.binding,...actor.defenderBindings];
    const source:AcceptedSamePlateAppearanceEnrollment={sourceId:d.enrollment.sourceId,sourceVersion:d.enrollment.sourceVersion,
      capability:'reserved_same_pa_enrollment_v1',actorReference:{owner:'physical_plate_appearance_actors',
        sourceId:actor.source.sourceId,sourceHash:hash(actor.source),snapshotHash:hash(actor)},
      firstPhysicalPitchSourceId:d.enrollment.firstPhysicalPitchSourceId,executionBasis:'reserved_cumulative_actual_role_total_v1',
      participantBaselineReferences:participants.map(p=>{
        const s=states.find(s=>s.state.playerId===p.playerId)!;
        return {playerId:p.playerId,baselineSourceId:s.baselineSourceId,revision:s.state.revision,stateHash:hash(s.state)};
      })};
    const owner=track(openSqliteSamePlateAppearanceEnrollmentStore(path,{readAcceptedEnrollment:id=>id===source.sourceId?source:null}));
    const enrollment=owner.accept(source.sourceId);
    if(enrollment.kind!=='reserved')throw new Error('authored Native enrollment unexpectedly lacks an initialized participant');
    if(json(readAuthoredNativeMatchV1(path,d.genesisPins))!==json(genesis))throw new Error('authored Native genesis changed during reservation');
    return freeze({source,battingModel,workloads:states,enrollment,nativePitchLaunched:false as const,officialResult:null});
  }finally{stores.reverse().forEach(s=>s.close());}
}
