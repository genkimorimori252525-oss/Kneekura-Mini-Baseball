export const DEFAULT_DODGER_ATMOSPHERE=Object.freeze({period:'night',strength:.35});
const scenes=new WeakMap(),TAU=Math.PI*2,N=48,RINGS=[.7,1.04,1.17,1.33,1.59,1.89,2.3];
const clamp=t=>Math.max(0,Math.min(1,t)),smooth=t=>{t=clamp(t);return t*t*(3-2*t);},
 hash=(x,z)=>((Math.imul(x+51,73856093)^Math.imul(z+17,19349663))>>>0)/4294967296;
function scene(g){if(scenes.has(g))return scenes.get(g);
 const far=Math.max(...g.fencePoints.map(p=>p.distanceMeters)),rx=Math.max(152,far*.95+30),rz=Math.max(144,far*.75+50),patches=[];
 const radius=(x,z)=>Math.hypot(x/rx,(z-45)/rz),
  ground=(x,z)=>{const r=radius(x,z),h=27*Math.exp(-(((x+200)/145)**2+((z-255)/125)**2))+23*Math.exp(-(((x-190)/155)**2+((z-280)/130)**2))+16*Math.exp(-((x/180)**2+((z+290)/110)**2));return -1+smooth((r-1.15)/.8)*(4+h);},
  polar=(t,r)=>{const x=Math.sin(t)*rx*r,z=45+Math.cos(t)*rz*r;return{x,y:ground(x,z),z};},
  add=(kind,points,group=null)=>patches.push({kind,points,group});
 for(let ring=0;ring<RINGS.length-1;ring++)for(let i=0;i<N;i++){
  const r0=RINGS[ring],r1=RINGS[ring+1],t0=i*TAU/N,t1=(i+1)*TAU/N,
   kind=ring===0?'plaza':ring===1?'road':ring<5?'parking':'hill';
  add(kind,[polar(t0,r0),polar(t1,r0),polar(t1,r1),polar(t0,r1)]);
 }
 // Every entry is a broad irregular grove; no trunks or individual tree objects.
 const groves=[[-32,1.78,43,26,8],[0,1.86,57,30,10],[34,1.78,45,26,8],[-75,1.78,40,24,7],[75,1.78,40,24,7],
  [-112,1.87,52,25,7],[112,1.87,52,25,7],[-148,1.95,48,29,8],[148,1.95,48,29,8],[180,1.92,58,27,7],
  [-55,1.36,24,12,5],[55,1.36,24,12,5],[-98,1.42,25,12,5],[98,1.42,25,12,5],[-139,1.4,27,12,5],[139,1.4,27,12,5],[176,1.37,30,12,5]];
 groves.forEach(([degrees,r,tangent,radial,height],index)=>{
  const t=degrees*Math.PI/180,c=polar(t,r),s=Math.sin(t),q=Math.cos(t),
   point=(angle,k)=>{const irregular=1+.12*Math.sin(angle*3+index)+.07*Math.cos(angle*5-index),a=Math.cos(angle)*tangent*k*irregular,b=Math.sin(angle)*radial*k*irregular,
     x=c.x+q*a+s*b,z=c.z-s*a+q*b,y=ground(x,z)+.3+height*Math.sqrt(Math.max(0,1-k*k))*(.96+.04*k*Math.sin(angle*2+index));return{x,y,z};};
  for(const [r0,r1]of [[0,.57],[.57,1]])for(let i=0;i<12;i++){const t0=i*TAU/12,t1=(i+1)*TAU/12;add('canopy',[point(t0,r0),point(t1,r0),point(t1,r1),point(t0,r1)],{x:c.x,z:c.z,tangent,radial,index});}
 });
 const result={patches,rx,rz,innerRadius:RINGS[0],groves:groves.length,parkingPatches:patches.filter(p=>p.kind==='parking').length};scenes.set(g,result);return result;
}
/** Terrain and grouped crowns share the stadium's world, projection and depth. */
export function appendDodgerLandscape(g,face){const a=g.architecture.atmosphere??DEFAULT_DODGER_ATMOSPHERE;
 if(a.strength===0)return {enabled:false,...a,layers:0,individualTrees:0};
 const s=scene(g);s.patches.forEach((p,i)=>face(p.kind,p.points,'#000000',{material:'dodger:landscape:'+i}));
 return {enabled:true,...a,worldSpace:true,rx:s.rx,rz:s.rz,innerRadius:s.innerRadius,groves:s.groves,parkingPatches:s.parkingPatches,individualTrees:0,individualCars:0};
}
export function landscapeMaterial(part,u,v,g,profile=null){const s=scene(g),p=s.patches[Number(part.slice(part.lastIndexOf(':')+1))];if(!p)return null;
 const mix=key=>{const a=p.points[0][key]*(1-u)+p.points[1][key]*u,b=p.points[3][key]*(1-u)+p.points[2][key]*u;return a*(1-v)+b*v;},x=mix('x'),z=mix('z'),
  a=g.architecture.atmosphere??DEFAULT_DODGER_ATMOSPHERE,day=a.period==='day',r=Math.hypot(x/s.rx,(z-45)/s.rz),fade=1-smooth((r-1.85)/.45),
  noise=.94+.035*Math.sin(x*.037+z*.027)+.025*Math.sin(x*.11-z*.08),gain=Math.sqrt(a.strength)*fade*noise,
  palette=day?{plaza:[111,114,109],road:[80,86,87],parking:[125,128,120],hill:[99,110,82],canopy:[55,88,60]}:{plaza:[27,34,36],road:[22,28,31],parking:[34,40,41],hill:[28,41,34],canopy:[27,47,35]};
 let color=palette[p.kind],light=1;
 if(p.kind==='canopy')light=.83+.12*Math.sin(x*.043+z*.031)+.05*Math.cos(z*.09);
 if(p.kind==='road'){const lane=Math.abs((r-1.105)*s.rx);if(lane<.18)color=day?[145,143,118]:[43,47,43];}
 if(p.kind==='parking'){
  // Grouped bay marks are one ground material, never individual car actors.
  const xx=x*.94+z*.34,zz=z*.94-x*.34,band=((zz%21)+21)%21,bay=((xx%3)+3)%3,bx=Math.floor(xx/3),bz=Math.floor(zz/21);
  if(band<.16||(band>6&&band<15&&bay<.12))color=day?[155,157,146]:[43,49,49];
  else if(band>6&&band<14&&bay>.6&&bay<2.4&&hash(bx,bz)>.36){const h=hash(bx+37,bz+11);color=day?[88+62*h,95+57*h,98+53*h]:[28+15*h,36+14*h,42+12*h];}
 }
 const haze=smooth(((profile?.depth??260)-150)/500)*.22,fog=day?[105,124,130]:[19,28,31];
 return {color:'#'+color.map((c,i)=>Math.max(0,Math.min(255,Math.round((c*light*(1-haze)+fog[i]*haze)*gain))).toString(16).padStart(2,'0')).join('')};
}
