import type { CanonicalWorldSnapshot } from '../../../core/model/CanonicalWorldSnapshot';
import type { TimedMatchEvent } from '../../../core/model/TimedMatchEvent';
import type { Vec2, Vec3 } from '../../../core/model/geometry';
import type { BatterPresentationState } from '../model';
import { selectDirection } from './PixelPlayerDirection';
import type { CompiledPixelAsset, PixelBounds } from './PixelPlayerModel';
import { selectPixelFrame, visualBatDistance, type VisualFrameFacts } from './PixelPlayerFrameSelector';
import { projectPixelCamera, type PixelCamera } from './PixelPlayerCamera';
import { placePixelPlayer, sortPixelPlayers, type PixelPlacement } from './PixelPlayerProjection';
export type PixelActorObservation=Readonly<{playerId:string;role:'batter'|'pitcher'|'defender'|'runner'|'catcher';name:string;position:Vec3;height:number;facing:Vec2;facts:VisualFrameFacts;batterState?:BatterPresentationState}>;
export type PixelScene=Readonly<{physicalBatVisible:false;observedBats:readonly {playerId:string;grip:ReturnType<typeof projectPixelCamera>;tip:ReturnType<typeof projectPixelCamera>}[];players:readonly {playerId:string;placement:PixelPlacement;frameId:string|null;bodyBounds:PixelBounds;contactDistance?:number}[];cells:readonly {x:number;y:number;color:string}[];labels:readonly {text:string;bounds:PixelBounds;scale:1|2}[]}>;
const overlaps=(a:PixelBounds,b:PixelBounds)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
function contactPoint(events:readonly TimedMatchEvent[],tick:number):Vec3|undefined {
 const event=events.find(e=>e.tick===tick&&e.kind==='BatBallContact');
 if(!event)return undefined;
 const payload=event.payload as {point?:Vec3}|null;
 const p=payload?.point;
 if(!p||![p.x,p.y,p.z].every(Number.isFinite))throw new Error('Exact contact needs canonical point');
 return p;
}
export function buildPixelPlayerScene(world:CanonicalWorldSnapshot,actors:readonly PixelActorObservation[],asset:CompiledPixelAsset,camera:PixelCamera,events:readonly TimedMatchEvent[],zone?:PixelBounds):PixelScene{
 if(new Set(actors.map(a=>a.playerId)).size!==actors.length)throw new Error('Duplicate actor identity');
 const observedBats=actors.flatMap(a=>a.batterState?.bat?[{playerId:a.playerId,grip:projectPixelCamera(a.batterState.bat.grip,camera),tip:projectPixelCamera(a.batterState.bat.tip,camera)}]:[]);
 const prepared=actors.filter(a=>!(a.role==='batter'&&(camera.mode==='BATTER_POV'||camera.mode==='CATCHER_POV'))).flatMap(actor=>{
  // Defender/runner canonical positions always win over presentation-context positions.
  const canonical=world.defenders.find(p=>p.playerId===actor.playerId)??world.runners.find(p=>p.playerId===actor.playerId);
  const position=canonical?{...canonical.position,y:0}:actor.position;
  const projected=projectPixelCamera(position,camera);
  return projected?[{actor,placement:placePixelPlayer(actor.playerId,projected,actor.height)}]:[];
 });
 const ordered=sortPixelPlayers(prepared.map(p=>p.placement));
 const players:PixelScene['players'][number][]=[],cells:PixelScene['cells'][number][]=[],labels:PixelScene['labels'][number][]=[];
 const point=contactPoint(events,world.tick);
 for(const placement of ordered){
  const actor=prepared.find(p=>p.actor.playerId===placement.playerId)!.actor;
  let frameId:string|null=null,bodyBounds:PixelBounds,contactDistance:number|undefined;
  if(placement.lod>=2||(placement.lod===1&&asset.compact)){
   const rasterAsset=placement.lod===1?asset.compact!:asset;
   const contact=point&&actor.role==='batter'?projectPixelCamera(point,camera)??undefined:undefined;
   const canonical=world.defenders.find(p=>p.playerId===actor.playerId)??world.runners.find(p=>p.playerId===actor.playerId);
   const position=canonical?{...canonical.position,y:0}:actor.position;
   const direction=selectDirection(actor.facing,{x:camera.eye.x-position.x,z:camera.eye.z-position.z});
   const compact=placement.lod===1;
   const compactAction=actor.facts.action==='pitching'?'pitching':actor.facts.action==='running'?'running':'fielding';
   const facts=compact?{...actor.facts,action:compactAction as 'pitching'|'running'|'fielding',direction:direction.startsWith('BACK')?'BACK' as const:'FRONT' as const,phase:compactAction==='fielding'?0 as const:compactAction==='running'?(actor.facts.phase%2) as 0|1:actor.facts.phase}: {...actor.facts,direction,contact};
   const frame=selectPixelFrame(rasterAsset,facts,placement);
   frameId=frame.id;
   const origin={x:placement.root.x-frame.anchors.root.x*placement.scale,y:placement.root.y-frame.anchors.root.y*placement.scale};
   bodyBounds={x:origin.x+frame.bodyBounds.x*placement.scale,y:origin.y+frame.bodyBounds.y*placement.scale,width:frame.bodyBounds.width*placement.scale,height:frame.bodyBounds.height*placement.scale};
   if(contact&&!compact)contactDistance=visualBatDistance(frame,rasterAsset.width,placement,contact);
   for(let y=0;y<rasterAsset.height;y++)for(let x=0;x<rasterAsset.width;x++){
    const offset=(y*rasterAsset.width+x)*4;
    if(!frame.rgba[offset+3])continue;
    const color=`#${frame.rgba.slice(offset,offset+3).map(v=>v.toString(16).padStart(2,'0')).join('')}`;
    for(let sy=0;sy<placement.scale;sy++)for(let sx=0;sx<placement.scale;sx++)cells.push({x:origin.x+x*placement.scale+sx,y:origin.y+y*placement.scale+sy,color});
   }
  }else{
   // Deliberately authored 1-cell identity / 4x6 silhouette. Never resample the detailed bitmap.
   const rows=placement.lod===0?['U']:['.HH.','.KK.','UUUU','.WW.','.WW.','K..K'];
   bodyBounds={x:placement.root.x-Math.floor(rows[0].length/2),y:placement.root.y-rows.length,width:rows[0].length,height:rows.length};
   const palette:Record<string,string>={U:'#b96368',H:'#873c43',K:'#182024',W:'#ddd9c8'};
   rows.forEach((row,y)=>[...row].forEach((c,x)=>{if(c!=='.')cells.push({x:bodyBounds.x+x,y:bodyBounds.y+y,color:palette[c]});}));
  }
  players.push({playerId:actor.playerId,placement,frameId,bodyBounds,contactDistance});
  const scale=placement.labelScale;
  const text=[...actor.name].slice(0,16).join('');
  const bounds:PixelBounds={x:bodyBounds.x,y:bodyBounds.y-5*scale,width:Math.max(4,[...text].length*3+2)*scale,height:4*scale};
  let safe=bounds;
  if(zone&&overlaps(safe,zone))safe={...safe,x:zone.x-safe.width-1};
  // If an alternate label would be offscreen or still cover the zone, omit it rather than obscure play.
  if(safe.x>=0&&safe.y>=0&&safe.x+safe.width<=150&&safe.y+safe.height<=108&&(!zone||!overlaps(safe,zone)))labels.push({text,bounds:safe,scale});
 }
 return {physicalBatVisible:false,observedBats,players,cells,labels};
}
