import {wallAt} from './model.mjs';
import {defaultScoreboard,runs} from './scoreboard.mjs';
import {appendDodgerStands,dodgerSeatPoint} from './dodger-stands.mjs';
import {appendDodgerEnvelope} from './dodger-envelope.mjs';
import {appendDodgerLandscape} from './dodger-landscape.mjs';
const rad=d=>d*Math.PI/180;
/** Photo-derived architecture. Listed field dimensions are supplied by the validated model. */
export function dodgerMesh(g){const a=g.architecture,surfaces=[],segments=[],lights=[],c=a.colors,score=a.scoreboard??defaultScoreboard();let tiles=0;
 const face=(id,points,color,{roof=false,crowdTile=null,material=null}={})=>surfaces.push({id:'dodger-'+id+'-'+surfaces.length,points,color,roof,crowdTile,material,detailDensity:/^(seats|aisle|fascia|walkway|rear-concourse|outer-wall|deck-end|pavilion|lamp|facade|soffit|entry)/.test(id)?3:1}),
  line=(p,q,color,detailDensity=1)=>segments.push({p,q,color,roof:false,detailDensity}),
  panel=(id,x0,x1,y0,y1,z,color,material=null)=>face(id,[{x:x0,y:y0,z},{x:x1,y:y0,z},{x:x1,y:y1,z},{x:x0,y:y1,z}],color,{material}),
  seat=(theta,offset,y)=>{const w=wallAt(g,theta);return {x:Math.sin(theta)*(w.distanceMeters+offset),y,z:Math.cos(theta)*(w.distanceMeters+offset)};},
  tile=()=>({id:tiles++,tier:0,band:0,sector:tiles});
 // The black center batter's eye remains separate from the two pavilions.
 const angles=[...new Set([...Array.from({length:81},(_,i)=>-Math.PI+i*Math.PI/40),...g.vertices.map(p=>p.angleDegrees*Math.PI/180)])].sort((a,b)=>a-b);
 for(let i=0;i<angles.length-1;i++){const t0=angles[i],t1=angles[i+1],w0=wallAt(g,t0),w1=wallAt(g,t1);
  face('wall',[{...w0.position,y:0},{...w1.position,y:0},{...w1.position,y:w1.heightMeters},{...w0.position,y:w0.heightMeters}],'#2978b7');}
 const seating=appendDodgerStands({geometry:g,architecture:a,face,line:(p,q,c)=>line(p,q,c,3),tile});
 for(let i=0;i<96;i++){const p=dodgerSeatPoint(i/96,2,0,g),q=dodgerSeatPoint((i+1)/96,2,0,g),w=wallAt(g,Math.atan2(p.x,p.z)).position,v=wallAt(g,Math.atan2(q.x,q.z)).position;
  face('apron',[{...w,y:0},{...v,y:0},q,p],'#49453e');}
 for(const side of [-1,1]){const p={x:side*27,y:1.5,z:18},q={x:side*50,y:1.5,z:41},offset=p=>({...p,x:p.x+side*3.8,z:p.z-3.8});
  face('dugout-roof',[p,q,offset(q),offset(p)],'#1e5183');face('dugout-front',[{...p,y:0},{...q,y:0},q,p],'#102333');line(p,q,'#7e9ba9');}
 // Two long outfield bleacher blocks with open center and bullpen gaps.
 for(const side of [-1,1]){
  for(let section=0;section<12;section++)for(let band=0;band<6;band++){
   const point=(section,band)=>({x:side*(12+section*68/12),y:3+band*1.3,z:126-section*40/12+band*3.1}),p=point(section,band),q=point(section+1,band),r=point(section+1,band+1),s=point(section,band+1);
   face('pavilion',[p,q,r,s],'#839ca7',section%4===0?{}:{crowdTile:{...tile(),seatTint:'#839ca7'}});line(p,q,'#465f6e');
   if(band===0)face('pavilion-front',[{...p,y:.6},{...q,y:.6},q,p],'#2f6791');
  }
  // Scalloped pavilion canopy echoes the characteristic undulating roof edge.
  for(let i=0;i<24;i++){const x0=side*(12+i*68/24),x1=side*(12+(i+1)*68/24),z0=146-i*40/24,z1=146-(i+1)*40/24,h0=12+Math.sin(i*Math.PI/6)*.3,h1=12+Math.sin((i+1)*Math.PI/6)*.3;
   face('pavilion-canopy',[{x:x0,y:h0,z:z0},{x:x1,y:h1,z:z1},{x:x1,y:h1+.6,z:z1+5},{x:x0,y:h0+.6,z:z0+5}],'#8399a5',{roof:true});
  }
  // Blue bullpen wall and walking concourse; no fake seats over the playing field.
  panel('bullpen',side<0?-92:73,side<0?-73:92,0,3.2,102,'#337fb7');
  for(const x of [side*18,side*68])line({x,y:0,z:154},{x,y:14,z:154},'#62747e');
 }
 panel('eye',-10,10,0,11,wallAt(g,0).distanceMeters+2,'#172e29');
 panel('eye-upper',-9,9,11,15,wallAt(g,0).distanceMeters+7,'#20382c');
 for(const side of [-1,1]){const w=wallAt(g,side*Math.PI/4),p={...w.position,y:0};line(p,{...p,y:29},'#e6c734');line({...p,x:p.x+side*.65},{...p,x:p.x+side*.65,y:29},'#d1b72f');}
 // Independent left video board and right scoreboard with white sculpted caps.
 const boards=[];
 for(const side of [-1,1]){const x=side*55,z=145,y=23,w=34,h=17;boards.push({x,z,baseY:y,width:w,height:h});
  for(const dx of [-10,10]){panel('board-support',x+dx-.65,x+dx+.65,4,y,z+2,'#9caaad');}
  panel('board-back',x-w/2-1,x+w/2+1,y-1,y+h+1,z+1.5,'#28495e');
  if(a.details?.logos!==false)panel('board-rear-mark',x-w/2,x+w/2,y,y+h,z+1.52,'#164b79','dodger:rear-la');
  panel('board-service',x-w/2-3,x+w/2+3,0,6,z+3,'#33434a');
  panel('board-front',x-w/2-1,x+w/2+1,y-1,y+h+1,z,'#e4ebea');
  if(score.enabled)panel('display',x-w/2,x+w/2,y,y+h,z-.08,'#091928',side===1?'dodger:score':'dodger:wordmark');
  else panel('display-off',x-w/2,x+w/2,y,y+h,z-.08,'#14212a');
  face('board-cap',[{x:x-w/2-1,y:y+h,z},{x:x-w/2+3,y:y+h+2.4,z},{x:x+w/2-3,y:y+h+2.4,z},{x:x+w/2+1,y:y+h,z}],'#e4ebea');
  panel('76-sign',x-3,x+3,y+h+3,y+h+9,z,'#ed6a30','dodger:76');
 }
 // Six towers, with a light rack and sparse bracing in real world space.
 for(const [x,z]of [[-100,-5],[100,-5],[-115,77],[115,77],[-55,152],[55,152]]){
  const top=54;
  for(const dx of [-5,-1.7,1.7,5])line({x:x+dx*.65,y:5,z},{x:x+dx,y:top,z},'#3c4c59');
  for(let y=14;y<top;y+=10)line({x:x-4,y,z},{x:x+4,y:y+9,z},'#303e48');
  panel('light-rack',x-9,x+9,top,top+4.2,z,'#879199');
  for(let row=0;row<3;row++)for(let i=0;i<12;i++)panel('lamp',x-8.5+i*1.45,x-7.7+i*1.45,top+.3+row*1.3,top+1.2+row*1.3,z-.03,'#eeeede');
 }
 // Painted fascia and signs use the same UV material pathway as the Tambov wolf.
 if(a.details?.logos!==false){
  panel('stadium-sign',-22,22,35,42,-67,'#0d4984','dodger:stadium');
  for(const x of [-94,-28,28,94])panel('ribbon',x-13,x+13,10,13,124-Math.abs(x)*.15,'#17539a','dodger:ribbon');
  panel('center-distance',-3,3,0,1.4,wallAt(g,0).distanceMeters-.06,'#2e78af','dodger:distance');
  for(const x of [-91,-76,-27,-17,17,27,76,91]){const z=146-Math.abs(x)*.32;panel('small-sign',x-5,x+5,15,18.5,z,'#23333d','dodger:ribbon');for(const dx of [-3,3])line({x:x+dx,y:8,z:z+1},{x:x+dx,y:15,z:z+1},'#56636a');}
 }
 // Terrain and canopy groups replace upright forest cards and individual palms.
 const enclosure=appendDodgerEnvelope({geometry:g,architecture:a,face,line});
 const landscape=appendDodgerLandscape(g,face);
 return {surfaces,segments,lights,seating,landscape,enclosure,lightTowers:6,capacity:a.capacity,tiers:a.tiers,rowsPerTier:16,outerOffset:50,
  envelope:{rx:142,rz:139,centerZ:48,frontZ:-75,bowlTop:43,eaveY:43,topY:57,exponent:2},
  roof:{type:'open',openingPercent:100,halfX:0,z0:0,z1:0,y:0},spectatorLights:0,spectatorTiles:tiles,
  scoreboard:{enabled:score.enabled,mode:'DESIGN_SAMPLE',boards,x:55,z:145,baseY:23,scale:.55,width:34,teams:score.teams.map(t=>({...t,runs:runs(t)})),balls:score.balls,strikes:score.strikes,outs:score.outs,speedKmh:score.speedKmh}};
}
