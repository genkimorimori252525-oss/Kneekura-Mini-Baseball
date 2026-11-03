import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from './BaseballAerodynamics';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from './BallFlight';
import { createContinuousBattedBallFlightEvidence, type SourceFreeBallDescriptorV2 } from './SourceFreeBallKernel';
import { createBattedWorldFieldGeometry } from './BattedWorldFieldMotion';
const v = (x=0,y=0,z=0) => ({ x,y,z });
export const sourceFieldV3Fixture = (baseContact = false, secondWall = false) => {
  const profile = { kind: 'aero_ground_v1' as const, air: { ticksPerSecond: 1_000_000, integrationStepTicks: 2_000, gravityY: -9.81,
    aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS }, ground: { ticksPerSecond: 1_000_000, gravityMps2: 9.81, radiusM: 0.0366,
    inertiaRatio: 0.378, restingVerticalSpeedMps: 0.15, material: { restitution: 0.4, slidingFriction: 0.25, rollingDecelerationMps2: 1, normalSpinDecayPerSecond: 0.5 } } };
  const contact = { tick: 12345, ballCenter: v(baseContact?101:1,1,baseContact?100:0), exitVelocity: v(30), exitSpin: v(0,12,-50),
    point: v(1,1), batPoint: v(1,1), normal: v(1), segmentT: 0.72 };
  const flight = createContinuousBattedBallFlightEvidence(contact,0,profile);
  const sourceCurve: SourceFreeBallDescriptorV2 = { kind: 'aero_ground_continuous_source_kernel_v2', initial: { originTick:contact.tick,elapsedSeconds:0,ball:flight.initialBall },throughElapsedSeconds:0,profile };
  const material = { restitution:0.5,tangentialDamping:0.25,spinDamping:0.2 };
  const base = (x:number,z:number) => ({ region:{center:{x,z},halfSize:{x:0.25,z:0.25},rotationRadians:0},surfaceHeightMeters:2 });
  const geometry = createBattedWorldFieldGeometry({ baseGeometry:{field:{homePlate:{x:100,z:100},firstBaseLineUnit:{x:1,z:0},thirdBaseLineUnit:{x:0,z:1}},
    bases:{home:base(100,100),first:base(103,100),second:base(103,103),third:base(100,103)}},
    baseModels:{home:{bottomY:0,material},first:{bottomY:0,material},second:{bottomY:0,material},third:{bottomY:0,material}} });
  const actors = [{ playerId:'fielder', primitive:{role:'body' as const,radius:0.1,startTick:contact.tick,endTick:contact.tick+1_000_000,
    ticksPerSecond:1_000_000,startCenter:v(1000,1,1000),startVelocity:v(),acceleration:v()} }];
  const wall = (surfaceId:string,x:number) => ({surfaceId,start:{x,z:-1},end:{x,z:1},minimumHeight:0,maximumHeight:20});
  const surfaces = baseContact?[]:[wall('right-wall',2.5),...(secondWall?[wall('left-wall',0.2)]:[])];
  const response = {world:{flight,sourceCurve,parameters:{...DEFAULT_BALL_FLIGHT_PARAMETERS,integrationStepTicks:2_000},throughTick:contact.tick,actors,surfaces},
    actors:[{playerId:'fielder',profile:{role:'body' as const,material}}],surfaces:surfaces.map(s=>({surfaceId:s.surfaceId,material}))};
  return {response,geometry,actors,cursor:{moment:sourceCurve.initial,sourceCurve,sourceSide:'incoming' as const,previousContacts:[]},carrierPlayerId:null,
    availableAtTick:contact.tick,coverageThroughTick:contact.tick+1_000_000,commands:[{playerId:'fielder',role:'body' as const,acceleration:v()}]};
};
