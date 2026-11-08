import {transformLiveV34} from './v34-live-presentation.mjs';

/** Requested visibility annotations only; positions, custody and bat are Source observations. */
export function transformLiveV35(source,runtime){
 let html=transformLiveV34(source,runtime);
 const replace=(before,after)=>{
  if(!html.includes(before)||html.indexOf(before)!==html.lastIndexOf(before))throw new Error('v35 guard: '+before.slice(0,90));
  html=html.replace(before,after);
 };
 replace('presentationVersion:34','presentationVersion:35');
 // The legacy close camera used the opposite box convention. The shared
 // Core places R at +x and L at -x, so the eye must stay on the batter's side.
 replace("eye:{x:-.4*s,y:Math.max(1.15,observed.batter.height*.77),z:-.95},yaw:Math.atan2(.4*s,19.4)",
  "eye:{x:.4*s,y:Math.max(1.15,observed.batter.height*.77),z:-.95},yaw:Math.atan2(-.4*s,19.4)");
 replace('labelHost.replaceChildren();if(!state.labels)return;',`labelHost.replaceChildren();if(!state.labels)return;
  const visibleLabels=labelPositions.filter(p=>!observed.liveObservation||p.id!=='BAT'||
   (p.role==='runner'&&observed.liveBatterRunStarted));`);
 const rank='const ranked=[...labelPositions]';
 if(html.split(rank).length!==3)throw new Error('v35 label ranking guards');
 html=html.replaceAll(rank,'const ranked=[...visibleLabels]');
 replace('obstacles=labelPositions.map(p=>({...p.bounds}))','obstacles=visibleLabels.map(p=>({...p.bounds}))');
 replace("if(!ball||ball.custody||(!ball.nativeObservation&&!ball.sourceObservation&&!ballVisibleFromCamera()))return 0;",
  "if(!ball||ball.visible===false||ball.custody||ball.possessedBy||(!ball.nativeObservation&&!ball.sourceObservation&&!ballVisibleFromCamera()))return 0;");
 replace('const displayD=visualBallDiameter(realD,state.camera,kind),r=displayD/2;',`const opticalD=visualBallDiameter(realD,state.camera,kind);
  // A tiny overhead visibility annotation, separate from physical/optical size.
  // First-person cameras keep their existing perspective, with no new floor.
  const visibilityMarker=state.camera==='overhead'&&ball.sourceObservation&&opticalD<1.25;
  const displayD=visibilityMarker?1.25:opticalD,r=displayD/2;`);
 replace('c.save();c.globalAlpha=Math.min(1,Math.sqrt(displayD));','c.save();c.globalAlpha=visibilityMarker?1:Math.min(1,Math.sqrt(displayD));');
 replace('ballDotDisplay={camera:state.camera,ballKind:kind,projectedDiameterPx:realD,displayDiameterPx:displayD,',
  'ballDotDisplay={camera:state.camera,ballKind:kind,projectedDiameterPx:realD,opticalDiameterPx:opticalD,visibilityMarker,displayDiameterPx:displayD,');
 return html;
}
