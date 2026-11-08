import {resolveLiveFielderBodyModelV105,liveFielderBodyControlBoundsV105} from '../../../core/sim/fielding/LiveFielderBodyGeometryV105';
import {resolveLiveMatchPlayerPhysicalV98} from '../../../integration/browser/LiveBaseballMatchV1';
/** Mirrors the experimental loose admission's declared stationary spheres. */
export function lateCutBodiesV1(ready:any,players:readonly any[],ballRadius:number){
 const byId=new Map(players.map(p=>[p.playerId,p])),fielders=ready.actors.filter((a:any)=>a.role!=='batter'&&a.role!=='runner').map((a:any)=>{
  const p:any=byId.get(a.playerId);if(!p)throw Error('HOLD: missing actor');const physical=resolveLiveMatchPlayerPhysicalV98(p);
  const model=resolveLiveFielderBodyModelV105(p.heightMeters,physical.gloveReachMeters,Object.fromEntries(Object.keys(liveFielderBodyControlBoundsV105).filter(k=>(physical as any)[k]!==undefined).map(k=>[k,(physical as any)[k]])));
  const body={...a.position,y:a.position.y+model.hipHeightMeters},gy=body.y+model.shoulderHeightMeters-model.hipHeightMeters-Math.min(model.armReachMeters*.4,Math.max(0,model.shoulderHeightMeters-Math.max(physical.gloveRadiusMeters,ballRadius)-.02));
  return {id:a.playerId,role:a.role,body,glove:{...body,y:gy},gloveRadius:physical.gloveRadiusMeters};
 });
 const batter=ready.actors.find((a:any)=>a.role==='batter');if(fielders.length!==9||!batter||fielders.filter((a:any)=>a.role==='C').length!==1)throw Error('HOLD: incomplete actor population');
 return [...fielders.map((a:any)=>({id:'body:'+a.id,center:a.body,radius:.24})),...fielders.filter((a:any)=>a.role!=='C').map((a:any)=>({id:'glove:'+a.id,center:a.glove,radius:a.gloveRadius})),{id:'batter:'+batter.playerId,center:{...batter.position,y:batter.position.y+.9},radius:.24}];
}
