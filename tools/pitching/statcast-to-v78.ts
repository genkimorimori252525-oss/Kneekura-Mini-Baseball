// Statcast pitch rows -> match pitches (pitch_repertoire_v78), fitted in the match physics.
// usage:
//   npx vite-node tools/pitching/statcast-to-v78.ts <mlb_pitch_type_player_year.csv> <outDir> --standard=2024 [--throws=R|L]
//   npx vite-node tools/pitching/statcast-to-v78.ts <csv> <outDir> --pitcher=<mlbam_id> --year=2024
//   npx vite-node tools/pitching/statcast-to-v78.ts <csv> <outDir> --check=2024      (fit every row with 100+ pitches)
// --zone=<csv> adds zoneRateV1 (Statcast zone 1-9 share) from the history desk's zone tables: the league table
// (mlb_pitch_type_zone_league_year.csv) for --standard, the pitcher table (mlb_pitch_type_zone_player_year.csv) for --pitcher.
// --count=<csv> adds usageByCountV1 from the league table by pitch type and count (mlb_count_zone_by_pitch_type.csv): the
// type's share of the pitches in each count over its share of all pitches that year (the league's, for a pitcher too).
// The CSV is the KBM history desk's table (private repo data/mini-baseball/pitch-tracking/); arm side is + for both hands.
// Fit: spin rate is Statcast's. The break direction and the active (non-gyro) share of the spin are solved so that the
// ball flown in LIVE_MATCH_PHYSICS_V1.air (no seam force) breaks by Statcast's horizontal and induced vertical inches.
// Movement is taken over the whole flight from release to the front of the plate against a no-spin ball with the same
// release velocity, as in tools/calibration/carry.ts. Statcast's pfx is close to that: on 2024-06-01, half the induced
// acceleration at 50 ft times the squared flight time gives 1.02-1.08 of pfx_z from release and 0.87-0.92 from 50 ft.
// Gyro handedness is a hypothesis: for a right-hander, glove-side pitches spin clockwise seen from the pitcher (axis
// toward the plate), arm-side pitches the other way; mirrored for a left-hander. KBM_GYRO_FLIP=1 flips it. The fit
// keeps the movement either way; the active share moves by 5-10 points.
// Statcast's spin axis is not used by the fit; its gap to the axis implied by the movement is reported (a seam-wake sign).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { LIVE_MATCH_PHYSICS_V1 } from '../../src/integration/browser/LiveBaseballMatchV1';
import { sampleAerodynamicPitchStateAtElapsedSeconds } from '../../src/core/sim/pitching/AerodynamicPitchTrajectory';
import { aimPitchThroughPointV1 } from '../../src/integration/browser/PitchTunnelAimV1';
import { validatePitchRepertoireV78 } from '../../src/integration/browser/LivePitchAuthoringV78';

type V = { x: number; y: number; z: number };
const MPH = .44704, FT = .3048, IN = .0254, RPM = Math.PI / 30, PLATE = .4318, MOUND_Y = .254, RUBBER_Z = 18.44;
const air = LIVE_MATCH_PHYSICS_V1.air, target = { x: 0, y: .75, z: PLATE };
const TYPES: Record<string, [string, string]> = { FF: ['fastball', 'フォーシーム'], SI: ['sinker', 'シンカー'], FT: ['sinker', 'ツーシーム'],
  FC: ['cutter', 'カッター'], SL: ['slider', 'スライダー'], ST: ['sweeper', 'スイーパー'], SV: ['slurve', 'スラーブ'], CU: ['curve', 'カーブ'],
  KC: ['knuckle_curve', 'ナックルカーブ'], CS: ['slow_curve', 'スローカーブ'], CH: ['changeup', 'チェンジアップ'], FS: ['splitter', 'スプリット'],
  FO: ['forkball', 'フォーク'], SC: ['screwball', 'スクリュー'], EP: ['eephus', 'イーファス'] };
const GLOVE_SIDE = new Set(['FC', 'SL', 'ST', 'SV', 'CU', 'KC', 'CS']);

