import {mipPyramid,sampleMip} from './texture-filter.mjs';
import {DODGER_DECKS} from './dodger-stands.mjs';
import {defaultScoreboard,runs} from './scoreboard.mjs';
import {landscapeMaterial} from './dodger-landscape.mjs';
// Analytic paint masks are sampled as world materials, never drawn over the screen.
export function laPaint(u,v){const x=u*100,y=v*100;
 const bar=(x0,y0,x1,y1)=>x>=x0&&x<=x1&&y>=y0&&y<=y1;
 const l=bar(17,8,30,71)||bar(17,60,62,73),a=(y>=30&&y<=94&&Math.abs(x-(62+(y-30)*.31))<7)||(y>=30&&y<=94&&Math.abs(x-(62-(y-30)*.31))<7)||bar(41,70,82,80);
 return l||a;
}
export function sampleDodgerGround(g,p){if(g?.architecture?.style!=='dodger_stadium'||g.architecture.details?.logos===false||!p)return null;
 const u=p.x/6+.5,v=.5-(p.z+9)/6;return u>=0&&u<=1&&v>=0&&v<=1&&laPaint(u,v)?{r:236,g:240,b:235,a:.84}:null;
}
export function distanceToLaWorld(p){const x=(p.x/6+.5)*100,y=(.5-(p.z+9)/6)*100,
 rect=(x0,y0,x1,y1)=>Math.hypot(Math.max(x0-x,0,x-x1),Math.max(y0-y,0,y-y1)),
 edge=(x0,y0,x1,y1)=>{const dx=x1-x0,dy=y1-y0,t=Math.max(0,Math.min(1,((x-x0)*dx+(y-y0)*dy)/(dx*dx+dy*dy)));return Math.max(0,Math.hypot(x-x0-t*dx,y-y0-t*dy)-7);};
 return Math.min(rect(17,8,30,71),rect(17,60,62,73),rect(41,70,82,80),edge(62,30,81.84,94),edge(62,30,42.16,94))*.06;
}
const cache=new Map(),scoreCache=new WeakMap();
function texture(part,g){if(typeof document==='undefined')return null;const previous=part==='dodger:score'?scoreCache.get(g):cache.get(part);if(previous)return previous;
 const c=document.createElement('canvas');c.width=1024;c.height=part==='dodger:score'?512:part==='dodger:entry-welcome'?96:256;const x=c.getContext('2d',{willReadFrequently:true});x.fillStyle=part.includes('76')?'#ee682f':part==='dodger:score'?'#0c1b29':'#093b77';x.fillRect(0,0,c.width,c.height);
 x.fillStyle='#f5f5ee';x.textAlign='center';x.textBaseline='middle';
 if(part==='dodger:entry-welcome'){x.fillStyle='#1686c4';x.fillRect(0,0,1024,96);x.fillStyle='#f3f6ef';x.font='bold 48px sans-serif';x.fillText('WELCOME TO DODGER STADIUM',512,48,980);
 }else if(part==='dodger:entry-script'){x.fillStyle='#dce6e6';x.fillRect(0,0,1024,256);x.fillStyle='#1555a1';x.font='italic bold 164px Georgia';x.fillText('Dodgers',535,150,900);x.strokeStyle='#b94743';x.lineWidth=7;x.beginPath();x.arc(180,48,24,0,Math.PI*2);x.stroke();for(let i=0;i<4;i++){x.beginPath();x.moveTo(165+i*11,74);x.lineTo(90+i*12,160);x.stroke();}
 }else if(part==='dodger:score'){const s=g.architecture.scoreboard??defaultScoreboard();x.font='bold 52px sans-serif';x.fillText('DODGER STADIUM',512,58);x.fillStyle='#e8ca76';x.font='38px sans-serif';
  const headings=[...Array.from({length:9},(_,i)=>i+1),'R','H','E'];headings.forEach((h,i)=>x.fillText(String(h),225+i*66,132));
  x.fillStyle='#f1e4b9';s.teams.forEach((t,row)=>{const y=210+row*85;x.textAlign='left';x.font='bold 42px sans-serif';x.fillText(t.name,22,y,170);x.textAlign='center';x.font='44px monospace';[...t.innings,runs(t),t.hits,t.errors].forEach((v,i)=>x.fillText(v===null?'–':String(v),225+i*66,y));});
  x.strokeStyle='#8c9aa1';x.lineWidth=3;for(const y of [155,251,337]){x.beginPath();x.moveTo(18,y);x.lineTo(1004,y);x.stroke();}
  x.font='bold 44px sans-serif';x.fillStyle='#edf3f1';x.fillText('B '+s.balls+'    S '+s.strikes+'    O '+s.outs,450,397);x.font='bold 52px sans-serif';x.fillText(s.speedKmh.toFixed(1)+' km/h',512,466);
 }else if(part==='dodger:la'){for(let y=0;y<100;y++)for(let z=0;z<100;z++)if(laPaint(z/100,y/100))x.fillRect(z*6+200,y*2.3+12,6,2.3);}
 else {x.font=(part==='dodger:wordmark'?'italic bold 168px Georgia':'bold 126px sans-serif');x.fillText(part==='dodger:76'?'76':part==='dodger:wordmark'?'Dodgers':part==='dodger:stadium'?'DODGER STADIUM':part==='dodger:distance'?'395':part==='dodger:ribbon'?'LOS ANGELES DODGERS':'LA',512,134,980);}
 const data=x.getImageData(0,0,c.width,c.height).data,t=mipPyramid({width:c.width,height:c.height,data});if(part==='dodger:score')scoreCache.set(g,t);else cache.set(part,t);return t;
}
export function sampleDodgerMaterial(part,u,v,profile,g){if(part.startsWith('dodger:facade:')){const name=part.split(':')[2],d=DODGER_DECKS.find(d=>d.name===name),h=d?d.y+d.rise-4:9,y=v*h,f=(y%3.4)/3.4;return{color:u<.12||u>.88||f>.73?'#bac3bf':y<1.3?'#347ca1':f<.17?'#78919a':'#2d4d62'};}if(part.startsWith('dodger:landscape:'))return landscapeMaterial(part,u,v,g,profile);if(part.startsWith('dodger:entry-'))u=1-u;if(part==='dodger:rear-la'){part='dodger:la';u=1-u;}const t=texture(part,g);if(!t)return null;const s=sampleMip(t,u,1-v,profile?.footprintU??0,profile?.footprintV??0);return s?{color:'#'+[s.r,s.g,s.b].map(n=>Math.round(n).toString(16).padStart(2,'0')).join('')}:null;}
