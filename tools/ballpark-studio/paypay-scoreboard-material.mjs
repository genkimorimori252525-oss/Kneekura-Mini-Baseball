import {runs,defaultScoreboard} from './scoreboard.mjs';
import {defaultPaypayScoreboard} from './paypay-scoreboard.mjs';
import {scoreboardFieldDiagram,projectFieldDiagramPoint,SCOREBOARD_BASES} from './scoreboard-field.mjs';
/** A display sample reads only the scoreboard DTO; it never generates official player records. */
export function drawPaypayMainBoard(ctx,g,width,height){const s=g.architecture.scoreboard??defaultScoreboard(),p=s.paypay??defaultPaypayScoreboard(),field=scoreboardFieldDiagram(g.architecture);ctx.save();ctx.scale(width/3072,height/800);ctx.fillStyle='#111719';ctx.fillRect(0,0,3072,800);
 const text=(value,x,y,size=44,color='#f0f1eb',max=600,align='center')=>{ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';ctx.font=`700 ${size}px sans-serif`;ctx.fillText(String(value),x,y,max);},line=(x,y,x1,y1)=>{ctx.strokeStyle='#a5a99a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x1,y1);ctx.stroke();};
 for(let team=0;team<2;team++){const x=team===0?24:2482,cx=x+274;ctx.fillStyle=team?'#e9bb16':'#cbd9da';ctx.fillRect(x,24,548,70);text(s.teams[team].name,cx,60,46,'#15201c',520);text('打順',x+54,132,31);text('選手名',x+275,132,31);text('守備',x+495,132,31);line(x,158,x+548,158);
  p.lineups[team].forEach((v,i)=>{const y=202+i*59;text(i+1,x+53,y,39,'#e8c54a');text(v.name,x+275,y,42,'#f2f1e8',340);text(v.position,x+495,y,40);});line(x,734,x+548,734);}
 text('FUKUOKA  ·  SCOREBOARD',1536,44,38,'#e3c958',1400);const left=650,cell=121,start=left+255;
 [...Array.from({length:9},(_,i)=>i+1),'R','H','E'].forEach((v,i)=>text(v,start+(i+.5)*cell,132,38));
 s.teams.forEach((team,row)=>{const y=220+row*100;text(team.name,left+113,y,39,'#eef1ea',218);[...team.innings,runs(team),team.hits,team.errors].forEach((v,i)=>text(v===null?'–':v,start+(i+.5)*cell,y,61,i>8?'#f5cb42':'#f1f2eb',106));});
 for(const y of [164,270,370])line(left,y,2425,y);for(const x of [left,left+248,start+cell*9,2425])line(x,96,x,370);
 [['B',s.balls,3,'#68d98a'],['S',s.strikes,2,'#f4ce37'],['O',s.outs,2,'#f65f65']].forEach(([label,count,max,color],row)=>{const x=778+row*540;text(label,x,434,54);for(let i=0;i<max;i++){ctx.fillStyle=i<count?color:'#26312e';ctx.beginPath();ctx.arc(x+89+i*76,434,24,0,Math.PI*2);ctx.fill();}});line(left,490,2425,490);
 text(p.inning+'回'+(p.half==='top'?'表':'裏'),950,565,72,'#f2d574');text('PITCH',720,665,32);text(p.pitchCount,895,665,66,'#eec14a');text('SPEED',1220,665,32);text(s.speedKmh.toFixed(1),1430,665,62);text('km/h',1630,665,30);
 if(field?.enabled){const map=v=>{const q=projectFieldDiagramPoint(v);return{x:1820+q.u*500,y:515+q.v*215};},home=map({x:0,z:0}),bases=SCOREBOARD_BASES.map(map);ctx.strokeStyle='#e2e4d9';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(home.x,home.y);for(const b of bases)ctx.lineTo(b.x,b.y);ctx.closePath();ctx.stroke();
  for(const base of SCOREBOARD_BASES){const q=map(base),r=14;ctx.fillStyle=field.runners[base.id]?'#f4c633':'#21322c';ctx.strokeStyle='#b2c3b0';ctx.beginPath();ctx.moveTo(q.x,q.y-r);ctx.lineTo(q.x+r,q.y);ctx.lineTo(q.x,q.y+r);ctx.lineTo(q.x-r,q.y);ctx.closePath();ctx.fill();ctx.stroke();}
  for(const d of field.defenders){const q=map(d);text(d.label,q.x,q.y,21,'#d5e4d1',80);}}
 text('表示見本',1536,769,25,'#a7b3a7',500);ctx.restore();
}