type Row = Record<string, string>;
export function readCsv(path: string): Row[] {
  const [head, ...lines] = readFileSync(path, 'utf8').trim().split(/\r?\n/), keys = head.split(',');
  return lines.map(line => { const cells: string[] = []; let cur = '', q = false;
    for (const ch of line) { if (ch === '"') q = !q; else if (ch === ',' && !q) { cells.push(cur); cur = ''; } else cur += ch; }
    cells.push(cur); return Object.fromEntries(keys.map((k, i) => [k, cells[i] ?? ''])); });
}
export const num = (r: Row, k: string) => r[k] === '' || r[k] === undefined ? NaN : Number(r[k]);

/** Release in match coordinates: height above the mound surface, side toward the arm, extension off the rubber. */
const releaseOf = (throws: 'R' | 'L', sideFt: number, heightFt: number, extFt: number): V =>
  ({ x: (throws === 'L' ? 1 : -1) * sideFt * FT, y: heightFt * FT, z: RUBBER_Z - extFt * FT });
function plateAt(release: V, velocity: V, spin: V) {
  const initial = { tick: 0, position: release, velocity, spin };
  let t = (release.z - PLATE) / Math.abs(velocity.z), at = sampleAerodynamicPitchStateAtElapsedSeconds(initial, t, air);
  for (let i = 0; i < 5; i++) { t += (PLATE - at.position.z) / at.velocity.z; at = sampleAerodynamicPitchStateAtElapsedSeconds(initial, t, air); }
  return { position: at.position, t };
}
/** Spin from break direction (catcher view: 0 up, 90 toward +x), active share and gyro sign, as pitchSpinFromControlsV77. */
const spinOf = (rpm: number, dirDeg: number, active: number, gyroSign: number): V => {
  const w = rpm * RPM, th = dirDeg * Math.PI / 180, t = w * active;
  return { x: t * Math.cos(th), y: -t * Math.sin(th), z: gyroSign * w * Math.sqrt(Math.max(0, 1 - active * active)) };
};
/** Movement in match frame (x, induced y) in inches for a pitch aimed at the target. */
function movement(release: V, speed: number, spin: V) {
  const aimed = aimPitchThroughPointV1(release, target, speed, spin, air, 0).velocity;
  const a = plateAt(release, aimed, spin).position, b = plateAt(release, aimed, { x: 0, y: 0, z: 0 }).position;
  return { x: (a.x - b.x) / IN, y: (a.y - b.y) / IN };
}
export function fitStatcastPitch(input: { throws: 'R' | 'L'; type: string; mph: number; rpm: number; hIn: number; vIn: number; release: V }) {
  const side = input.throws === 'L' ? 1 : -1, want = { x: -side * input.hIn, y: input.vIn }, speed = input.mph * MPH;
  // Right-hander: clockwise from the pitcher = axis toward the plate (-z). Mirroring the hand flips the axial z.
  const gyroSign = (GLOVE_SIDE.has(input.type) ? -1 : 1) * (input.throws === 'L' ? -1 : 1) * (process.env.KBM_GYRO_FLIP === '1' ? -1 : 1), wantMag = Math.hypot(want.x, want.y);
  // Solve on the active spin as a 2D vector u = active * (sin dir, cos dir) (catcher view: x, up) by Newton steps with a
  // numeric Jacobian. The gyro turned into active spin in flight adds movement that does not scale with u, so a plain
  // ratio update stalls on low-movement sliders. |u| is capped at 1 (all spin active); a capped fit keeps its residual.
  const toSpin = (u: { x: number; y: number }) => { const a = Math.min(1, Math.hypot(u.x, u.y));
    return spinOf(input.rpm, Math.atan2(u.x, u.y) * 180 / Math.PI, Math.max(1e-4, a), gyroSign); };
  const err = (g: { x: number; y: number }) => Math.hypot(g.x - want.x, g.y - want.y), cap = (v: { x: number; y: number }) => {
    const m = Math.hypot(v.x, v.y); return m > 1 ? { x: v.x / m, y: v.y / m } : v; };
  // Start with the ratio update (direction by the angle gap, size by the magnitude ratio), then damped Newton steps that
  // are halved until the error falls; the best point seen is kept, so the refinement never ends worse than the start.
  let dir = Math.atan2(want.x, want.y), a = .7, got = { x: 0, y: 0 };
  for (let i = 0; i < 10; i++) {
    got = movement(input.release, speed, toSpin({ x: a * Math.sin(dir), y: a * Math.cos(dir) }));
    if (err(got) < .05) break;
    dir += Math.atan2(want.x, want.y) - Math.atan2(got.x, got.y);
    const gotMag = Math.hypot(got.x, got.y); a = Math.min(1, Math.max(.02, gotMag > 1e-6 ? a * wantMag / gotMag : 1));
  }
  let u = { x: a * Math.sin(dir), y: a * Math.cos(dir) };
  got = movement(input.release, speed, toSpin(u));
  for (let i = 0; i < 10 && err(got) >= .05; i++) {
    const h = .01, gx = movement(input.release, speed, toSpin({ x: u.x + h, y: u.y })), gy = movement(input.release, speed, toSpin({ x: u.x, y: u.y + h }));
    const j11 = (gx.x - got.x) / h, j21 = (gx.y - got.y) / h, j12 = (gy.x - got.x) / h, j22 = (gy.y - got.y) / h, det = j11 * j22 - j12 * j21;
    if (Math.abs(det) < 1e-9) break;
    const ex = want.x - got.x, ey = want.y - got.y, step = { x: (j22 * ex - j12 * ey) / det, y: (-j21 * ex + j11 * ey) / det };
    let accepted = false;
    for (let k = 0, s = 1; k < 6; k++, s /= 2) {
      const trial = cap({ x: u.x + s * step.x, y: u.y + s * step.y }), g = movement(input.release, speed, toSpin(trial));
      if (err(g) < err(got)) { u = trial; got = g; accepted = true; break; }
    }
    if (!accepted) break;
  }
  const active = Math.min(1, Math.hypot(u.x, u.y)), clamped = active >= .999 && err(got) >= .05, spin = toSpin(u);
  got = movement(input.release, speed, spin);
  // Movement-implied axis on Statcast's right-hander clock (180 = backspin): 180 + atan2(arm side, up).
  const armSide = -side * got.x, impliedAxis = (180 + Math.atan2(armSide, got.y) * 180 / Math.PI + 360) % 360;
  return { spin, active, gyroSign, clamped, impliedAxis, movementIn: { arm: armSide, up: got.y },
    residualIn: Math.hypot(got.x - want.x, got.y - want.y) };
}

