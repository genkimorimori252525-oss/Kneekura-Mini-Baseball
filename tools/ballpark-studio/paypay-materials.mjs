import {drawPaypayMainBoard} from './paypay-scoreboard-material.mjs';
import {mipPyramid,sampleMip} from './texture-filter.mjs';
import {defaultScoreboard} from './scoreboard.mjs';
const cache=new WeakMap(),hex=c=>'#'+c.map(n=>Math.max(0,Math.min(255,Math.round(n))).toString(16).padStart(2,'0')).join('');
export function paypayGround(p,base){
 if(!p||!base)return base;const c=[1,3,5].map(i=>parseInt(base.color.slice(i,i+2),16));
 // Chalk, bags and players are not repainted; this hook is only a ground material.
 if(Math.max(...c)-Math.min(...c)<25&&c[0]>145)return base;
 const {x,z}=p,baseZ=27.432/Math.sqrt(2),mound=Math.hypot(x,z-17.9832)<2.7432,
  home=Math.hypot(x,z-.4)<4.6,second=Math.abs(x)+Math.abs(z-baseZ*2)<5.1,
  corner=[-1,1].some(sign=>{const dx=sign*x-baseZ,dz=z-baseZ,u=(dx+dz)*Math.SQRT1_2,v=(dx-dz)*Math.SQRT1_2;return u>-4.1&&u<4.1&&v>-3.0&&v<4.8;}),noise=Math.sin(x*.45+z*.21)*2;
 return{...base,color:mound?hex([104+noise,72+noise,45+noise]):home||second||corner?hex([153+noise,94+noise,57+noise]):hex([66+noise,132+noise,55+noise]),alpha:base.alpha};
}
function texture(part,g){if(typeof document==='undefined')return null;let entry=cache.get(g);if(!entry){entry={};cache.set(g,entry);}if(entry[part])return entry[part];
 const canvas=document.createElement('canvas'),isVision=part==='paypay:vision',isEntry=part==='paypay:entry',isMonitor=part.startsWith('paypay:monitor-'),monitor=Number(part.split('-').at(-1));canvas.width=isVision?3072:isMonitor?1536:1024;canvas.height=isVision?800:isMonitor?([0,4].includes(monitor)?264:444):isEntry?128:256;
 const ctx=canvas.getContext('2d',{willReadFrequently:true}),W=canvas.width,H=canvas.height,s=g.architecture.scoreboard??defaultScoreboard();
 ctx.fillStyle=isVision?'#161a1b':isEntry?'#a9a99e':'#193f35';ctx.fillRect(0,0,W,H);
 const text=(value,x,y,size=45,color='#eff0e4',align='center')=>{ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';ctx.font=`700 ${size}px sans-serif`;ctx.fillText(String(value),x,y);};
 if(isVision){drawPaypayMainBoard(ctx,g,W,H);
 }else if(isEntry){text('MIZUHO',155,64,46,'#1c2b4b');text('PayPay Dome FUKUOKA',640,64,51,'#eeeee0');ctx.fillStyle='#ce3839';ctx.fillRect(285,33,46,60);text('P',308,64,45);}
 else if(isMonitor){
  const yellow='#eac21d',paper='#f2f1df';ctx.fillStyle=[0,4].includes(monitor)?paper:'#131f1d';ctx.fillRect(0,0,W,H);
  ctx.fillStyle=yellow;ctx.beginPath();ctx.moveTo(W*.62,0);ctx.lineTo(W,0);ctx.lineTo(W,H);ctx.lineTo(W*.32,H);ctx.closePath();ctx.fill();
  if(monitor===1){text('PLAY BALL',W*.36,H*.32,112,paper);text('SoftBank HAWKS',W*.35,H*.72,48,yellow);ctx.fillStyle='#17231e';ctx.beginPath();ctx.arc(W*.82,H*.26,H*.09,0,Math.PI*2);ctx.fill();ctx.fillRect(W*.77,H*.38,W*.09,H*.40);ctx.strokeStyle='#17231e';ctx.lineWidth=H*.07;ctx.beginPath();ctx.moveTo(W*.81,H*.49);ctx.lineTo(W*.68,H*.23);ctx.moveTo(W*.72,H*.34);ctx.lineTo(W*.60,H*.06);ctx.stroke();}
  else if(monitor===3){text('NEXT PLAY',W*.37,H*.30,112,paper);text('FUKUOKA',W*.36,H*.72,54,yellow);ctx.strokeStyle='#f2f0dd';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(W*.68,H*.82);ctx.lineTo(W*.83,H*.34);ctx.lineTo(W*.96,H*.82);ctx.closePath();ctx.stroke();ctx.fillStyle=paper;ctx.beginPath();ctx.arc(W*.84,H*.36,H*.07,0,Math.PI*2);ctx.fill();}
  else{text(monitor===0?'HAWKS':'FUKUOKA',W*.45,H*.43,110,'#17231e');text('BASEBALL  ·  YELLOW SPIRIT',W*.43,H*.81,37,'#425344');ctx.fillStyle='#17231e';for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(W*.81+i*34,H*.25);ctx.lineTo(W*.87+i*34,H*.5);ctx.lineTo(W*.81+i*34,H*.75);ctx.lineTo(W*.84+i*34,H*.5);ctx.closePath();ctx.fill();}}
 }
 else if(part==='paypay:side-vision'){ctx.fillStyle='#d2ac15';ctx.fillRect(0,0,W,H);text('HAWKS',W/2,91,100,'#18211c');text('みずほPayPayドーム福岡',W/2,196,44,'#18211c');}
 else if(part==='paypay:wall'){text('MIZUHO     SANKYU     DUSKIN',W/2,H/2,53);}
 else if(part==='paypay:upper-ad'){ctx.fillStyle='#9d292c';ctx.fillRect(0,0,W,H);text('大和証券',W/2,100,72);text('Daiwa Securities',W/2,192,35);}
 else if(part==='paypay:suite'){ctx.fillStyle='#b4a77b';ctx.fillRect(0,0,W,H);for(let i=0;i<10;i++){ctx.fillStyle='#233e38';ctx.fillRect(i*102+8,18,86,218);ctx.fillStyle='#bbaa74';ctx.fillRect(i*102+15,30,70,98);ctx.fillStyle='#565b47';ctx.fillRect(i*102+15,146,70,72);}}
 const data=ctx.getImageData(0,0,W,H).data;return entry[part]=mipPyramid({width:W,height:H,data});
}
export function samplePaypayMaterial(part,u,v,profile,g){const levels=texture(part,g);if(!levels)return null;const c=sampleMip(levels,u,1-v,profile?.footprintU??.002,profile?.footprintV??.002);return c?{color:hex([c.r,c.g,c.b]),logoGlow:part.includes('vision')?.1:0}:null;}
