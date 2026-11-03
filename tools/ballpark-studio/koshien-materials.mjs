import {mipPyramid,sampleMip} from './texture-filter.mjs';import {defaultScoreboard,runs} from './scoreboard.mjs';
import {scoreboardFieldDiagram,projectFieldDiagramPoint,SCOREBOARD_BASES} from './scoreboard-field.mjs';
const cache=new Map(),scores=new WeakMap();
export const KOSHIEN_BOARD=Object.freeze({width:62,bodyHeight:21,baseY:9,topY:30,z:144,screenWidth:59,screenHeight:18.8,clockTop:44});
export const KOSHIEN_FACADE_SECTORS=84;
// Mound footprint matches the frozen renderer; cover placement/size are photo estimates.
export const KOSHIEN_MOUND=Object.freeze({center:Object.freeze({x:0,z:17.9832}),radius:2.7432,cover:Object.freeze({x:-.35,z:19.65,radius:.24})});
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
/** Periodic canopy masses along the whole facade, not a repeating per-panel patch. */
export function koshienIvyCoverage(u,height){const t=u*Math.PI*2,climb=12+7*Math.sin(t*4+.3)+4*Math.sin(t*9-.5),
 edge=climb+1.5*Math.sin(t*22)-height,body=.5+.3*Math.sin(t*7+height*.18)+.18*Math.cos(t*13-height*.21);
 return smooth((edge+1)/2.5)*smooth((body-.15)/.35);}
export function koshienGround(p,base){if(!p||!base)return base;const{x,z}=p,soil=(x/31)**2+((z-18.4404)/30)**2<1;
 if(soil){const light=1+.035*Math.sin(x*.7+z*.4);let color=[66,53,45].map(c=>c*light);
  if(Math.abs(x)<3.1&&Math.abs(z-KOSHIEN_MOUND.center.z)<3.1){const m=KOSHIEN_MOUND,d=Math.hypot(x,z-m.center.z),weight=smooth((m.radius+.24-d)/.5),
   ring=18*Math.exp(-(((d-2.15)/.32)**2)),wear=22*Math.exp(-((x/.8)**2+((z-18.35)/.95)**2)),grain=2*Math.sin(x*11+z*5)*Math.cos(x*4-z*7),
   earth=[112,102,85].map(c=>c+ring-wear+grain-(z-m.center.z)*1.5);color=color.map((c,i)=>c+(earth[i]-c)*weight);
   const c=m.cover,coverDistance=Math.hypot(x-c.x,z-c.z);if(coverDistance<=c.radius){const rim=coverDistance>c.radius-.025,slot=Math.abs(x-c.x)<.075&&Math.abs(Math.abs(z-c.z)-.065)<.012;
    color=rim?[100,98,84]:slot?[103,102,88]:[163,158,138].map(v=>v+Math.sin(x*54+z*63)*2);}
  }
  return{...base,color:'#'+color.map(c=>Math.max(0,Math.min(255,Math.round(c))).toString(16).padStart(2,'0')).join(''),alpha:.94};}
 const c=[1,3,5].map(i=>parseInt(base.color.slice(i,i+2),16));if(c[1]>c[0]*1.3&&c[1]>c[2]*1.2){const k=Math.floor((x*.3+z)/7)%2===0?1:.86;return{...base,color:'#'+[61,105,47].map(c=>Math.round(c*k).toString(16).padStart(2,'0')).join('')};}return base;}