const [csvPath, outDir, ...flags] = process.argv.slice(2), opt = Object.fromEntries(flags.map(f => f.replace(/^--/, '').split('=')));
if (!csvPath || !outDir) throw Error('usage: statcast-to-v78.ts <csv> <outDir> --standard=YEAR | --pitcher=ID --year=YEAR | --check=YEAR');
mkdirSync(outDir, { recursive: true });
const rows = readCsv(csvPath).filter(r => TYPES[r.pitch_type]);
const zoneRows = opt.zone ? readCsv(opt.zone) : [];
const zoneRateOf = (year: string, type: string, id?: string) => { const r = zoneRows.find(z => z.year === year && z.pitch_type === type && (id === undefined || z.mlbam_id === id));
  return r ? num(r, 'zone_pct') / 100 : undefined; };
const countRows = opt.count ? readCsv(opt.count) : [], COUNTS = ['0-0', '0-1', '0-2', '1-0', '1-1', '1-2', '2-0', '2-1', '2-2', '3-0', '3-1', '3-2'];
const usageByCountOf = (year: string, type: string) => {
  const of = (t: string | null, c: string | null) => countRows.filter(r => r.year === year && (t === null || r.pitch_type === t) && (c === null ? COUNTS.includes(r.count) : r.count === c))
    .reduce((n, r) => n + num(r, 'pitches'), 0);
  const overall = of(type, null) / of(null, null);
  return countRows.length && overall > 0 ? COUNTS.map(c => +Math.min(50, of(type, c) / of(null, c) / overall).toFixed(3)) : undefined; };
const angleGap = (a: number, b: number) => ((a - b + 540) % 360) - 180;

