import type { Vec2 } from '../../../core/model/geometry';
import { PIXEL_DIRECTIONS, type PixelDirectionBucket } from './PixelPlayerModel';
export function selectDirection(facing:Vec2,towardCamera:Vec2):PixelDirectionBucket {
  if (![facing.x,facing.z,towardCamera.x,towardCamera.z].every(Number.isFinite) || Math.hypot(facing.x,facing.z)===0 || Math.hypot(towardCamera.x,towardCamera.z)===0) throw new Error('Missing direction vector');
  const angle=Math.atan2(towardCamera.x,towardCamera.z)-Math.atan2(facing.x,facing.z);
  const bucket=((Math.round(angle/(Math.PI/4))%8)+8)%8;
  return PIXEL_DIRECTIONS[bucket];
}
