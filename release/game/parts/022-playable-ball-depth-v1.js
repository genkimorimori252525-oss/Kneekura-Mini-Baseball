
// Read-only decision; callers must prove the scene and ball sample share identity.
// False means retain the existing overlay cell, including all unknown cases.
function hidePhysicalBallCell({sceneToken,ballToken,sceneCamera,ballCamera,sceneTick,ballTick,viewOverride,rayDepth,blocker,actorOwners}){
 if(!sceneToken||sceneToken!==ballToken||sceneCamera!==ballCamera||sceneTick==null||sceneTick!==ballTick||viewOverride)return false;
 if(!Number.isFinite(rayDepth)||rayDepth<.12||!blocker||!Number.isFinite(blocker.depth)||blocker.depth<.12||blocker.alpha!==1)return false;
 if(blocker.owner!=='ballpark'&&!actorOwners?.has(blocker.owner))return false;
 return blocker.depth<rayDepth-.04;
}

window.PlayableBallDepthV1={hidePhysicalBallCell};
