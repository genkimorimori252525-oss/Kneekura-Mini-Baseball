import type {
  BatBallContactResult,
} from '../contact/BatBallContact';
import type {
  RigidBatBallContactResult,
} from '../contact/RigidBatBallContact';

export const adaptRigidBatBallContactToCanonicalContact = (
  contact: RigidBatBallContactResult,
): BatBallContactResult => {
  const batPoint = {
    x:
      contact.batSurfacePoint.x
      - contact.normal.x
        * contact.localBatRadiusM,
    y:
      contact.batSurfacePoint.y
      - contact.normal.y
        * contact.localBatRadiusM,
    z:
      contact.batSurfacePoint.z
      - contact.normal.z
        * contact.localBatRadiusM,
  };

  return {
    tick: contact.tick,
    ballCenter: contact.ballCenter,
    point: contact.batSurfacePoint,
    batPoint,
    normal: contact.normal,
    segmentT: contact.segmentT,
    exitVelocity: contact.exitVelocity,
    exitSpin: contact.exitSpin,
  };
};
