import {transformV30} from './v30-presentation.mjs';

/** Same source world, observed through the approved coarse camera. This
 * corrects a renderer interpolation defect only; legacy match physics and
 * the independent formal-Core maker/observer remain separate authorities. */
export function transformV31(source){
 let html=transformV30(source);
 const replace=(before,after)=>{
  if(!html.includes(before)||html.indexOf(before)!==html.lastIndexOf(before))throw new Error('v31 guard: '+before.slice(0,90));
  html=html.replace(before,after);
 };
 html=html.replaceAll('TBD対LAD 描画修正版 30','TBD対LAD 剛体バット描画版 31');
 replace('presentationVersion:30','presentationVersion:31');
 replace('function presentationBat(p,batter,actors,points){',`
// Read-only rigid-pose interpolation. Grip is the single hand/bat pivot.
// A sphere interpolation preserves source axis direction and source length;
// it cannot alter the original collision, score or game trajectory.
function rigidBatLength(points){return Math.hypot(points[3]-points[0],points[4]-points[1],points[5]-points[2]);}
function rigidBatPoints(one,two,blend,length){
 const amount=clamp(blend,0,1),aLength=rigidBatLength(one),bLength=rigidBatLength(two);
 if(!(aLength>0&&bLength>0&&length>0))return null;
 const a=one.slice(3).map((n,i)=>(n-one[i])/aLength),b=two.slice(3).map((n,i)=>(n-two[i])/bLength);
 const cosine=clamp(a.reduce((sum,n,i)=>sum+n*b[i],0),-1,1);let axis;
 if(cosine>.999999){axis=a.map((n,i)=>n+(b[i]-n)*amount);}
 else if(cosine<-.999999){
  // Opposite axes have no unique shortest arc. Choose a deterministic
  // perpendicular plane; this is a display convention, not joint physics.
  const seed=Math.abs(a[1])<.9?[0,1,0]:[1,0,0];
  const dot=a.reduce((sum,n,i)=>sum+n*seed[i],0),perp=seed.map((n,i)=>n-dot*a[i]);
  const norm=Math.hypot(...perp);axis=a.map((n,i)=>n*Math.cos(Math.PI*amount)+perp[i]/norm*Math.sin(Math.PI*amount));
 }else{
  const angle=Math.acos(cosine),sine=Math.sin(angle),wa=Math.sin((1-amount)*angle)/sine,wb=Math.sin(amount*angle)/sine;
  axis=a.map((n,i)=>n*wa+b[i]*wb);
 }
 const norm=Math.hypot(...axis),grip=one.slice(0,3).map((n,i)=>n+(two[i]-n)*amount);
 return [...grip,...axis.map((n,i)=>grip[i]+n/norm*length)];
}
function sampleLegacyRigidBat(p,localTick){
 const t=clamp(localTick,0,p.motion.length-1),index=Math.floor(t),one=p.motion[index]?.[2],two=p.motion[index+1]?.[2]??one;
 const source=p.motion[0]?.[2];if(!one||!two||!source)return null;
 const frame=observe(p.start+index),points=rigidBatPoints(one,two,t-index,rigidBatLength(source));
 return presentationBat(p,frame.batter,frame.actors,points);
}
function presentationBat(p,batter,actors,points){`);
 replace('const first=p.motion[0][2],hand={x:',
  'const first=p.motion[0][2];points=rigidBatPoints(points,points,0,rigidBatLength(first));if(!points)return null;const hand={x:');
 replace('const points=b1.map((x,i)=>x+(b2[i]-x)*blend);',
  'const points=rigidBatPoints(b1,b2,blend,rigidBatLength(here.motion[0][2]));');
 replace('probeOpticalDiameter:(diameter,view)=>broadcast.visualBallDiameter(diameter,view),',
  `probeOpticalDiameter:(diameter,view)=>broadcast.visualBallDiameter(diameter,view),
  sampleRigidBat:(pitchIndex,localTick)=>sampleLegacyRigidBat(recording.pitches[pitchIndex],localTick),
  paintRigidBatProbe:(pitchIndex,localTick)=>{const pose=sampleLegacyRigidBat(recording.pitches[pitchIndex],localTick);broadcast.paintBatOverlay(pose,$('bat-overlay'));return {bat:pose,handGrip:pose?.grip??null};},`);
 replace('observation:{bat:frame.bat,ball:frame.ball,', 'observation:{bat:frame.bat,handGrip:frame.bat?.grip??null,ball:frame.ball,');
 return html;
}
