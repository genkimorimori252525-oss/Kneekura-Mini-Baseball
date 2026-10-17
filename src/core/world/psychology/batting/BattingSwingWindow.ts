import type { BattingCommitment } from './BattingTypes';
import type { RigidBatPhysicalProperties } from '../../../sim/contact/RigidBatBallContact';
import { createRigidBatSwingWindowFromKinematicsV1, createRigidBatSwingWindowFromSampledV1,
  type RigidBatSwingWindow } from '../../../sim/pitching/AerodynamicRigidBatSwingingPitchPhysicalResult';

/** All physical/adoption/retirement consumers select the same issued motor. */
export function createBattingCommitmentSwingWindow(commitment:BattingCommitment,physical:RigidBatPhysicalProperties):RigidBatSwingWindow {
  if(commitment.action!=='SWING')throw new Error('take commitment has no swing motor');
  if(commitment.sampledTrajectoryV1){
    if(commitment.trajectory!==null)throw new Error('batting commitment contains two execution trajectories');
    return createRigidBatSwingWindowFromSampledV1(commitment.sampledTrajectoryV1,physical);
  }
  if(!commitment.trajectory)throw new Error('swing commitment has no execution trajectory');
  return createRigidBatSwingWindowFromKinematicsV1(commitment.trajectory,physical);
}
