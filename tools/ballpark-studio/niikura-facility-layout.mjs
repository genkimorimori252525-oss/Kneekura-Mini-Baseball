import {wallAt} from './model.mjs';
// Device anchors and the architecture they occupy share the same seat-sector grid.
export function niikuraFacilityLayout(g,seatPoint){
 const sectors=96,podiumY=13,mainBoard={x:0,z:wallAt(g,0).position.z+17,baseY:14,width:60,height:25};
 const monitors=[28,37,59,68].map((sector,index)=>{const v=seatPoint(sector/sectors,25,23);return{index,sector,x:v.x,z:v.z,baseY:v.y,width:18,height:10.5};});
 const bays=[{id:'main',start:40,end:56,topY:41},...monitors.map(b=>({id:'monitor-'+b.index,start:b.sector-2,end:b.sector+2,topY:36.5}))];
 return{sectors,podiumY,mainBoard,monitors,bays,stairs:[39,56]};
}
export const facilityBayAt=(layout,sector)=>layout.bays.find(b=>sector>=b.start&&sector<b.end);
export const mirroredNiikuraMaterial=(part,sector)=>'niikura:'+part+':'+(sector<48?sector:95-sector)+(sector<48?'':':mirror');
