import type { DatabaseSync } from 'node:sqlite';
import { readSamePaOriginalParticipants } from './SamePlateAppearanceOriginalParticipants';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { replayClubEvents } from '../../core/world/club/ClubEvents';
import { createBattedWorldBaseGeometry, type BattedWorldBaseGeometryInput } from '../../core/sim/ball/BattedWorldBaseGeometry';
import { createBattedWorldFieldGeometry, type BattedWorldFieldGeometry } from '../../core/sim/ball/BattedWorldFieldMotion';
import { assertBattedActorResponseProfile } from '../../core/sim/ball/BattedBallContactResponse';
import type { BallFlightParameters } from '../../core/sim/ball/BallFlight';
import { acceptedBattedContactResponseModelInput, type AcceptedBattedContactResponseModel } from './SqliteBattedContactResponseStore';
import { battedBodyModelMaterializationEvidenceFromSqlite } from './BattedBodyModelMaterializationEvidence';
import { readAcceptedClubHistory } from './SqliteClubEventJournal';
import { actorHash as hash, actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields, samePaText as text, samePaReferenceValid as ref, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import type { SamePaPhysicalAction } from './SamePlateAppearancePhysicalEpisode';
import type { DurableBattingInvocationPosture } from './NativeBattingPerception';

export type SamePaPhysicalFieldCalibrationSource=Readonly<{
  sourceId:string;sourceVersion:string;capability:'same_pa_physical_field_calibration_v1';viewReference:SamePaReference<'pa_lifecycle_v1_execution_views'>;
  actionReference:SamePaReference<'pa_physical_v1_action_plans'>;postureReference:SamePaReference<'batting_observation_v1_postures'>;
  bodyModelReference:SamePaReference<'world_batted_body_materializations'>;availableAtDay:number;geometryRef:string;
  field:BattedWorldBaseGeometryInput['field'];bases:BattedWorldBaseGeometryInput['bases'];baseModels:BattedWorldFieldGeometry['baseModels'];
  responseModel:AcceptedBattedContactResponseModel;parameters:Required<BallFlightParameters>;
}>;
export const samePaPhysicalFieldCalibrationSourceInput=(raw:unknown,id?:string):SamePaPhysicalFieldCalibrationSource=>{
  const s=cloneInert(raw) as SamePaPhysicalFieldCalibrationSource,p=s?.parameters;
  if(!fields(s,['sourceId','sourceVersion','capability','viewReference','actionReference','postureReference','bodyModelReference','availableAtDay','geometryRef','field','bases','baseModels','responseModel','parameters'])
    ||s.capability!=='same_pa_physical_field_calibration_v1'||!text(s.sourceId)||!text(s.sourceVersion)||id!==undefined&&s.sourceId!==id
    ||!ref(s.viewReference,'pa_lifecycle_v1_execution_views')||!ref(s.actionReference,'pa_physical_v1_action_plans')||!ref(s.postureReference,'batting_observation_v1_postures')
    ||!ref(s.bodyModelReference,'world_batted_body_materializations')||!text(s.geometryRef)||!Number.isSafeInteger(s.availableAtDay)||s.availableAtDay<0
    ||!fields(p,['ticksPerSecond','gravityY','ballRadius','groundRestitution','groundFriction','groundRollingDecelerationMps2','integrationStepTicks','restingVerticalSpeed'])
    ||Object.values(p).some(v=>typeof v!=='number'||!Number.isFinite(v))||p.ticksPerSecond!==1_000_000||!Number.isSafeInteger(p.integrationStepTicks)||p.integrationStepTicks<=0
    ||p.ballRadius<=0||p.groundRestitution<0||p.groundRestitution>1||p.groundFriction<0||p.groundFriction>1||p.groundRollingDecelerationMps2<0||p.restingVerticalSpeed<0)throw new Error('invalid independent physical field calibration Source');
  createBattedWorldFieldGeometry({baseGeometry:createBattedWorldBaseGeometry({field:s.field,bases:s.bases}),baseModels:s.baseModels});
  acceptedBattedContactResponseModelInput(s.responseModel,s.responseModel.sourceId);
  s.responseModel.actors.forEach(a=>a.primitives.forEach(profile=>assertBattedActorResponseProfile(profile,p)));
  return freeze(s);
};
const same=(a:unknown,b:unknown)=>{if(json(a)!==json(b))throw new Error('physical field calibration original owner differs');};
/** Code-owned composition after exact action/posture reauthentication on the
 * same private connection. Accepted geometry/profiles are inputs, never a
 * fabricated flight, old contact registration, or transplanted model receipt. */
export const deriveSamePaPhysicalFieldCalibration=(db:DatabaseSync,source:SamePaPhysicalFieldCalibrationSource,action:SamePaPhysicalAction,posture:DurableBattingInvocationPosture)=>{
  if(posture.source.capability!=='owned_in_flight_batting_posture_v1'||posture.physicalPitchSourceId!==action.physicalPitchSourceId)throw new Error('field calibration original posture differs');
  same(posture.source.actionReference,source.actionReference);same(posture.source.viewReference,source.viewReference);same(source.viewReference,action.source.viewReference);
  same(posture.source.modelReference,action.source.batterModelReference);same(posture.lineage,action.lineage);
  const actor=action.actor,fixture=db.prepare('SELECT * FROM main.official_fixtures WHERE game_id=?').get(actor.source.gameId);
  if(!fixture||hash(fixture)!==actor.fixtureHash||fixture.fixture_event_id!==actor.binding.fixtureEventId||source.availableAtDay>actor.binding.gameDay)throw new Error('field calibration actual fixture/day differs');
  const model=battedBodyModelMaterializationEvidenceFromSqlite(db).read(source.bodyModelReference.sourceId);
  const row=db.prepare('SELECT * FROM main.world_batted_body_materializations WHERE source_id=?').get(source.bodyModelReference.sourceId);
  if(!model||!row)throw new Error('field calibration normal body assembly missing');
  same(source.bodyModelReference,{owner:'world_batted_body_materializations',sourceId:model.sourceId,sourceHash:hash(JSON.parse(String(row.source_json))),snapshotHash:hash(model)});
  const bodies=[posture.model.bodyMaterialization,...posture.sceneBodies],participants=readSamePaOriginalParticipants(db,actor);
  if(model.gameId!==actor.source.gameId||model.careerId!==actor.binding.careerId||model.fixtureEventId!==actor.binding.fixtureEventId||model.venueId!==fixture.venue_id
    ||model.availableAtDay>actor.binding.gameDay||model.actors.length!==participants.length||bodies.length!==participants.length)throw new Error('field calibration exact participant model scope differs');
  same(bodies.map(b=>b.source.playerId).sort(),participants.map(p=>p.binding.playerId).sort());
  for(const body of bodies)same(model.actors.find(a=>a.playerId===body.source.playerId),body.actor);
  const response=source.responseModel;
  if(response.gameId!==model.gameId||response.careerId!==model.careerId||response.fixtureEventId!==model.fixtureEventId||response.venueId!==model.venueId
    ||response.availableAtDay>actor.binding.gameDay||response.actors.length!==participants.length||source.parameters.ballRadius!==posture.model.equipment.values.ball.radiusM
    ||source.parameters.ticksPerSecond!==action.source.actualFlightParameters.ticksPerSecond)throw new Error('field calibration response/equipment scope differs');
  for(const a of model.actors){const r=response.actors.find(r=>r.playerId===a.playerId);if(!r||r.personId!==a.personId)throw new Error('field calibration original response Person missing');
    if(r.primitives.some(p=>p.role==='glove'&&p.parameters.ballMassKg!==posture.model.equipment.values.ball.massKg))throw new Error('field calibration glove ball equipment differs');}
  same([...response.surfaces.map(s=>s.surfaceId)].sort(),[...model.surfaces.map(s=>s.surfaceId)].sort());
  let parts:unknown=null;try{parts=JSON.parse(String(fixture.fixture_event_id));}catch{/* Non-domestic fixture keys are opaque. */}
  if(Array.isArray(parts)&&parts[0]==='domestic-fixture-venue-v1'){
    const revision=parts.at(-2),history=readAcceptedClubHistory(db,actor.binding.careerId,actor.worldFixture.game.homeClubId);
    if(parts.length<6||parts[1]!==actor.binding.careerId||parts[2]!==actor.binding.competitionEditionId||parts[3]!==fixture.game_id||parts.at(-1)!==fixture.venue_id
      ||fixture.fixture_revision!==parts.length-5||!Number.isSafeInteger(revision)||revision<0||!history||history.checkpoint.revision>revision)throw new Error('field calibration domestic venue origin missing');
    const events=history.acceptedEvents.filter(e=>e.afterRevision<=revision),pinned=replayClubEvents(history.checkpoint,events),next=history.acceptedEvents[events.length];
    if(!pinned.ok||pinned.value.revision!==revision||pinned.value.effectiveDay>actor.binding.gameDay||next&&next.command.effectiveDay<=actor.binding.gameDay
      ||pinned.value.institutional.stadium.stadiumId!==fixture.venue_id||pinned.value.institutional.stadium.geometryRef!==source.geometryRef)throw new Error('field calibration original venue geometry differs');
  }
  const geometry=createBattedWorldFieldGeometry({baseGeometry:createBattedWorldBaseGeometry({field:source.field,bases:source.bases}),baseModels:source.baseModels});
  for(const id of ['first','second','third'] as const)same(geometry.baseGeometry.bases[id].region.center,action.baseCenters[id]);
  return freeze({geometry,model,responseModel:response,fixture,parameters:source.parameters});
};
