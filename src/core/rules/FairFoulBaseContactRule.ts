import type {
  Vec3,
} from '../model/geometry';
import type {
  RollingBattedBallBaseContactEvidence,
} from '../sim/ball/BattedBallBaseContact';

export type FirstThirdBaseContactFairBallResult = Readonly<{
  territory: 'fair';
  decisiveTick: number;
  decisiveBase: 1 | 3;
  decisiveBallCenter: Vec3;
}>;

export const resolveFirstThirdBaseContactFairBall = (
  evidence: RollingBattedBallBaseContactEvidence,
): FirstThirdBaseContactFairBallResult => ({
  territory: 'fair',
  decisiveTick: evidence.tick,
  decisiveBase: evidence.base,
  decisiveBallCenter: evidence.continuousContactCenter,
});