function pitchFrom(r: { throws: 'R' | 'L'; type: string; mph: number; rpm: number; hIn: number; vIn: number; release: V; axis: number }, id: string, source: string, usage: number, zoneRate?: number, usageByCount?: number[]) {
  const fit = fitStatcastPitch(r), [pitchType, name] = TYPES[r.type];
  return { fit, pitch: { pitchId: id, name, pitchType, releaseSpeedMps: r.mph * MPH / .99,
    spinRadPerSecond: { x: +fit.spin.x.toFixed(4), y: +fit.spin.y.toFixed(4), z: +fit.spin.z.toFixed(4) },
    usageWeightV1: +usage.toFixed(2), ...(zoneRate === undefined || !Number.isFinite(zoneRate) ? {} : { zoneRateV1: +zoneRate.toFixed(4) }),
    ...(usageByCount ? { usageByCountV1: usageByCount } : {}), source: { kind: 'original' as const, id: source, revision: 1 } },
    report: { type: r.type, mph: r.mph, rpm: r.rpm, statcastIn: { arm: r.hIn, up: r.vIn }, matchIn: { arm: +fit.movementIn.arm.toFixed(2), up: +fit.movementIn.up.toFixed(2) },
      residualIn: +fit.residualIn.toFixed(2), activeShare: +fit.active.toFixed(3), clamped: fit.clamped,
      statcastAxis: r.axis, impliedAxis: +fit.impliedAxis.toFixed(1), axisGapDeg: Number.isFinite(r.axis) ? +angleGap(r.axis, fit.impliedAxis).toFixed(1) : null } };
}
export const rowInput = (r: Row, throws: 'R' | 'L') => ({ throws, type: r.pitch_type, mph: num(r, 'speed_avg'), rpm: num(r, 'spin_rpm'),
  hIn: num(r, 'hmov_in'), vIn: num(r, 'vmov_in'), axis: num(r, 'spin_axis_norm_deg'),
  release: releaseOf(throws, num(r, 'rel_side_ft'), num(r, 'rel_height_ft'), num(r, 'extension_ft')) });
export const usable = (r: ReturnType<typeof rowInput>) => [r.mph, r.rpm, r.hIn, r.vIn, r.release.x, r.release.y, r.release.z].every(Number.isFinite) && r.rpm > 300;
const physicalOf = (release: V, throws: 'R' | 'L') => ({ pitchReleaseHeightMeters: +(release.y - MOUND_Y).toFixed(4),
  pitchReleaseSideMeters: +Math.abs(release.x).toFixed(4), pitchReleaseExtensionMeters: +(RUBBER_Z - release.z).toFixed(4), throws });

