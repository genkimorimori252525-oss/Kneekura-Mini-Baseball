import { expect, it } from 'vitest';
import { boundSourceRk4PositionSpeed } from './SourceFreeBallSpeedBound';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from './BaseballAerodynamics';
import { sampleAerodynamicPitchStateAtElapsedSeconds } from '../pitching/AerodynamicPitchTrajectory';

it('numerically audits dense RK4 position derivatives under wind, gyro spin and coefficient knots', () => {
  const cases=[
    {velocity:{x:0,y:0,z:40},spin:{x:0,y:0,z:600},wind:{x:0,y:0,z:0}},
    {velocity:{x:0,y:0,z:40},spin:{x:1e-10,y:0,z:600},wind:{x:0,y:0,z:0}},
    {velocity:{x:0,y:-3,z:52},spin:{x:300,y:40,z:150},wind:{x:12,y:0,z:-4}},
    {velocity:{x:35,y:5,z:0},spin:{x:0,y:180,z:0},wind:{x:0,y:0,z:0}},
    {velocity:{x:0,y:2,z:150},spin:{x:1200,y:900,z:0},wind:{x:-10,y:3,z:7}},
    {velocity:{x:.01,y:0,z:0},spin:{x:0,y:0,z:600},wind:{x:0,y:0,z:0}},
  ];
  for(const scenario of cases){
    const ball={tick:0,position:{x:0,y:1,z:0},velocity:scenario.velocity,spin:scenario.spin};
    const parameters={ticksPerSecond:1_000_000,integrationStepTicks:2_000,gravityY:-9.81,
      aerodynamics:{...REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS,windVelocityMps:scenario.wind}};
    const bound=boundSourceRk4PositionSpeed(ball,.002,parameters);
    for(let i=1;i<40;i++){
      const t=.002*i/40,h=1e-8;
      const before=sampleAerodynamicPitchStateAtElapsedSeconds(ball,t-h,parameters).position;
      const after=sampleAerodynamicPitchStateAtElapsedSeconds(ball,t+h,parameters).position;
      const numerical=Math.hypot(after.x-before.x,after.y-before.y,after.z-before.z)/(2*h);
      expect(numerical).toBeLessThanOrEqual(bound+1e-4);
    }
  }
  // Finite differences audit adversarial cases; they do not prove a universal
  // derivative bound or empirical aerodynamic accuracy.
});

it('refuses a coefficient profile whose lift is discontinuous at zero active spin', () => {
  const air=REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS,profile=air.coefficientProfile!;
  const ball={tick:0,position:{x:0,y:1,z:0},velocity:{x:0,y:0,z:40},spin:{x:0,y:0,z:600}};
  const parameters={ticksPerSecond:1_000_000,integrationStepTicks:2_000,gravityY:-9.81,
    aerodynamics:{...air,coefficientProfile:{...profile,spinKnots:profile.spinKnots.map((k,i)=>i? k : {...k,liftCoefficient:.01})}}};
  expect(()=>boundSourceRk4PositionSpeed(ball,.002,parameters)).toThrow('continuous at zero spin');
});
