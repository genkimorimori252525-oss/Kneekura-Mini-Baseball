import {mipPyramid,sampleMip} from './texture-filter.mjs';
import {defaultScoreboard,runs} from './scoreboard.mjs';
import {defaultNiikuraScoreboard,formatSalaryManYen} from './niikura-scoreboard.mjs';
import {scoreboardFieldDiagram,projectFieldDiagramPoint,SCOREBOARD_BASES} from './scoreboard-field.mjs';
let portrait=null,cache=new Map();
export async function prepareNiikuraPortrait(url){const image=new Image();image.src=url;await image.decode();portrait=image;cache=new Map();return{width:image.naturalWidth,height:image.naturalHeight};}
export const niikuraPortraitReady=()=>!!portrait;
export function niikuraBoardTexture(g){if(typeof document==='undefined')return null;const board=g.architecture.scoreboard??defaultScoreboard(),key=JSON.stringify([board,!!portrait]);let t=cache.get(key);if(t)return t;
 const s=board.niikura??defaultNiikuraScoreboard(),field=scoreboardFieldDiagram(g.architecture),canvas=document.createElement('canvas');canvas.width=3072;canvas.height=1280;
 const x=canvas.getContext('2d',{willReadFrequently:true});x.scale(.8,.8);const gold='#eac867',white='#f3f1dc',green='#07291f';
 const text=(value,cx,cy,width,size=60,color=white,serif=false)=>{const str=String(value);x.font=`bold ${size}px ${serif?'Georgia, serif':'sans-serif'}`;const measured=x.measureText(str).width;if(measured>width)x.font=`bold ${Math.max(16,size*width/measured)}px ${serif?'Georgia, serif':'sans-serif'}`;x.textAlign='center';x.textBaseline='middle';x.fillStyle=color;x.fillText(str,cx,cy);},
 line=(a,b,c,d,width=3,color=gold)=>{x.strokeStyle=color;x.lineWidth=width;x.beginPath();x.moveTo(a,b);x.lineTo(c,d);x.stroke();},
 box=(a,b,w,h,width=3,color=gold)=>{x.strokeStyle=color;x.lineWidth=width;x.strokeRect(a,b,w,h);},
 diamond=(cx,cy,r,color)=>{x.fillStyle=color;x.beginPath();x.moveTo(cx,cy-r);x.lineTo(cx+r,cy);x.lineTo(cx,cy+r);x.lineTo(cx-r,cy);x.closePath();x.fill();};
 const gradient=x.createLinearGradient(0,0,0,1600);gradient.addColorStop(0,'#103d2c');gradient.addColorStop(.5,'#03170f');gradient.addColorStop(1,'#092e21');x.fillStyle=gradient;x.fillRect(0,0,3840,1600);
 box(20,20,3800,1560,13);box(40,40,3760,1520,3,'#fff0b3');text('Kneekura Dome',1920,160,3300,205,gold,true);line(55,285,3785,285,8);
 // Two independent nine-player lineup panels.
 for(let team=0;team<2;team++){const left=65+team*535,w=515;box(left,315,w,1190);text(board.teams[team].name,left+w/2,380,w-25,58,gold,true);line(left,440,left+w,440);text('打順',left+55,480,95,44,gold);text('選手名',left+275,480,310,44,gold);text('守備',left+460,480,90,44,gold);
  for(let row=0;row<9;row++){const y=575+row*98,p=s.lineups[team][row];line(left,y+48,left+w,y+48,2,'#8c7b42');text(row+1,left+55,y,90,62,gold);text(p.name,left+265,y,310,60);text(p.position,left+463,y,90,62);}line(left+110,440,left+110,1505,2);line(left+412,440,left+412,1505,2);
 }
 // Line score and ball/strike/out lamps.
 const start=1160,w=1510,nameWidth=240,cell=(w-nameWidth)/12;box(start,315,w,335);for(let row=0;row<3;row++)line(start,405+row*112,start+w,405+row*112,2);
 for(let col=0;col<12;col++){const cx=start+nameWidth+(col+.5)*cell;text(col<9?col+1:['R','H','E'][col-9],cx,362,cell-8,58,gold);line(start+nameWidth+col*cell,315,start+nameWidth+col*cell,650,2);}
 for(let row=0;row<2;row++){const team=board.teams[row],y=461+row*112;text(team.name,start+nameWidth/2,y,nameWidth-15,48,gold,true);[...team.innings,runs(team),team.hits,team.errors].forEach((v,i)=>text(v===null?'–':v,start+nameWidth+(i+.5)*cell,y,cell-8,70));}
 box(start,674,w,125);text(s.inning+'回'+(s.half==='top'?'表':'裏'),start+170,736,300,91);
 for(const [label,count,max,color,left]of [['B',board.balls,3,'#35e87f',1540],['S',board.strikes,2,'#ffd244',2015],['O',board.outs,2,'#f04f58',2350]]){text(label,left+35,736,70,78);for(let i=0;i<max;i++){x.fillStyle=i<count?color:'#18372b';x.beginPath();x.arc(left+125+i*95,736,34,0,Math.PI*2);x.fill();}}
 // The schematic consumes the same optional field DTO as the editor.
 const plot={x:start,y:825,w,h:540},point=p=>{const q=projectFieldDiagramPoint(p);return{x:plot.x+q.u*plot.w,y:plot.y+q.v*plot.h};};x.fillStyle='#1a4c2e';x.fillRect(plot.x,plot.y,plot.w,plot.h);
 for(let i=0;i<12;i++){x.fillStyle=i%2?'#285d34':'#24552f';x.fillRect(plot.x+i*plot.w/12,plot.y,plot.w/12,plot.h);}
 const home=point({x:0,z:0}),bases=SCOREBOARD_BASES.map(point);x.fillStyle='#947045';x.beginPath();x.moveTo(home.x,home.y);for(const p of bases)x.lineTo(p.x,p.y);x.closePath();x.fill();x.strokeStyle='#f4e5b6';x.lineWidth=4;x.stroke();
 if(field?.enabled){for(let i=0;i<3;i++)diamond(bases[i].x,bases[i].y,field.runners[SCOREBOARD_BASES[i].id]?24:10,field.runners[SCOREBOARD_BASES[i].id]?'#ffcf45':'#e9e6c3');
  for(const d of field.defenders){const q=point(d);x.fillStyle='#092b21';x.fillRect(q.x-112,q.y-33,224,66);box(q.x-112,q.y-33,224,66,2);text(d.label,q.x,q.y,211,51);}
 }
 box(start,1380,w,110);["投球数 "+s.pitcher.pitchCount+'球','球速 '+Number(board.speedKmh.toFixed(1))+' km/h','防御率 '+s.pitcher.era.toFixed(2)].forEach((v,i)=>text(v,start+(i+.5)*w/3,1435,w/3-30,56));
 // Only the face area comes from the approved concept image; all information is redrawn.
 const right=2740;box(right,315,1035,1190);if(s.portrait&&portrait){const crop={x:portrait.width*.694,y:portrait.height*.217,w:portrait.width*.162,h:portrait.height*.426};x.drawImage(portrait,crop.x,crop.y,crop.w,crop.h,right+12,327,570,760);}else{x.fillStyle='#194c37';x.fillRect(right+12,327,570,760);x.fillStyle='#65806b';x.beginPath();x.arc(right+297,565,125,0,Math.PI*2);x.fill();x.beginPath();x.ellipse(right+297,970,235,235,0,Math.PI,0);x.fill();}
 text(s.batter.number,right+800,450,420,170,gold,true);text(s.batter.name,right+800,610,415,74);
 [['打率',s.batter.average.toFixed(3).replace(/^0/,'')],['本塁打',s.batter.homeRuns],['打点',s.batter.rbis]].forEach(([label,value],i)=>{const y=778+i*125;line(right+610,y-63,right+1020,y-63,2);text(label,right+708,y,180,50);text(value,right+923,y,195,77);});
 x.fillStyle='#061d14';x.fillRect(right+12,1120,1010,370);box(right+14,1120,1007,368,9);box(right+30,1137,975,334,2);text('年俸',right+520,1186,850,95,gold);text(formatSalaryManYen(s.batter.salaryManYen),right+520,1362,955,173,'#ffe4a0',true);
 // Compact leaf-like gold ornament within the material, never a screen overlay.
 for(const side of [-1,1])for(let i=0;i<6;i++){const xx=right+520+side*(475-i*5),yy=1157+i*46;x.fillStyle=gold;x.beginPath();x.ellipse(xx,yy,5,15,side*.65,0,Math.PI*2);x.fill();}
 text('選手・成績・年俸は表示サンプル',3260,1540,1000,29);t=mipPyramid({width:canvas.width,height:canvas.height,data:x.getImageData(0,0,canvas.width,canvas.height).data});if(cache.size>=2)cache.delete(cache.keys().next().value);cache.set(key,t);return t;
}
export function sampleNiikuraBoard(g,u,v,profile){const t=niikuraBoardTexture(g);if(!t)return null;const c=sampleMip(t,u,1-v,profile?.footprintU??0,profile?.footprintV??0);return c?{color:'#'+[c.r,c.g,c.b].map(v=>Math.round(v).toString(16).padStart(2,'0')).join(''),logoGlow:.04*Math.max(c.r,c.g,c.b)/255}:null;}