if (opt.standard) {
  // League pitch-weighted means per Statcast type (100+ pitch rows), on the right-hander frame; shares of all pitches.
  const year = opt.standard, throws = (opt.throws ?? 'R') as 'R' | 'L', pool = rows.filter(r => r.year === year && r.sample === 'pitches>=100');
  const total = pool.reduce((n, r) => n + num(r, 'pitches'), 0), byType = new Map<string, Row[]>();
  for (const r of pool) byType.set(r.pitch_type, [...(byType.get(r.pitch_type) ?? []), r]);
  const mean = (list: Row[], k: string) => { let s = 0, n = 0; for (const r of list) { const v = num(r, k), w = num(r, 'pitches'); if (Number.isFinite(v)) { s += v * w; n += w; } } return s / n; };
  const meanAxis = (list: Row[]) => { let c = 0, s = 0; for (const r of list) { const v = num(r, 'spin_axis_norm_deg'), w = num(r, 'pitches'); if (Number.isFinite(v)) { c += w * Math.cos(v * Math.PI / 180); s += w * Math.sin(v * Math.PI / 180); } }
    return (Math.atan2(s, c) * 180 / Math.PI + 360) % 360; };
  const pitches: unknown[] = [], report: unknown[] = [], usage: Record<string, number> = {}, all = pool;
  const leagueRelease = releaseOf(throws, mean(all, 'rel_side_ft'), mean(all, 'rel_height_ft'), mean(all, 'extension_ft'));
  for (const [type, list] of [...byType].sort((a, b) => b[1].length - a[1].length)) {
    const share = list.reduce((n, r) => n + num(r, 'pitches'), 0) / total; if (share < .01) continue;
    const r = { throws, type, mph: mean(list, 'speed_avg'), rpm: mean(list, 'spin_rpm'), hIn: mean(list, 'hmov_in'), vIn: mean(list, 'vmov_in'), axis: meanAxis(list),
      release: releaseOf(throws, mean(list, 'rel_side_ft'), mean(list, 'rel_height_ft'), mean(list, 'extension_ft')) };
    // One release per pitcher in the match: fit at the league release so the pitches share it.
    const made = pitchFrom({ ...r, release: leagueRelease }, `mlb${year}-avg-${throws}-${type}`, `statcast-mlb${year}-avg-${type}`, share * 100, zoneRateOf(year, type), usageByCountOf(year, type));
    pitches.push(made.pitch); usage[`mlb${year}-avg-${throws}-${type}`] = +(share * 100).toFixed(2);
    report.push({ ...made.report, sharePct: +(share * 100).toFixed(2), whiffPctSavant: +mean(list, 'whiff_pct_savant').toFixed(1), rows: list.length });
  }
  const repertoire = { version: 'pitch_repertoire_v78', pitches };
  validatePitchRepertoireV78(repertoire);
  const out = { note: `MLB ${year} pitch-weighted means of rows with 100+ pitches (types under 1% dropped); fitted in LIVE_MATCH_PHYSICS_V1.air, no seam force`,
    pitchRepertoireV78: repertoire, usagePct: usage, physical: physicalOf(leagueRelease, throws), report };
  writeFileSync(`${outDir}/standard-mlb${year}-${throws}.json`, JSON.stringify(out, null, 1));
  console.table(report); console.log('physical', out.physical, 'wrote', `${outDir}/standard-mlb${year}-${throws}.json`);
} else if (opt.pitcher) {
  const list = rows.filter(r => r.mlbam_id === opt.pitcher && r.year === opt.year && r.sample === 'pitches>=100');
  if (!list.length) throw Error('no 100+ pitch rows for that pitcher and year');
  const throws = list[0].throws as 'R' | 'L', w = (k: string) => list.reduce((s, r) => s + num(r, k) * num(r, 'pitches'), 0) / list.reduce((s, r) => s + num(r, 'pitches'), 0);
  const release = releaseOf(throws, w('rel_side_ft'), w('rel_height_ft'), w('extension_ft')), pitches: unknown[] = [], report: unknown[] = [], usage: Record<string, number> = {};
  for (const r of list) { const ri = rowInput(r, throws); if (!usable(ri)) continue;
    const id = `p${opt.pitcher}-${opt.year}-${r.pitch_type}`, made = pitchFrom({ ...ri, release }, id, `statcast-${opt.pitcher}-${opt.year}-${r.pitch_type}`, Math.max(0, num(r, 'usage_pct') || 0), zoneRateOf(opt.year, r.pitch_type, opt.pitcher), usageByCountOf(opt.year, r.pitch_type));
    pitches.push(made.pitch); usage[id] = num(r, 'usage_pct'); report.push({ ...made.report, whiffPctSavant: num(r, 'whiff_pct_savant'), speedP95: num(r, 'speed_p95') }); }
  const repertoire = { version: 'pitch_repertoire_v78', pitches }; validatePitchRepertoireV78(repertoire);
  const out = { pitcher: opt.pitcher, year: opt.year, pitchRepertoireV78: repertoire, usagePct: usage, physical: physicalOf(release, throws), report };
  writeFileSync(`${outDir}/pitcher-${opt.pitcher}-${opt.year}.json`, JSON.stringify(out, null, 1)); console.table(report);
} else if (opt.check) {
  // Every 100+ pitch row of the year, each at its own release: residual and clamp counts per type, axis gap means.
  const pool = rows.filter(r => r.year === opt.check && r.sample === 'pitches>=100'), byType: Record<string, { n: number; res: number[]; clamped: number; gaps: number[]; active: number[] }> = {};
  for (const r of pool) { const ri = rowInput(r, r.throws as 'R' | 'L'); if (!usable(ri)) continue; const made = pitchFrom(ri, 'check', 'check', 1), t = (byType[ri.type] ??= { n: 0, res: [], clamped: 0, gaps: [], active: [] });
    t.n++; t.res.push(made.report.residualIn); if (made.report.clamped) t.clamped++; if (made.report.axisGapDeg !== null) t.gaps.push(made.report.axisGapDeg); t.active.push(made.report.activeShare); }
  const q = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s.length ? +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2) : null; };
  const table = Object.entries(byType).map(([type, t]) => ({ type, rows: t.n, residualP50: q(t.res, .5), residualP90: q(t.res, .9), within1in: +(t.res.filter(x => x <= 1).length / t.n).toFixed(3),
    clamped: t.clamped, activeP50: q(t.active, .5), axisGapMean: t.gaps.length ? +(t.gaps.reduce((a, b) => a + b, 0) / t.gaps.length).toFixed(1) : null }));
  writeFileSync(`${outDir}/check-${opt.check}.json`, JSON.stringify(table, null, 1)); console.table(table);
}
