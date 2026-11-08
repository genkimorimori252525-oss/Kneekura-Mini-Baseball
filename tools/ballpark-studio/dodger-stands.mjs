// A separate architectural seating footprint: the playable boundary never moves.
import {realParkSeatRim} from './real-park-infield.mjs';
const rim=[[-77,78],[-58,49],[-38,13],[-25,-13],[0,-25],[25,-13],[38,13],[58,49],[77,78]];
function curve(u){const t=Math.max(0,Math.min(1,u))*(rim.length-1),i=Math.min(rim.length-2,Math.floor(t)),s=t-i,
 p=[rim[Math.max(0,i-1)],rim[i],rim[i+1],rim[Math.min(rim.length-1,i+2)]];
 return [0,1].map(k=>.5*((2*p[1][k])+(-p[0][k]+p[2][k])*s+(2*p[0][k]-5*p[1][k]+4*p[2][k]-p[3][k])*s*s+(-p[0][k]+3*p[1][k]-3*p[2][k]+p[3][k])*s*s*s));
}
export function dodgerSeatPoint(u,offset,y,g){const legacy=t=>{const p=curve(t);return{x:p[0],z:p[1]};},point=t=>realParkSeatRim(g,'dodger_stadium',Math.max(0,Math.min(1,t)),legacy),p=point(u),a=point(u-.00001),b=point(u+.00001),dx=b.x-a.x,dz=b.z-a.z,n=Math.hypot(dx,dz);return{x:p.x+dz/n*offset,y,z:p.z-dx/n*offset};}
export const DODGER_DECKS=Object.freeze([
 {name:'field',offset:2,depth:16,y:1.8,rise:5,trim:0,color:'#b5a469',rows:14},
 {name:'loge',offset:17,depth:13,y:10,rise:5.3,trim:.018,color:'#b49677',rows:12},
 {name:'club',offset:28,depth:6,y:18,rise:2,trim:.07,color:'#779e9d',rows:5},
 {name:'reserve',offset:31,depth:19,y:23,rise:8.5,trim:.04,color:'#7395ab',rows:16},
 {name:'top',offset:49,depth:14,y:34,rise:6.5,trim:.25,color:'#7f9eb5',rows:12}
]);
export function appendDodgerStands({geometry:g,architecture:a,face,line,tile}){
 const decks=DODGER_DECKS.slice(0,a.tiers),counts={decks:decks.length,aisles:0,rows:0,concourses:0},S=72;
 for(const d of decks){counts.rows+=d.rows;
  const point=(u,v)=>dodgerSeatPoint(u,d.offset+d.depth*v,d.y+d.rise*v,g);
  for(let i=0;i<S;i++){
   const u0=d.trim+(1-2*d.trim)*i/S,u1=d.trim+(1-2*d.trim)*(i+1)/S,aisle=i%6===0,split=u0+(u1-u0)*.3;
   for(let band=0;band<4;band++){
    const v0=band/4,v1=(band+1)/4;
    face('seats-'+d.name,[point(aisle?split:u0,v0),point(u1,v0),point(u1,v1),point(aisle?split:u0,v1)],d.color,{crowdTile:{...tile(),seatTint:d.color}});
    if(aisle){face('aisle-'+d.name,[point(u0,v0),point(split,v0),point(split,v1),point(u0,v1)],'#89918e');counts.aisles++;}
   }
   // Row edges and stair treads remain 3D circle-dot lines rather than flat bands.
   for(let row=1;row<d.rows;row++){
    const v=row/d.rows;line(point(aisle?split:u0,v),point(u1,v),'#455a66');
    if(aisle)line(point(u0,v),point(split,v),'#a1a59d');
   }
   const p=point(u0,0),q=point(u1,0);
   face('fascia-'+d.name,[{...p,y:p.y-1.8},{...q,y:q.y-1.8},q,p],'#657987');line(p,q,'#99a9af');
   face('walkway-'+d.name,[dodgerSeatPoint(u0,d.offset-2,d.y-.2,g),dodgerSeatPoint(u1,d.offset-2,d.y-.2,g),q,p],'#697773');counts.concourses++;
   const b0=point(u0,1),b1=point(u1,1),c0=dodgerSeatPoint(u0,d.offset+d.depth+3,d.y+d.rise,g),c1=dodgerSeatPoint(u1,d.offset+d.depth+3,d.y+d.rise,g);
   face('rear-concourse-'+d.name,[b0,b1,c1,c0],'#5d6d70');line(b0,b1,'#829aa7');
   face('outer-wall-'+d.name,[{...c0,y:c0.y-4},{...c1,y:c1.y-4},c1,c0],'#394d5c');
   if(d.name==='top')face('top-shade',[c0,c1,{...b1,y:b1.y+2},{...b0,y:b0.y+2}],'#798b99',{roof:true});
  }
  for(const u of [d.trim,1-d.trim]){const p=point(u,0),q=point(u,1);face('deck-end-'+d.name,[{...p,y:d.y-2},{...q,y:d.y-2},q,p],'#506672');}
 }
 return counts;
}
