import {DODGER_DECKS,dodgerSeatPoint} from './dodger-stands.mjs';
// Photo-derived architectural enclosure; never participates in gameplay boundaries.
export function appendDodgerEnvelope({geometry:g,architecture:a,face,line}){
 const S=72,decks=DODGER_DECKS.slice(0,a.tiers),gates=[];let wallPanels=0,soffits=0;
 const box=(id,x0,x1,z0,z1,y0,y1,color)=>{const p=[{x:x0,y:y0,z:z0},{x:x1,y:y0,z:z0},{x:x1,y:y0,z:z1},{x:x0,y:y0,z:z1}];face(id+'-top',p.map(p=>({...p,y:y1})),color);for(let i=0;i<4;i++)face(id+'-side',[p[i],p[(i+1)%4],{...p[(i+1)%4],y:y1},{...p[i],y:y1}],color);};
 const panel=(id,x0,x1,y0,y1,z,color,material=null)=>face(id,[{x:x0,y:y0,z},{x:x1,y:y0,z},{x:x1,y:y1,z},{x:x0,y:y1,z}],color,{material});
 for(const d of decks){const outer=d.offset+d.depth+3,top=d.y+d.rise,wallTop=Math.max(0,top-4),point=(u,y,o=outer)=>dodgerSeatPoint(u,o,y,g);
  for(let i=0;i<S;i++){const u0=d.trim+(1-2*d.trim)*i/S,u1=d.trim+(1-2*d.trim)*(i+1)/S,opening=i===5||i===6||i===35||i===36||i===65||i===66,lo=opening?3.8:0,p=point(u0,lo),q=point(u1,lo);
   if(wallTop>lo){face('facade-'+d.name,[p,q,point(u1,wallTop),point(u0,wallTop)],'#aeb7b4',{material:'dodger:facade:'+d.name});wallPanels++;}
   if(opening)gates.push({deck:d.name,u0,u1,height:Math.min(3.8,wallTop),outerOffset:outer});
   face('facade-plinth',[point(u0,.06),point(u1,.06),point(u1,.06,outer+1.5),point(u0,.06,outer+1.5)],'#707f82');
   face('soffit-'+d.name,[point(u0,d.y-.55,d.offset),point(u1,d.y-.55,d.offset),point(u1,top-.55),point(u0,top-.55)],'#8d9b9d');soffits++;
   if(i%4===0){const c=point(u0,0,outer+.2);box('facade-column',c.x-.45,c.x+.45,c.z-.45,c.z+.45,0,wallTop,'#bec6c1');}
   if(i%6===0)line(point(u0,Math.min(wallTop,3.1)),point(u1,Math.min(wallTop,3.1)),'#4c7896',2);
  }
 }
 // Rear faces of both outfield pavilions, with open circulation bays.
 for(const side of [-1,1])for(let i=0;i<12;i++){const p={x:side*(12+i*68/12),y:0,z:144.8-i*40/12},q={x:side*(12+(i+1)*68/12),y:0,z:144.8-(i+1)*40/12},lo=i%4===1?3.5:0;
  face('pavilion-rear-wall',[{...p,y:lo},{...q,y:lo},{...q,y:9},{...p,y:9}],'#b1babb',{material:'dodger:facade:pavilion'});wallPanels++;
  face('pavilion-soffit',[{...p,y:9},{...q,y:9},{...q,y:9,z:q.z-17},{...p,y:9,z:p.z-17}],'#7e8f93');
 }
 // A centerfield entrance beyond the pavilions; the central path stays open.
 face('entry-plaza',[{x:-100,y:-.04,z:153},{x:100,y:-.04,z:153},{x:100,y:-.04,z:203},{x:-100,y:-.04,z:203}],'#667a7f');
 for(const side of [-1,1]){
  const x0=side<0?-103:22,x1=side<0?-22:103;box('entry-boundary',x0,x1,181.5,182.5,0,2.7,'#326c93');
  box('entry-link',side<0?-24:18,side<0?-18:24,150,185,6.7,7.2,'#a7b3b5');
  for(const x of [side*18,side*23]){line({x,y:7.3,z:150},{x,y:7.3,z:185},'#658fa7',2);line({x,y:8.3,z:150},{x,y:8.3,z:185},'#658fa7',2);}
  for(let i=0;i<16;i++){const z=185-i*1.4,y=(i+1)*7.2/16;box('entry-stair',side<0?-34:25,side<0?-25:34,z-1.4,z,0,y,'#84999e');}
  for(const z of [151,167,183])box('entry-pier',side*21-.45,side*21+.45,z-.45,z+.45,0,6.7,'#b8c1bd');
 }
 for(const x of [-18,-6,6,18])box('entry-post',x-.35,x+.35,183,184,0,9.2,'#5a91a9');
 box('entry-bridge',-20,20,181,187,7.2,7.7,'#5a7e92');
 for(let x=-18;x<=18;x+=3)line({x,y:7.7,z:186},{x,y:8.9,z:186},'#8aaab6',2);line({x:-20,y:8.9,z:186},{x:20,y:8.9,z:186},'#8aaab6',2);
 panel('entry-score-welcome',-19.8,19.8,5,7.2,187.05,'#137dbb',a.details?.logos===false?null:'dodger:entry-welcome');
 panel('entry-score-script',-11,11,9,13.5,184.1,'#24485e',a.details?.logos===false?null:'dodger:entry-script');
 return{wallPanels,soffits,gates,centerfieldGate:{x:0,z:187,clearWidth:11.3,clearHeight:5},approximation:'photo-derived-not-surveyed'};
}
