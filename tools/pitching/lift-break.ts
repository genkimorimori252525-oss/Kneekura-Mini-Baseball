// The break of a league config's pitches under the match's Lyu lift and under liftCurveV1 'nathan2017', with the same spin,
// against the Statcast pitch-weighted mean of the type (rows with 100+ pitches, both hands on the arm-side frame).
// Movement as statcast-to-v78.ts fits it: whole flight from release to the front of the plate, against a no-spin ball with
// the same release velocity, aimed through the middle of the zone. Measurement only.
// usage: npx vite-node tools/pitching/lift-break.ts <mlb_pitch_type_player_year.csv> <year> <config.json>...
import { readFileSync } from 'node:fs';
import { LIVE_MATCH_PHYSICS_V1 } from '../../src/integration/browser/LiveBaseballMatchV1';
import { withLiftCurveV1 } from '../../src/core/sim/ball/LiftCurveV1';
import { sampleAerodynamicPitchStateAtElapsedSeconds } from '../../src/core/sim/pitching/AerodynamicPitchTrajectory';
import { aimPitchThroughPointV1 } from '../../src/integration/browser/PitchTunnelAimV1';
import { resolveMeasuredClips } from '../calibration/clips-ref.mjs';

type V = { x: number; y: number; z: number };
type Row = Record<string, string>;
function readCsv(path: string): Row[] {
  const [head, ...lines] = readFileSync(path, 'utf8').trim().split(/\r?\n/), keys = head.split(',');
  return lines.map(line => { const cells: string[] = []; let cur = '', q = false;
    for (const ch of line) { if (ch === '"') q = !q; else if (ch === ',' && !q) { cells.push(cur); cur = ''; } else cur += ch; }
    cells.push(cur); return Object.fromEntries(keys.map((k, i) => [k, cells[i] ?? ''])); });
}
const num = (r: Row, k: string) => r[k] === '' || r[k] === undefined ? NaN : Number(r[k]);
const IN = .0254, PLATE = .4318, MOUND_Y = .254, RUBBER_Z = 18.44, target = { x: 0, y: .75, z: PLATE };
const airs = { lyu: (LIVE_MATCH_PHYSICS_V1 as any).air, nathan: (withLiftCurveV1(LIVE_MATCH_PHYSICS_V1 as any, 'nathan2017') as any).air };
const CODE: Record<string, string[]> = { fastball: ['FF'], sinker: ['SI', 'FT'], cutter: ['FC'], slider: ['SL'], sweeper: ['ST'], slurve: ['SV'],
  curve: ['CU'], knuckle_curve: ['KC'], changeup: ['CH'], splitter: ['FS'], forkball: ['FO'] };
function plateAt(release: V, velocity: V, spin: V, air: any) {
  const initial = { tick: 0, position: release, velocity, spin };
  let t = (release.z - PLATE) / Math.abs(velocity.z), at = sampleAerodynamicPitchStateAtElapsedSeconds(initial, t, air);
  for (let i = 0; i < 5; i++) { t += (PLATE - at.position.z) / at.velocity.z; at = sampleAerodynamicPitchStateAtElapsedSeconds(initial, t, air); }
  return at.position;
}
function movement(release: V, speed: number, spin: V, air: any) {
  const aimed = aimPitchThroughPointV1(release, target, speed, spin, air, 0).velocity;
  const a = plateAt(release, aimed, spin, air), b = plateAt(release, aimed, { x: 0, y: 0, z: 0 }, air);
  return { x: (a.x - b.x) / IN, y: (a.y - b.y) / IN };
}
const [csv, year, ...configs] = process.argv.slice(2);
const rows = readCsv(csv).filter(r => r.year === year && r.sample === 'pitches>=100');
const savant = (codes: string[]) => { let n = 0, h = 0, v = 0;
  for (const r of rows) if (codes.includes(r.pitch_type)) { const w = num(r, 'pitches'); if (![num(r, 'hmov_in'), num(r, 'vmov_in')].every(Number.isFinite)) continue; n += w; h += w * num(r, 'hmov_in'); v += w * num(r, 'vmov_in'); }
  return { arm: h / n, up: v / n }; };
const seen = new Map<string, any>();
for (const path of configs) {
  const cfg = resolveMeasuredClips(JSON.parse(readFileSync(path, 'utf8')));
  for (const p of cfg.players) {
    const ph = p.physical, rep = ph?.pitchRepertoireV78; if (!rep || !Number.isFinite(ph.pitchReleaseSideMeters)) continue;
    // statcast-to-v78.ts's frames: release x toward the arm is - for a right-hander; arm-side movement is + x for him.
    const side = p.throws === 'L' ? 1 : -1;
    const release = { x: side * ph.pitchReleaseSideMeters, y: ph.pitchReleaseHeightMeters + MOUND_Y, z: RUBBER_Z - ph.pitchReleaseExtensionMeters };
    for (const pitch of rep.pitches) {
      const key = `${p.throws}|${pitch.pitchId}`; if (seen.has(key)) continue;
      const speed = pitch.releaseSpeedMps * .99, m = Object.fromEntries(Object.entries(airs).map(([k, air]) => {
        const g = movement(release, speed, pitch.spinRadPerSecond, air); return [k, { arm: -side * g.x, up: g.y }]; }));
      seen.set(key, { type: pitch.pitchType, throws: p.throws, ...m });
    }
  }
}
const f = (x: number) => x.toFixed(1).padStart(5);
console.log('type           hand  Savant arm/up | Lyu arm/up | Nathan arm/up | Nathan-Lyu arm/up | Nathan-Savant arm/up');
for (const s of [...seen.values()].sort((a, b) => a.type.localeCompare(b.type) || a.throws.localeCompare(b.throws))) {
  const sv = savant(CODE[s.type] ?? []);
  console.log(`${s.type.padEnd(14)} ${s.throws}   ${f(sv.arm)} ${f(sv.up)} | ${f(s.lyu.arm)} ${f(s.lyu.up)} | ${f(s.nathan.arm)} ${f(s.nathan.up)} | ${f(s.nathan.arm - s.lyu.arm)} ${f(s.nathan.up - s.lyu.up)} | ${f(s.nathan.arm - sv.arm)} ${f(s.nathan.up - sv.up)}`);
}
