import type { Vec3 } from '../../../core/model/geometry';
import { createBatterPovCamera, type BatterPovCamera, type ProjectedPoint } from '../BatterPovCamera';
import type { PixelHand } from './PixelPlayerModel';
export type PixelCameraMode='BATTER_POV'|'PITCHER_POV'|'CATCHER_POV'|'FIELD_OVERHEAD';
export type PixelCamera=BatterPovCamera & Readonly<{mode:PixelCameraMode}>;
// Explicit review fixtures; callers may supply production camera calibration.
export function createPixelReviewCamera(mode:PixelCameraMode,hand:PixelHand):PixelCamera {
 if(mode==='BATTER_POV')return {...createBatterPovCamera(hand),mode};
 if(mode==='CATCHER_POV')return {mode,eye:{x:0,y:1.35,z:-2.8},focalLength:65,centerX:75,centerY:52,yaw:0,pitch:.14};
 if(mode==='FIELD_OVERHEAD')return {mode,eye:{x:0,y:90,z:30},focalLength:85,centerX:75,centerY:54,yaw:0,pitch:Math.PI/2};
 return {mode,eye:{x:0,y:1.7,z:18.44},focalLength:160,centerX:75,centerY:52,yaw:Math.PI,pitch:.04};
}
export function projectPixelCamera(point:Vec3,camera:PixelCamera):ProjectedPoint|null{
 const x=point.x-camera.eye.x,y=point.y-camera.eye.y,z=point.z-camera.eye.z;
 const side=Math.cos(camera.yaw)*x-Math.sin(camera.yaw)*z;
 const ahead=Math.sin(camera.yaw)*x+Math.cos(camera.yaw)*z;
 const up=Math.cos(camera.pitch)*y+Math.sin(camera.pitch)*ahead;
 const depth=-Math.sin(camera.pitch)*y+Math.cos(camera.pitch)*ahead;
 if(depth<.1)return null;
 return {x:Math.round(camera.centerX+camera.focalLength*side/depth),y:Math.round(camera.centerY-camera.focalLength*up/depth),depth,apparentScale:camera.focalLength/depth};
}
