import { expect, it } from 'vitest';
import { deriveSamePaStationaryOccupiedRunners, type SamePaStationaryHoldBasis } from './SamePlateAppearanceStationaryOccupiedRunners';
import { geometry } from '../../core/sim/ball/BattedWorldScheduledFieldThrow.test-support';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const fixture = (count=1) => {
  const enrollment={owner:'same_pa_enrollments' as const,sourceId:'enrollment',sourceHash:hash('e'),snapshotHash:hash('e')};
  const shape=geometry(), bases=['first','second','third'] as const, match:any={bases:{first:null,second:null,third:null}};
  const holds:SamePaStationaryHoldBasis[]=[], actors:any[]=[];
  for(let i=0;i<count;i++){
    const base=bases[i],playerId='runner'+i,position=shape.baseGeometry.bases[base].region.center;match.bases[base]=playerId;
    const body={playerId,personId:'person'+i,bodyOriginHeightMeters:2,primitives:(['body','glove','tag_hand','left_foot','right_foot'] as const).map(role=>({role,radius:0.05,offset:{x:0,y:role.endsWith('foot')?-1:0,z:0}}))};
    holds.push({source:{sourceId:'hold'+i,sourceVersion:'test',playerId,enrollmentReference:enrollment,coverageThroughTick:2_000_000},startingBase:([1,2,3] as const)[i],setup:{position},body:{actor:body}});
    actors.push(...body.primitives.map(p=>({playerId,primitive:{role:p.role,radius:p.radius,startTick:0,endTick:2_000_000,ticksPerSecond:1_000_000,
      startCenter:{x:position.x,y:2+p.offset.y,z:position.z},startVelocity:{x:0,y:0,z:0},acceleration:{x:0,y:0,z:0}}})));
  }
  const root:any={lineage:{enrollmentReference:enrollment},geometry:shape,response:{world:{flight:{initialBall:{tick:0}},parameters:{ticksPerSecond:1_000_000}}}};
  const evidence:any={physical:{segments:[{originTick:0,startElapsedSeconds:0,endElapsedSeconds:1,actors}],field:{evidence:{horizon:{elapsedSeconds:1,ball:{tick:1_000_000}}}}}};
  return{match,root,holds,evidence};
};
it.each([1,2,3])('OSH01 proves every one of %s original five-part bodies remained in continuous contact with its own base',count=>{
  const result=deriveSamePaStationaryOccupiedRunners(fixture(count));expect(result.kind).toBe('same_pa_stationary_occupied_runners_v1');
  if(result.kind!=='same_pa_stationary_occupied_runners_v1')throw new Error('missing proof');
  expect(result.runners).toHaveLength(count);expect(result.runners.every(r=>r.history.events.length===1&&r.history.events[0].kind==='touch')).toBe(true);
});
it.each(['velocity','acceleration','root_position','feet_off_base','finite_coverage','missing_hold','foreign_base'] as const)('OSH02 rejects %s as stationary original history',fault=>{
  const f=fixture();
  if(fault==='velocity')f.evidence.physical.segments[0].actors[0].primitive.startVelocity.x=1;
  if(fault==='acceleration')f.evidence.physical.segments[0].actors[0].primitive.acceleration.x=1;
  if(fault==='root_position')f.evidence.physical.segments[0].actors[0].primitive.startCenter.x+=1;
  if(fault==='feet_off_base'){for(const a of f.evidence.physical.segments[0].actors)a.primitive.startCenter.x+=10;f.holds[0]={...f.holds[0],setup:{position:{x:13,z:0}}};}
  if(fault==='finite_coverage')f.holds[0]={...f.holds[0],source:{...f.holds[0].source,coverageThroughTick:999_999}};
  if(fault==='missing_hold')f.holds=[];
  if(fault==='foreign_base')f.holds[0]={...f.holds[0],startingBase:2};
  if(fault==='missing_hold'||fault==='foreign_base')expect(()=>deriveSamePaStationaryOccupiedRunners(f)).toThrow();
  else expect(deriveSamePaStationaryOccupiedRunners(f).kind).toBe('pending');
});
