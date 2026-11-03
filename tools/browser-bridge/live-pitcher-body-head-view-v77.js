/* A head joint attached to the current pitcher root, on the same delivery
 * clock as the existing silhouettes. Authored presentation poses, not measured
 * skeletal biomechanics. Ball/feet/collision positions stay owned by Core. */
(function(root){
 'use strict';
 const defaults=Object.freeze({enabled:true,scale:1}),clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 let settings=defaults;
 function normalizeSettings(value={}){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['enabled','scale'].includes(k)))throw Error('Invalid pitcher head settings');
  const next={...defaults,...value};
  if(typeof next.enabled!=='boolean'||!Number.isFinite(next.scale)||next.scale<0||next.scale>2)throw Error('Invalid pitcher head motion range');
  return Object.freeze(next);
 }
 const model=Object.freeze({basis:'AUTHORED_HEAD_JOINT_ON_EXISTING_DELIVERY_CLOCK',empiricallyCalibrated:false,
  sourcePhysicsChanged:false,eyeHeightRatio:.92,moundRadiusMeters:2.74,followThroughMs:1050});
 function observe({record,frame,sceneMs,preparationMs=1540,pitcherActor,moundSurfacePosition={x:0,y:.254,z:18.44}}){
  if(!pitcherActor||!['x','y','z'].every(k=>Number.isFinite(pitcherActor.position?.[k]))||!Number.isFinite(sceneMs)||sceneMs<0||!Number.isFinite(preparationMs)||preparationMs<=0)throw Error('Pitcher head needs actual actor and scene time');
  const authoredScale=record?.play?.diagnostics?.pitchingMotion?.headMotionScale??1;
  const position=pitcherActor.position,height=pitcherActor.player.height??pitcherActor.player.heightMeters,
   hand=pitcherActor.player.throws??pitcherActor.player.hand??'R',side=hand==='L'?1:-1,
   distance=Math.hypot(position.x-moundSurfacePosition.x,position.z-moundSurfacePosition.z),
   ground=moundSurfacePosition.y*clamp(1-distance/model.moundRadiusMeters,0,1),
   baseEye={x:position.x,y:position.y+ground+height*model.eyeHeightRatio,z:position.z};
  if(!Number.isFinite(height)||height<=0||!['R','L'].includes(hand))throw Error('Pitcher head needs body height and throwing hand');
  const elapsed=record?sceneMs-preparationMs:null,
   active=!!record&&frame?.phase!=='bench'&&elapsed<model.followThroughMs,
   phase=!active?'rest':elapsed<0?'delivery':elapsed<180?'release-follow':'recovery',
   // side, vertical and forward relative to the pitcher's own body axes.
   keys=[[0,0,0,0],[preparationMs*.45,.035,.025,-.025],[preparationMs*.72,.05,-.015,.10],
    [preparationMs,.02,-.10,.42],[preparationMs+180,-.015,-.14,.54],
    [preparationMs+550,0,-.06,.28],[preparationMs+1050,0,0,0]];
  let local=[0,0,0];
  if(active&&settings.enabled&&settings.scale>0&&authoredScale>0){
   const end=keys.findIndex(k=>k[0]>=sceneMs);
   if(end>0){const a=keys[end-1],b=keys[end],u=clamp((sceneMs-a[0])/(b[0]-a[0]),0,1),w=u*u*(3-2*u);
    local=[1,2,3].map(i=>(a[i]+(b[i]-a[i])*w)*settings.scale*authoredScale);}
  }
  const offset={x:local[0]*side,y:local[1],z:-local[2]},eye={x:baseEye.x+offset.x,y:baseEye.y+offset.y,z:baseEye.z+offset.z};
  return {settings:{...settings},phase,baseEye,eye,offset,releaseProgress:record?clamp(sceneMs/preparationMs,0,1):0,
   throwingHand:hand,moundSurfacePosition:{...moundSurfacePosition},model};
 }
 root.KneekuraPitcherBodyHeadView=Object.freeze({version:2,defaults,normalizeSettings,observe,
  inspectSettings:()=>({...settings}),configure:patch=>{settings=normalizeSettings({...settings,...patch});return {...settings};}});
})(typeof globalThis==='object'?globalThis:this);