function texture(part,g){if(typeof document==='undefined')return null;const dynamic=part==='koshien:score'||part==='koshien:clock',entry=scores.get(g),old=dynamic?entry?.[part]:cache.get(part);if(old)return old;
 const c=document.createElement('canvas');c.width=part==='koshien:facade-wrap'?4096:part==='koshien:score'?1792:part==='koshien:clock'?512:part.startsWith('koshien:flag')||part==='koshien:tower'||part==='koshien:sankyu-side'?256:1024;c.height=part==='koshien:score'?576:part==='koshien:clock'?896:part==='koshien:backscreen'?256:part==='koshien:sankyu-side'?512:part.startsWith('koshien:flag')?160:part==='koshien:tower'?1024:['koshien:facade-wrap','koshien:roof'].includes(part)?512:128;const x=c.getContext('2d',{willReadFrequently:true});x.fillStyle=dynamic?'#080d0e':'#153e35';x.fillRect(0,0,c.width,c.height);x.textAlign='center';x.textBaseline='middle';x.fillStyle='#eceee7';
 if(part==='koshien:score'){const s=g.architecture.scoreboard??defaultScoreboard(),order=[...'一二三四五六七八九'],positions=['左翼','二塁','中堅','一塁','三塁','右翼','捕手','遊撃','投手'],vertical=(text,cx,cy,size)=>{x.font=`bold ${size}px sans-serif`;[...text].forEach((ch,i)=>x.fillText(ch,cx,cy+i*(size+4)));};
  // Batting slots show position labels, never fabricated player names or records.
  order.forEach((v,i)=>{const cx=170+i*56;x.font='bold 34px sans-serif';x.fillText(v,cx,43);vertical(positions[i],cx,113,35);x.font='bold 36px monospace';x.fillText(String([7,4,8,3,5,9,2,6,1][i]),cx,242);x.fillText(String([8,6,4,3,7,9,5,2,1][i]),cx,301);vertical(positions[(i+2)%9],cx,374,35);});
  for(let row=0;row<2;row++){const name=s.teams[row].name;vertical(name,62,row?348:111,Math.min(46,155/name.length));}
  x.font='bold 31px sans-serif';[...order,'計','H','E'].forEach((v,i)=>x.fillText(v,852+i*72,46));
  s.teams.forEach((t,row)=>{const y=114+row*66;x.font='bold 34px sans-serif';x.fillText(t.name,755,y,130);x.font='bold 43px monospace';[...t.innings,runs(t),t.hits,t.errors].forEach((v,i)=>x.fillText(v===null?'–':String(v),852+i*72,y));});
  x.strokeStyle='#53605a';x.lineWidth=2;x.beginPath();x.moveTo(716,232);x.lineTo(1750,232);x.stroke();
  const diagram=scoreboardFieldDiagram(g.architecture),point=p=>{const q=projectFieldDiagramPoint(p);return{x:800+q.u*400,y:250+q.v*300};};
  if(diagram?.enabled){const home=point({x:0,z:0}),bases=SCOREBOARD_BASES.map(point);x.strokeStyle='#9ca99d';x.lineWidth=2;x.beginPath();x.moveTo(home.x,home.y);for(const b of bases)x.lineTo(b.x,b.y);x.closePath();x.stroke();
   for(const b of SCOREBOARD_BASES){const q=point(b),r=9;x.fillStyle=diagram.runners[b.id]?'#8cdf7d':'#14231c';x.strokeStyle=diagram.runners[b.id]?'#b4f49e':'#697c6a';x.beginPath();x.moveTo(q.x,q.y-r);x.lineTo(q.x+r,q.y);x.lineTo(q.x,q.y+r);x.lineTo(q.x-r,q.y);x.closePath();x.fill();x.stroke();}
   for(const d of diagram.defenders){const q=point(d);x.fillStyle='#e5e9de';x.font='bold 26px sans-serif';x.fillText(d.label,q.x,q.y,76);}
  }
  x.fillStyle='#eceee7';
  x.font='bold 30px sans-serif';x.fillText('球 速',1458,302);x.font='bold 56px monospace';x.fillText(s.speedKmh.toFixed(1),1420,375);x.font='32px sans-serif';x.fillText('km/h',1632,381);x.font='29px sans-serif';x.fillText('阪神甲子園球場',1460,459);x.font='24px sans-serif';x.fillText('表示見本 · 左欄は守備位置',1440,507);
  x.strokeStyle='#46504b';x.beginPath();x.moveTo(8,542);x.lineTo(1784,542);x.stroke();x.font='bold 26px sans-serif';x.textAlign='right';x.fillText('三井住友銀行',1754,560);
 }else if(part==='koshien:clock'){const s=g.architecture.scoreboard??defaultScoreboard(),cx=256,cy=216,r=181;x.fillStyle='#222b2d';x.fillRect(0,0,512,896);x.strokeStyle='#e9ece6';x.fillStyle='#e9ece6';x.lineWidth=5;
  for(let i=0;i<12;i++){const t=i*Math.PI/6,outer=177,inner=i%3===0?151:161;x.beginPath();x.moveTo(cx+Math.sin(t)*inner,cy-Math.cos(t)*inner);x.lineTo(cx+Math.sin(t)*outer,cy-Math.cos(t)*outer);x.stroke();}
  x.font='bold 56px sans-serif';for(const [text,xx,yy]of [['12',cx,cy-r+35],['3',cx+r-33,cy],['6',cx,cy+r-33],['9',cx-r+33,cy]])x.fillText(text,xx,yy);
  x.lineWidth=12;x.lineCap='round';for(const [angle,length]of [[-Math.PI/3,91],[Math.PI/3,133]]){x.beginPath();x.moveTo(cx,cy);x.lineTo(cx+Math.sin(angle)*length,cy-Math.cos(angle)*length);x.stroke();}x.font='bold 75px Georgia';x.fillText('CITIZEN',256,453,490);
  for(const [row,name,count,max,color]of [[0,'B',s.balls,3,'#49d782'],[1,'S',s.strikes,2,'#f0d33e'],[2,'O',s.outs,2,'#ef4444']]){const y=565+row*117;x.fillStyle='#eeeee5';x.font='bold 66px sans-serif';x.fillText(name,67,y);for(let i=0;i<max;i++){x.fillStyle=s.enabled&&i<count?color:'#10201c';x.beginPath();x.arc(184+i*105,y,27,0,Math.PI*2);x.fill();}}
 }else if(part.startsWith('koshien:flag')){x.fillStyle=part==='koshien:flag-japan'?'#dedfd8':part==='koshien:flag-team'?'#c9b74d':'#354f5d';x.fillRect(0,0,256,160);if(part==='koshien:flag-japan'){x.fillStyle='#ad3a3b';x.beginPath();x.arc(128,80,43,0,Math.PI*2);x.fill();}else if(part==='koshien:flag-team'){x.fillStyle='#2e3332';for(let i=1;i<5;i+=2)x.fillRect(0,i*32,256,32);}else{x.font='bold 48px sans-serif';x.fillStyle='#d7ddd7';x.fillText('K',128,84);}
 }else if(part==='koshien:facade-wrap'){
  // A single continuous panorama keeps vegetation coherent across sectors and floors.
  for(let iy=0;iy<128;iy++)for(let ix=0;ix<1024;ix++){const u=ix/1024,h=(1-iy/128)*29,cover=koshienIvyCoverage(u,h),light=.97+.03*Math.sin(u*Math.PI*74+h*.27),stone=[165,158,135],ivy=[49,79+8*Math.sin(u*Math.PI*18+h*.23),38];
   x.fillStyle='rgb('+stone.map((n,k)=>Math.round((n+(ivy[k]-n)*cover)*light)).join(',')+')';x.fillRect(ix*4,iy*4,4,4);}
  // The dark upper gallery, small windows and arched openings remain exposed.
  x.fillStyle='#25463c';x.fillRect(0,0,4096,59);x.fillStyle='#819181';x.fillRect(0,57,4096,3);x.fillRect(0,207,4096,3);
  const count=126,spacing=4096/count;
  for(let col=0;col<count;col++){const cx=(col+.5)*spacing;
   for(const h of [22,14,9]){const y=(1-h/29)*512;x.fillStyle='#bec1ab';x.fillRect(cx-6,y-18,12,36);x.fillStyle='#18342e';x.fillRect(cx-4,y-15,8,29);x.fillStyle='#87917d';x.fillRect(cx-6,y+16,12,3);}
   x.fillStyle='#1b4638';x.beginPath();x.moveTo(cx-10,512);x.lineTo(cx-10,459);x.arc(cx,459,10,Math.PI,Math.PI*2);x.lineTo(cx+10,512);x.closePath();x.fill();x.strokeStyle='#a5b09a';x.lineWidth=2;x.stroke();
  }
 }else if(part==='koshien:sankyu-side'){x.fillStyle='#214c39';x.fillRect(0,0,256,512);x.fillStyle='#d8bd43';x.font='bold 192px sans-serif';x.fillText('山',128,145,226);x.fillText('九',128,365,226);
 }else if(part==='koshien:sankyu'){x.fillStyle='#e0e6de';x.fillRect(0,0,1024,128);x.strokeStyle='#a7b8b3';x.lineWidth=5;x.strokeRect(3,3,1018,122);x.fillStyle='#286aab';x.beginPath();x.arc(73,65,48,0,Math.PI*2);x.fill();x.fillStyle='#dfe7df';x.font='bold 20px sans-serif';x.fillText('山九',73,55);x.font='bold 14px sans-serif';x.fillText('SANKYU',73,77);x.fillStyle='#2c659b';x.font='bold 83px sans-serif';x.fillText('SANKYU',570,83,840);x.font='18px sans-serif';x.fillText('総合物流サービス',570,22);
 }else if(part==='koshien:backscreen'){x.fillStyle='#15392c';x.fillRect(0,0,1024,256);x.fillStyle='#234536';for(let i=0;i<86;i++)x.fillRect(i*12,0,2,256);x.fillStyle='#102b23';x.fillRect(0,126,1024,3);
 }else if(part==='koshien:roof'){x.fillStyle='#a2acae';x.fillRect(0,0,1024,512);for(let i=0;i<18;i++){x.fillStyle=i%4===0?'#c0c7c6':'#7e9094';x.fillRect(i*60,0,3,512);}x.fillStyle='#62777e';for(let i=0;i<8;i++)x.fillRect(40+i*122,235,96,220);
 }else if(part==='koshien:tower'){x.font='bold 170px sans-serif';[...'甲子園'].forEach((c,i)=>x.fillText(c,128,240+i*250));}
 else {const labels={'koshien:entrance':'阪神甲子園球場','koshien:wall':'HANSHIN  KOSHIEN','koshien:header':'阪 神 甲 子 園 球 場','koshien:distance':'118m','koshien:vision':'MITSUBISHI オーロラビジョン'};x.font='bold 100px sans-serif';x.fillText(labels[part]??'KOSHIEN',512,64,980);}
 const t=mipPyramid({width:c.width,height:c.height,data:x.getImageData(0,0,c.width,c.height).data});if(dynamic){const slots=entry??{};slots[part]=t;scores.set(g,slots);}else cache.set(part,t);return t;}
export function sampleKoshienMaterial(part,u,v,profile,g){let fu=profile?.footprintU??0,fv=profile?.footprintV??0;if(part.startsWith('koshien:ivy:')||part.startsWith('koshien:facade:')){const lower=part.startsWith('koshien:ivy:'),sector=Number(part.slice(part.lastIndexOf(':')+1));u=(sector+u)/KOSHIEN_FACADE_SECTORS;v=(lower?v*17:17+v*12)/29;fu/=KOSHIEN_FACADE_SECTORS;fv*=(lower?17:12)/29;part='koshien:facade-wrap';}const t=texture(part,g);if(!t)return null;const s=sampleMip(t,u,1-v,fu,fv);return s?{color:'#'+[s.r,s.g,s.b].map(c=>Math.round(c).toString(16).padStart(2,'0')).join('')}:null;}
