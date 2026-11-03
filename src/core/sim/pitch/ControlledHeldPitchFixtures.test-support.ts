import type { ControlledHeldPitchAnchorsV1, ControlledHeldPitchV1 } from './ControlledHeldPitchV1';
/** Explicit synthetic control law for the existing 18 m / 1.8 m test body.
 * Not measured motion, an automatic player default or a physiological limit. */
export function controlledHeldPitchFixture(a:ControlledHeldPitchAnchorsV1):ControlledHeldPitchV1{
  const r=a.handRadiusM+a.ballRadiusM,zero={x:0,y:0,z:0},release=a.release.releaseAtUs;
  if(release-a.initialBall.tick<=40000||a.followThroughEndTick-release<=50000)throw new Error('synthetic control fixture needs its explicitly declared intervals');
  const offset={x:0,y:0,z:-r},hand={...a.release.position,z:a.release.position.z+r};
  return {version:'controlled_held_pitch_v1',ticksPerSecond:1e6,initialOrientation:{x:0,y:0,z:0,w:1},held:[
    {tick:a.initialBall.tick,handCenter:a.initialHand.position,handVelocity:a.initialHand.velocity,
      ballOffset:{x:a.initialBall.position.x-a.initialHand.position.x,y:a.initialBall.position.y-a.initialHand.position.y,z:a.initialBall.position.z-a.initialHand.position.z},
      ballOffsetVelocity:zero,spin:a.initialBall.spin},
    {tick:release-40000,handCenter:{x:-.3,y:1.45,z:18.3},handVelocity:zero,ballOffset:offset,ballOffsetVelocity:zero,spin:zero},
    {tick:release,handCenter:hand,handVelocity:a.release.velocity,ballOffset:offset,ballOffsetVelocity:zero,spin:a.release.spin}],
    followThrough:[{tick:release,handCenter:hand,handVelocity:a.release.velocity},
      {tick:release+50000,handCenter:{x:a.release.position.x,y:a.release.position.y,z:17.33},handVelocity:zero},
      {tick:a.followThroughEndTick,handCenter:{x:a.release.position.x,y:a.release.position.y,z:17.33},handVelocity:zero}]};
}
