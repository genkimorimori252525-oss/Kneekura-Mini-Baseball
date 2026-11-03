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
