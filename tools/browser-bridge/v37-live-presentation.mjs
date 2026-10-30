import {transformLiveV36} from './v36-live-presentation.mjs';

/** Display-only restoration. Source actors, bats and results remain untouched. */
export function transformLiveV37(source,runtime){
 let html=transformLiveV36(source,runtime);
 const replace=(before,after)=>{
  if(html.split(before).length!==2)throw new Error('v37 guard: '+before.slice(0,100));
  html=html.replace(before,after);
 };
 replace('presentationVersion:36','presentationVersion:37');
 replace("const illustratedBat=action==='bat'&&state.camera==='mound'&&!observed.liveObservation;",
  "const illustratedBat=action==='bat'&&state.camera==='mound';");
 replace("if(state?.camera==='mound'&&state.appearance==='retro'&&!observed.liveObservation)return 0;",
  "if(state?.camera==='mound')return 0;");
 replace("if(state.camera==='mound'&&state.appearance==='retro')return;",
  "if(state.camera==='mound')return;");
 replace("batDisplayMode:state.camera==='mound'&&state.appearance==='retro'&&!observed.liveObservation?'approved-four-frame':'observed-geometry'",
  "batDisplayMode:state.camera==='mound'?'approved-four-frame':'observed-geometry'");
 // The pitcher-view promise applies to either actor appearance: only the
 // adopted batter animation contains a bat here. Other actors keep the preset.
 replace("if(state.appearance==='point'){\n   diameter=height*.60;",
  "if(state.appearance==='point'&&!(state.camera==='mound'&&a.role==='batter')){\n   diameter=height*.60;");
 replace("const action=a.running?'run':a.role==='batter'?'bat':a.role==='P'?'pitch':a.role==='C'?'catch':a.role==='runner'?'runner':'field';",
  "const action=observed.liveObservation&&a.presentationAction?a.presentationAction:a.running?'run':a.role==='batter'?'bat':a.role==='P'?'pitch':a.role==='C'?'catch':a.role==='runner'?'runner':'field';");
 replace("const frame=action==='bat'?observed.batFrame:action==='pitch'?observed.pitchFrame:action==='run'?Math.floor(observed.localTick/(a.walking?10:4))%2:0;",
  "const frame=observed.liveObservation&&Number.isInteger(a.presentationFrame)?a.presentationFrame:action==='bat'?observed.batFrame:action==='pitch'?observed.pitchFrame:action==='run'?Math.floor(observed.localTick/(a.walking?10:4))%2:0;");
 replace('let bounds,diameter,p;','let bounds,diameter,p,animationAction=null,animationFrame=null;');
 replace('const original=poseSprite(action,frame,a.player.hand,a.player.form,',
  'animationAction=action;animationFrame=frame;\n    const original=poseSprite(action,frame,a.player.hand,a.player.form,');
 replace('labelPositions.push({id:a.id,role:a.role,name:a.player.name,',
  'labelPositions.push({id:a.id,role:a.role,animationAction,animationFrame,name:a.player.name,');
 replace('function camera(){return cam;}',`let runnerNearBodyIds=new Set();
 function camera(){return cam;}`);
 replace('cam=chooseCamera();cam.f*=settings.zoom||1;',`cam=chooseCamera();cam.f*=settings.zoom||1;
  // A near defender may fill the runner's image. Suppress only that body's
  // pixels before depth writes, retaining its real position and name anchor.
  runnerNearBodyIds=new Set(state.camera==='runner'?observed.actors.filter(a=>{
   if(!['P','C','1B','2B','3B','SS','LF','CF','RF'].includes(a.role))return false;
   const height=a.player.height,dy=cam.eye.y-(a.position.y??0);
   return Number.isFinite(height)&&height>0&&dy>=-.10&&dy<=height+.10
    &&Math.hypot(a.position.x-cam.eye.x,a.position.z-cam.eye.z)<.90*height;
  }).map(a=>a.id):[]);`);
 replace('function paintWorldCell(x,y,depth,color,alpha,owner){',
  'function paintWorldCell(x,y,depth,color,alpha,owner){\n if(runnerNearBodyIds.has(owner))return;');
 replace('labelPositions=labelPositions.filter(p=>counts[p.id]>0 ||',
  'labelPositions=labelPositions.filter(p=>counts[p.id]>0 || runnerNearBodyIds.has(p.id) ||');
 replace('actors:labelPositions,actorCells,batScreen,',
  'actors:labelPositions,actorCells,nearRunnerHiddenActors:[...runnerNearBodyIds],batScreen,');
 return html;
}
