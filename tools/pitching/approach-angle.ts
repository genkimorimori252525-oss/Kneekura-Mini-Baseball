// Vertical and horizontal approach angles at the front of the plate for a repertoire file from statcast-to-v78.ts.
// usage: npx vite-node tools/pitching/approach-angle.ts <standard-or-pitcher.json> [targetHeightM=0.75]
// Each pitch is aimed at the middle of the plate at the given height from the file's release, as the match inverse does.
import { readFileSync } from 'node:fs';
import { LIVE_MATCH_PHYSICS_V1 } from '../../src/integration/browser/LiveBaseballMatchV1';
import { sampleAerodynamicPitchStateAtElapsedSeconds } from '../../src/core/sim/pitching/AerodynamicPitchTrajectory';
import { aimPitchThroughPointV1 } from '../../src/integration/browser/PitchTunnelAimV1';

const [file, heightArg] = process.argv.slice(2), air = LIVE_MATCH_PHYSICS_V1.air, PLATE = .4318, MOUND_Y = .254, RUBBER_Z = 18.44;
const data = JSON.parse(readFileSync(file, 'utf8')), ph = data.physical, side = ph.throws === 'L' ? 1 : -1;
const release = { x: side * ph.pitchReleaseSideMeters, y: ph.pitchReleaseHeightMeters + MOUND_Y, z: RUBBER_Z - ph.pitchReleaseExtensionMeters };
const target = { x: 0, y: Number(heightArg ?? .75), z: PLATE }, rows = [];
for (const p of data.pitchRepertoireV78.pitches) {
  const speed = p.releaseSpeedMps * .99, v0 = aimPitchThroughPointV1(release, target, speed, p.spinRadPerSecond, air, 0).velocity;
  const initial = { tick: 0, position: release, velocity: v0, spin: p.spinRadPerSecond };
  let t = (release.z - PLATE) / Math.abs(v0.z), at = sampleAerodynamicPitchStateAtElapsedSeconds(initial, t, air);
  for (let i = 0; i < 5; i++) { t += (PLATE - at.position.z) / at.velocity.z; at = sampleAerodynamicPitchStateAtElapsedSeconds(initial, t, air); }
  const v = at.velocity, vaa = Math.atan2(v.y, -v.z) * 180 / Math.PI, haa = Math.atan2(v.x, -v.z) * 180 / Math.PI;
  rows.push({ pitch: p.pitchType, mph: +(speed / .44704).toFixed(1), vaaDeg: +vaa.toFixed(2), haaDeg: +haa.toFixed(2), flightS: +t.toFixed(3) });
}
console.table(rows);
