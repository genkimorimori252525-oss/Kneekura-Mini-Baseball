// Presentation only. Fixture locations come from the rendered mesh, not gameplay.
export const defaultEnvironment=()=>({period:'night',weather:'clear',flags:true});
// Direction means where the air moves: 0 = home to center, 90 = toward first-base side.
export const defaultWind=()=>({directionDegrees:270,speedMps:3});
export const flagFrameDuration=wind=>wind?(wind.speedMps===0?Infinity:Math.max(90,420/(1+Math.sqrt(wind.speedMps)))):180;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),rgb=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)),hex=c=>'#'+c.map(n=>Math.round(clamp(n,0,255)).toString(16).padStart(2,'0')).join('');
export function lightingFixtures(g,m){
 if(['niikura_dome','fukuoka_dome'].includes(g.architecture?.style))return m.illuminationFixtures;
 if(g.architecture?.style==='russian_dome'){const e=m.envelope;return Array.from({length:8},(_,i)=>{const t=(i+.5)*Math.PI/4;return{x:e.rx*.78*Math.sin(t),y:e.eaveY-2,z:e.centerZ+e.rz*.78*Math.cos(t),target:{x:0,y:0,z:45}};});}
 const groups=[];for(const s of m.surfaces){if(!s.id.includes('lamp'))continue;const p=s.points.reduce((a,p)=>({x:a.x+p.x/s.points.length,y:a.y+p.y/s.points.length,z:a.z+p.z/s.points.length}),{x:0,y:0,z:0});let group=groups.find(q=>Math.hypot(q.x/q.n-p.x,q.z/q.n-p.z)<30);if(!group){group={x:0,y:0,z:0,n:0};groups.push(group);}for(const k of ['x','y','z'])group[k]+=p[k];group.n++;}
 return groups.map(p=>({x:p.x/p.n,y:p.y/p.n,z:p.z/p.n,target:{x:0,y:0,z:45}}));
}
export function fixtureContribution(f,p){const dx=p.x-f.x,dy=p.y-f.y,dz=p.z-f.z,d=Math.hypot(dx,dy,dz),ax=f.target.x-f.x,ay=f.target.y-f.y,az=f.target.z-f.z,cos=(dx*ax+dy*ay+dz*az)/(Math.max(.01,d)*Math.hypot(ax,ay,az));return clamp((cos-.25)/.75,0,1)**2/(1+(d/160)**2);}
export function createSpatialLight(g,m){const e=g.architecture.effects.environment,l=g.architecture.effects.lighting,fixtures=lightingFixtures(g,m),day=e.period==='day',on=(!day||g.architecture.style==='fukuoka_dome'&&g.architecture.roof.openingPercent<80)&&l.enabled&&l.brightness>0,tint=rgb(l.color).map(v=>v/255),reference=fixtures.reduce((v,f)=>v+fixtureContribution(f,{x:0,y:0,z:45}),0)||1,cache=new Map(),closed=['russian_dome','fukuoka_dome'].includes(g.architecture.style)&&g.architecture.roof.openingPercent<5;
 // Dodger's floodlight banks illuminate both the field and the opposite bowl.
 // Powers are photo-tuned artistic values, not measured lux or additional towers.
 const beams=['niikura_dome','fukuoka_dome'].includes(g.architecture.style)?fixtures.flatMap(f=>f.kind==='facade'?[{...f,power:f.power}]:[{...f,power:1.5},{...f,target:{x:-f.x*.65,y:20,z:55+(55-f.z)*.5},power:1.1}]):g.architecture.style==='dodger_stadium'?fixtures.flatMap(f=>[{...f,power:1.35},{...f,target:{x:-f.x*.65,y:20,z:45+(45-f.z)*.55},power:1.15}]):fixtures.map(f=>({...f,power:1}));
 const illumination=p=>{const artificial=on?beams.reduce((v,f)=>v+(g.architecture.style==='fukuoka_dome'&&f.kind==='facade'&&Math.hypot(p.x,p.z-m.envelope.centerZ)<108?0:fixtureContribution(f,p))*f.power*(['niikura_dome','fukuoka_dome'].includes(g.architecture.style)&&f.kind==='facade'?reference:1),0)/reference*l.brightness:0;
  const underRoof=closed&&Math.abs(p.x)<m.envelope.rx*.9&&Math.abs(p.z-m.envelope.centerZ)<m.envelope.rz*.9&&p.y<m.envelope.eaveY;
  const ambient=day?(underRoof?.25:e.weather==='clear'?1.08:.86):g.architecture.style==='fukuoka_dome'?(p.y>38?.42:.24):.16;return{ambient,artificial};};
 function color(c,p,emissive=false){if(emissive||!p)return c;const y=p.y??0,key=[Math.round(p.x/5),Math.round(y/10),Math.round(p.z/5)].join(','),a=cache.get(key)??illumination({x:Math.round(p.x/5)*5,y:Math.round(y/10)*10,z:Math.round(p.z/5)*5});if(!cache.has(key)){if(cache.size>=8192)cache.delete(cache.keys().next().value);cache.set(key,a);}const lit=rgb(c).map((v,i)=>v*(a.ambient+a.artificial*.84*tint[i])),peak=Math.max(...lit);if(['dodger_stadium','niikura_dome','fukuoka_dome'].includes(g.architecture.style)&&on&&peak>235)for(let i=0;i<3;i++)lit[i]*=235/peak;return hex(lit);}
 return{color,illumination,fixtures,on,day,model:'fixture-cone-distance-artistic',shadows:false};
}
const spatialCache=new WeakMap();
export function spatialLight(g,m){if(!g?.architecture?.effects?.environment)return null;let s=spatialCache.get(g);if(!s){s=createSpatialLight(g,m);spatialCache.set(g,s);}return s;}
export function flagPoint(s,u,v,frame=0,wind=null){const p=s.points,[a,b,c,d]=p,at=k=>(1-v)*(a[k]*(1-u)+b[k]*u)+v*(d[k]*(1-u)+c[k]*u),free=1-u,phase=frame*2*Math.PI/3;
 if(wind){const speed=wind.speedMps,angle=wind.directionDegrees*Math.PI/180,fill=speed/(speed+1),length=Math.hypot(a.x-b.x,a.z-b.z)*free,anchor={x:b.x*(1-v)+c.x*v,y:b.y*(1-v)+c.y*v,z:b.z*(1-v)+c.z*v},strength=speed/(speed+3),wave=Math.sin(free*6+phase+b.x*.03)*length*.15*strength;
  return{x:anchor.x+Math.sin(angle)*length*fill+Math.cos(angle)*wave+(speed===0?Math.sin(free*Math.PI*3)*free*.15:0),y:anchor.y-length*Math.sqrt(1-fill*fill)+Math.sin(free*5+phase)*length*.04*strength,z:anchor.z+Math.cos(angle)*length*fill-Math.sin(angle)*wave+(speed===0?Math.cos(free*Math.PI*3)*free*.12:0)};}
 return{x:at('x'),y:at('y')+free*.28*Math.sin(free*5+phase),z:at('z')+free*.95*Math.sin(free*6+phase)};
}
export function sampleFlags(surfaces,frame,sample,light,wind=null){const points=[];for(const s of surfaces){const nx=20,ny=12;for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){const u=i/nx,v=j/ny,p=flagPoint(s,u,v,frame,wind),c=sample(s.material,u,v)?.color??s.color;points.push({...p,color:light(c,p),alpha:1,glow:0,density:3});}}return points;}
export function paintSky(ctx,cam,e,step=10/3,radius=1){if(!e)return;const day=e.period==='day',sp=Math.sin(cam.pitch),cp=Math.cos(cam.pitch),sy=Math.sin(cam.yaw),cy=Math.cos(cam.yaw),colors=new Map();ctx.save();ctx.globalAlpha=1;ctx.shadowBlur=0;
 for(let y=step;y<432;y+=step)for(let x=step;x<600;x+=step){const rx=(x-cam.cx)/cam.f,ry=(cam.cy-y)/cam.f,up=-sp+cp*ry,forward=cp+sp*ry,wx=cy*rx+sy*forward,wz=-sy*rx+cy*forward,az=Math.atan2(wx,wz),alt=Math.atan2(up,Math.hypot(wx,wz)),h=clamp(alt/.9,0,1),cloud=clamp((Math.sin(az*3+alt*2)+Math.sin(az*7-alt*4)*.35+.2)/1.55,0,1),mix=e.weather==='cloudy'?.7+cloud*.28:cloud**4*.5;
  if(up<=0)continue;const base=day?[150-105*h,194-70*h,216-35*h]:[4+5*(1-h),9+9*(1-h),18+10*(1-h)],c=base.map((v,i)=>v*(1-mix)+(day?[207,216,220]:[20,25,34])[i]*mix),key=c.map(n=>Math.round(n/4)*4).join(',');let color=colors.get(key);if(!color){color=hex(c);colors.set(key,color);}ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();}
 ctx.restore();}
