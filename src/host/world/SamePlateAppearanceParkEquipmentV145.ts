import {cloneInert} from '../../core/adjudication/OfficialWindowPolicy';
import {createSourceParkEquipmentV145,type SourceParkEquipmentV145} from '../../core/sim/ball/SourceBattedFieldMotionV145';
import type {AcceptedBattedWorldModel} from './BattedWorldModel';
import {actorHash as hash,actorFreeze as freeze,type DurablePhysicalPlateAppearanceActor} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import {samePaFields as fields,samePaHash} from './SamePlateAppearanceWorkPrefix';
import type {SamePaPhysicalFieldRootSource} from './SamePlateAppearancePhysicalEpisode';
import {SAME_PA_POLE_ESCAPE_FIELD_ROOT_SOURCE_VERSION} from './SamePlateAppearanceBallPhysics';

/** Immutable root configuration. Geometry and material are explicit Source,
 * never a contact, a legal award, or a separately asserted database owner. */
export type AcceptedSamePaParkEquipmentV145=Readonly<{
  version:'same_pa_park_equipment_v145';sourceId:string;sourceVersion:string;
  gameId:string;playId:number;physicalPitchSourceId:string;fixtureEventId:string;venueId:string;
  baseFieldSourceId:string;worldModelSourceId:string;worldModelSourceVersion:string;availableAtDay:number;
  fenceSurfaceIds:readonly string[];equipment:SourceParkEquipmentV145;
}>;
const id=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.trim()===v;
export const samePaParkEquipmentInputV145=(raw:AcceptedSamePaParkEquipmentV145):AcceptedSamePaParkEquipmentV145=>{
  const p=cloneInert(raw);
  if(!fields(p,['version','sourceId','sourceVersion','gameId','playId','physicalPitchSourceId','fixtureEventId','venueId',
    'baseFieldSourceId','worldModelSourceId','worldModelSourceVersion','availableAtDay','fenceSurfaceIds','equipment'])
    ||p.version!=='same_pa_park_equipment_v145'
    ||![p.sourceId,p.sourceVersion,p.gameId,p.physicalPitchSourceId,p.fixtureEventId,p.venueId,p.baseFieldSourceId,p.worldModelSourceId,p.worldModelSourceVersion].every(id)
    ||!Number.isSafeInteger(p.playId)||p.playId<0||!Number.isSafeInteger(p.availableAtDay)||p.availableAtDay<0
    ||!Array.isArray(p.fenceSurfaceIds)||!p.fenceSurfaceIds.every(id)||new Set(p.fenceSurfaceIds).size!==p.fenceSurfaceIds.length)
    throw Error('invalid explicit same-PA park equipment Source');
  return freeze({...p,equipment:createSourceParkEquipmentV145(p.equipment)});
};
export type SamePaParkEquipmentBindingV145=Readonly<{
  equipmentHash:string;fixtureHash:string;worldModelHash:string;responseModelHash:string;geometryBindingHash:string;
}>;
type ModelScope=Readonly<{sourceId:string;sourceVersion:string;gameId:string;careerId:string;fixtureEventId:string;venueId:string;availableAtDay:number}>;
/** Called after the original fixture, model and body calibration are read by
 * their Native owners. The full objects are hashed; no mutable provider is kept. */
export const bindSamePaParkEquipmentV145=(source:SamePaPhysicalFieldRootSource,original:Readonly<{
  actor:DurablePhysicalPlateAppearanceActor;model:AcceptedBattedWorldModel;responseModel:ModelScope;
  fixture:Readonly<Record<string,unknown>>;geometryBindingHash:string;
}>):SamePaParkEquipmentBindingV145|undefined=>{
  const selected=source.sourceVersion===SAME_PA_POLE_ESCAPE_FIELD_ROOT_SOURCE_VERSION;
  if(!selected&&!Object.hasOwn(source,'parkEquipment'))return undefined;
  if(!selected)throw Error('park equipment requires its explicit same-PA root algorithm');
  const p=samePaParkEquipmentInputV145(source.parkEquipment!),{actor,model,responseModel,fixture,geometryBindingHash}=original;
  if(p.baseFieldSourceId!==source.sourceId||p.physicalPitchSourceId!==source.launchReference.sourceId
    ||p.gameId!==actor.source.gameId||p.gameId!==model.gameId||p.gameId!==fixture.game_id
    ||p.playId!==actor.match.playId||p.fixtureEventId!==actor.binding.fixtureEventId||p.fixtureEventId!==model.fixtureEventId||p.fixtureEventId!==fixture.fixture_event_id
    ||p.venueId!==model.venueId||p.venueId!==fixture.venue_id||hash(fixture)!==actor.fixtureHash
    ||p.worldModelSourceId!==model.sourceId||p.worldModelSourceVersion!==model.sourceVersion||p.availableAtDay>actor.binding.gameDay
    ||responseModel.gameId!==model.gameId||responseModel.careerId!==model.careerId||responseModel.fixtureEventId!==model.fixtureEventId
    ||responseModel.venueId!==model.venueId||responseModel.availableAtDay>actor.binding.gameDay||!samePaHash(geometryBindingHash)
    ||p.fenceSurfaceIds.some(id=>model.surfaces.filter(s=>s.surfaceId===id).length!==1)
    ||p.equipment.poles.some(pole=>model.surfaces.some(s=>s.surfaceId===pole.geometry.surfaceId)))
    throw Error('same-PA park equipment differs from original physical venue scope');
  return freeze({equipmentHash:hash(p),fixtureHash:hash(fixture),worldModelHash:hash(model),responseModelHash:hash(responseModel),geometryBindingHash});
};
