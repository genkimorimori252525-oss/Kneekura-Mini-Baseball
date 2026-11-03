// Carry of a batted ball under the match physics, to check against Statcast distances.
// usage: npx vite-node tools/calibration/carry.ts   (prints landing distance in feet for exit speed, angle and backspin)
import { LIVE_MATCH_PHYSICS_V1 } from '../../src/integration/browser/LiveBaseballMatchV1';
import { createVersionedFreeBallTrajectory } from '../../src/core/sim/ball/VersionedBattedBallPhysics';

const MPH = 0.44704, FEET = 3.28084, TPS = LIVE_MATCH_PHYSICS_V1.air.ticksPerSecond;
function carryFeet(mph: number, launchDeg: number, backspinRpm: number) {
  const a = launchDeg * Math.PI / 180, v = mph * MPH, w = backspinRpm * Math.PI / 30;
  // Toward centre field (+z); backspin about -x gives an upward Magnus force.
  const ball = { tick: 0, position: { x: 0, y: 0.9, z: 0.3 }, velocity: { x: 0, y: v * Math.sin(a), z: v * Math.cos(a) }, spin: { x: -w, y: 0, z: 0 } };
  const flight = createVersionedFreeBallTrajectory(ball, 10 * TPS, LIVE_MATCH_PHYSICS_V1);
  const land = flight.groundContacts[0]?.incoming;
  return land ? Math.hypot(land.position.x, land.position.z) * FEET : NaN;
}
const spins = [1500, 2200, 3000];
console.log('mph  deg  ' + spins.map(s => `${s}rpm`.padStart(8)).join(''));
for (const [mph, deg] of [[90, 28], [95, 28], [100, 28], [105, 28], [100, 20], [100, 35], [110, 25]])
  console.log(`${mph}  ${deg}   ` + spins.map(s => carryFeet(mph, deg, s).toFixed(0).padStart(8)).join(''));
// A fastball's speed lost to the front of the plate: MLB loses about 8% (95 mph out, about 87 at the plate).
for (const [mph, rpm] of [[95, 2300], [85, 2400]]) {
  const v = mph * MPH, w = rpm * Math.PI / 30;
  // Thrown toward home (-z) from 16.8 m with backspin, which lifts the ball.
  const ball = { tick: 0, position: { x: 0, y: 1.8, z: 16.8 }, velocity: { x: 0, y: -0.02 * v, z: -v }, spin: { x: w, y: 0, z: 0 } };
  const flight = createVersionedFreeBallTrajectory(ball, 1 * TPS, LIVE_MATCH_PHYSICS_V1);
  const at = flight.samples.find(s => s.ball.position.z <= 0.43);
  const end = at ? Math.hypot(at.ball.velocity.x, at.ball.velocity.y, at.ball.velocity.z) / MPH : NaN;
  console.log(`pitch ${mph} mph ${rpm}rpm -> ${end.toFixed(1)} mph at the plate front (${((1 - end / mph) * 100).toFixed(1)}% lost)`);
}
console.log('MLB average home run: about 103.5 mph, 28 deg, 400 ft ->', carryFeet(103.5, 28, 2200).toFixed(0), 'ft here');
