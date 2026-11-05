// Refits every pitch of a league config under another lift so that it keeps the break it has under the match's Lyu lift
// (the Statcast break it was fitted to by statcast-to-v78.ts): spin rate and speed stay, the break direction and the active
// share are solved again (statcast-to-v78.ts's fit, run with KBM_LIFT). Writes the config with only spinRadPerSecond changed.
// The input must hold its measured clips as a shared reference (tools/calibration/clips-ref.mjs); the reference is kept.
// usage: npx vite-node tools/pitching/refit-lift.ts <mlb_pitch_type_player_year.csv> <scratch dir> <lift: nathan2017|sawicki> <in.json> <out.json> [<in> <out>]...
import { readFileSync, writeFileSync } from 'node:fs';
import { LIVE_MATCH_PHYSICS_V1 } from '../../src/integration/browser/LiveBaseballMatchV1';
import { sampleAerodynamicPitchStateAtElapsedSeconds } from '../../src/core/sim/pitching/AerodynamicPitchTrajectory';
import { aimPitchThroughPointV1 } from '../../src/integration/browser/PitchTunnelAimV1';

type V = { x: number; y: number; z: number };
const [csvPath, scratch, lift, ...pairs] = process.argv.slice(2);
if (!lift || pairs.length === 0 || pairs.length % 2) throw Error('usage: refit-lift.ts <csv> <scratch dir> <lift> <in.json> <out.json>...');
// The converter fits under KBM_LIFT and runs its command line on import; give it an empty check so it only loads.
process.env.KBM_LIFT = lift;
process.argv = [process.argv[0], 'statcast-to-v78.ts', csvPath, scratch, '--check=1900'];
const v78 = await import('./statcast-to-v78');
const MPH = .44704, IN = .0254, PLATE = .4318, MOUND_Y = .254, RUBBER_Z = 18.44, target = { x: 0, y: .75, z: PLATE };
const lyu = (LIVE_MATCH_PHYSICS_V1 as any).air;
const CODE: Record<string, string> = { fastball: 'FF', sinker: 'SI', cutter: 'FC', slider: 'SL', sweeper: 'ST', slurve: 'SV', curve: 'CU',
  knuckle_curve: 'KC', slow_curve: 'CS', changeup: 'CH', splitter: 'FS', forkball: 'FO', screwball: 'SC', eephus: 'EP' };
function plateAt(release: V, velocity: V, spin: V) {
  const initial = { tick: 0, position: release, velocity, spin };
  let t = (release.z - PLATE) / Math.abs(velocity.z), at = sampleAerodynamicPitchStateAtElapsedSeconds(initial, t, lyu);
  for (let i = 0; i < 5; i++) { t += (PLATE - at.position.z) / at.velocity.z; at = sampleAerodynamicPitchStateAtElapsedSeconds(initial, t, lyu); }
  return at.position;
}
/** Break under Lyu in statcast-to-v78.ts's frame (x, induced y), inches. */
function lyuBreak(release: V, speed: number, spin: V) {
  const aimed = aimPitchThroughPointV1(release, target, speed, spin, lyu, 0).velocity;
  const a = plateAt(release, aimed, spin), b = plateAt(release, aimed, { x: 0, y: 0, z: 0 });
  return { x: (a.x - b.x) / IN, y: (a.y - b.y) / IN };
}
const fitted = new Map<string, V>();
let worst = 0, clamped = 0, count = 0;
for (let i = 0; i < pairs.length; i += 2) {
  const cfg = JSON.parse(readFileSync(pairs[i], 'utf8'));
  if (typeof cfg.measuredClips === 'object' && cfg.measuredClips !== null)
    throw Error('the measured clips are inline; share them first: node tools/calibration/clips-ref.mjs ' + pairs[i]);
  for (const p of cfg.players) {
    const ph = p.physical, rep = ph?.pitchRepertoireV78; if (!rep || !Number.isFinite(ph.pitchReleaseSideMeters)) continue;
    const throws = p.throws === 'L' ? 'L' : 'R', side = throws === 'L' ? 1 : -1;
    const release = { x: side * ph.pitchReleaseSideMeters, y: ph.pitchReleaseHeightMeters + MOUND_Y, z: RUBBER_Z - ph.pitchReleaseExtensionMeters };
    for (const pitch of rep.pitches) {
      const s = pitch.spinRadPerSecond, key = JSON.stringify([throws, release, pitch.releaseSpeedMps, s, pitch.pitchType]);
      if (!fitted.has(key)) {
        const speed = pitch.releaseSpeedMps * .99, g = lyuBreak(release, speed, s);
        const fit = v78.fitStatcastPitch({ throws, type: CODE[pitch.pitchType] ?? 'FF', mph: speed / MPH, rpm: Math.hypot(s.x, s.y, s.z) * 30 / Math.PI,
          hIn: -side * g.x, vIn: g.y, release });
        fitted.set(key, { x: +fit.spin.x.toFixed(4), y: +fit.spin.y.toFixed(4), z: +fit.spin.z.toFixed(4) });
        worst = Math.max(worst, fit.residualIn); clamped += +fit.clamped; count++;
      }
      pitch.spinRadPerSecond = fitted.get(key);
    }
  }
  writeFileSync(pairs[i + 1], JSON.stringify(cfg));
}
console.log(`refitted ${count} distinct pitches under ${lift}: worst residual ${worst.toFixed(2)} in, ${clamped} at full active spin`);
