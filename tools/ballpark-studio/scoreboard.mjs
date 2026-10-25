import {mipPyramid,sampleMip} from './texture-filter.mjs';
export function defaultScoreboard(){return {enabled:true,teams:[
 {name:'TBD',innings:[0,0,1,0,0,2,0,1,0],hits:8,errors:0},
 {name:'LAD',innings:[1,0,0,0,0,0,1,0,0],hits:6,errors:1}],balls:3,strikes:2,outs:2,speedKmh:148};}
export const runs=team=>team.innings.reduce((n,v)=>n+(v??0),0);
export function validateScoreboard(s,error){
 const path='architecture.scoreboard',object=(o,keys,p)=>{if(!o||typeof o!=='object'||Array.isArray(o)){error(p,'オブジェクトを指定してください');return false;}for(const k of Object.keys(o))if(!keys.includes(k))error(p+'.'+k,'未対応の表示項目です');return true;},
  integer=(v,min,max,p)=>{if(!Number.isInteger(v)||v<min||v>max)error(p,`${min}〜${max}の整数を入力してください`);};
 if(!object(s,['enabled','teams','balls','strikes','outs','speedKmh'],path))return;
 if(typeof s.enabled!=='boolean')error(path+'.enabled','表示の有無を指定してください');
 if(!Array.isArray(s.teams)||s.teams.length!==2)error(path+'.teams','2チームを指定してください');
 else s.teams.forEach((t,i)=>{const p=path+'.teams.'+i;if(!object(t,['name','innings','hits','errors'],p))return;
  if(typeof t.name!=='string'||t.name.trim().length<1||t.name.length>12||/[\x00-\x1f<>]/.test(t.name))error(p+'.name','チーム名は1〜12文字で入力してください');
  if(!Array.isArray(t.innings)||t.innings.length!==9)error(p+'.innings','1〜9回の9個を指定してください');else t.innings.forEach((v,j)=>{if(v!==null)integer(v,0,99,p+'.innings.'+j);});
  integer(t.hits,0,999,p+'.hits');integer(t.errors,0,99,p+'.errors');
 });
 for(const [k,max]of [['balls',3],['strikes',2],['outs',2]])integer(s[k],0,max,path+'.'+k);
 if(typeof s.speedKmh!=='number'||!Number.isFinite(s.speedKmh)||s.speedKmh<0||s.speedKmh>300)error(path+'.speedKmh','0〜300の数値を入力してください');
}
const cache=new WeakMap();
function texture(g,part){
 if(typeof document==='undefined')return null;
 let entry=cache.get(g);if(!entry){entry={};cache.set(g,entry);}if(entry[part])return entry[part];
 const s=g.architecture.scoreboard??defaultScoreboard(),c=g.architecture.colors,canvas=document.createElement('canvas');canvas.width=1792;canvas.height=part==='scoreboard-title'?96:256;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#0b182b';ctx.fillRect(0,0,canvas.width,canvas.height);
 const text=(value,x,y,width,size=50,color='#ffe5a1')=>{ctx.font=`700 ${size}px monospace`;const measured=ctx.measureText(String(value)).width;if(measured>width)ctx.font=`700 ${Math.max(14,size*width/measured)}px monospace`;ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.strokeStyle=color;ctx.lineWidth=2;ctx.strokeText(String(value),x,y);ctx.fillText(String(value),x,y);},
  line=(x0,y0,x1,y1)=>{ctx.strokeStyle=c.gold;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();};
 if(part==='scoreboard-title'){
  text('TAMBOV DRAGONS',896,49,1300,55,c.gold);for(const sign of [-1,1]){const x=896+sign*720;line(x-14,49,x,35);line(x,35,x+14,49);line(x+14,49,x,63);line(x,63,x-14,49);}
 }else{
  const start=198,cell=98;
  [...Array.from({length:9},(_,i)=>String(i+1)),'R','H','E'].forEach((v,i)=>text(v,start+(i+.5)*cell,40,80,40));
  for(let row=0;row<2;row++){const t=s.teams[row],y=119+row*83;text(t.name,98,y,172,52);
   [...t.innings,runs(t),t.hits,t.errors].forEach((v,i)=>text(v===null?'':v,start+(i+.5)*cell,y,82,52));
  }
  for(const y of [76,160,246])line(10,y,1376,y);for(const x of [188,1080,1376,1582])line(x,8,x,248);
  [['B',s.balls,3,'#84dc76'],['S',s.strikes,2,'#f2be50'],['O',s.outs,2,'#ee6564']].forEach(([name,count,max,color],row)=>{
   const y=48+row*79;text(name,1407,y,42,43);for(let i=0;i<max;i++){ctx.fillStyle=i<count?color:'#243042';ctx.beginPath();ctx.arc(1463+i*38,y,12,0,Math.PI*2);ctx.fill();}
  });
  text(Number(s.speedKmh.toFixed(1)),1682,109,176,58);text('km/h',1682,182,160,31);
 }
 const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;entry[part]=mipPyramid({width:canvas.width,height:canvas.height,data});return entry[part];
}
export function sampleScoreboard(g,part,u,v,profile){
 const levels=texture(g,part);if(!levels)return null;
 const s=sampleMip(levels,u,1-v,profile.footprintU*.88,profile.footprintV*.88);if(!s)return null;
 return {color:'#'+[s.r,s.g,s.b].map(v=>Math.round(v).toString(16).padStart(2,'0')).join(''),logoGlow:.12*Math.max(0,(Math.max(s.r,s.g,s.b)-40)/215)};
}
