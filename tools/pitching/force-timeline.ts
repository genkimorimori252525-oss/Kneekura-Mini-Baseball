// Pitch force timeline and late-break study (verification only; changes nothing in the match).
// usage: npx vite-node tools/pitching/force-timeline.ts [outDir]
// For each pitch: gravity, drag, Magnus and seam accelerations over the flight, the spin-induced movement against a
// no-spin twin, how the movement grows in time, and what the match batter forecast (V151) misses at its commit point.
// Pitch inputs are rounded MLB-typical values for a right-hander (hypotheses until the KBM history table is joined).
import { mkdirSync, writeFileSync } from 'node:fs';
import { LIVE_MATCH_PHYSICS_V1 } from '../../src/integration/browser/LiveBaseballMatchV1';
import { calculateBaseballAerodynamics, type BaseballAerodynamicsParameters } from '../../src/core/sim/ball/BaseballAerodynamics';
import { calculateBaseballSpinDecayDerivative } from '../../src/core/sim/ball/BaseballSpinDecay';
import { advanceBaseballOrientation, type Quaternion } from '../../src/core/sim/pitching/BaseballOrientation';
import { sampleAerodynamicPitchStateAtElapsedSeconds } from '../../src/core/sim/pitching/AerodynamicPitchTrajectory';
import { forecastObservedPitchV151 } from '../../src/core/decision/batting/ObservedPitchForecastV151';
import { pitchSpinFromControlsV77 } from '../../src/integration/browser/LivePitchAuthoringV77';
import { meetLateLookV1 } from '../../src/integration/browser/LiveBatterObservationV151';

type V = { x: number; y: number; z: number };
const add = (a: V, b: V): V => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }), sc = (a: V, k: number): V => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const sub = (a: V, b: V) => add(a, sc(b, -1)), dot = (a: V, b: V) => a.x * b.x + a.y * b.y + a.z * b.z, len = (a: V) => Math.hypot(a.x, a.y, a.z);
const MPH = .44704, IN = .0254, RPM = 2 * Math.PI / 60;
const air = LIVE_MATCH_PHYSICS_V1.air, g = air.gravityY, PLATE = .4318, DT = .001;
const release: V = { x: -.55, y: 1.8, z: 18.44 - 1.9 };
const target: V = { x: 0, y: .75, z: PLATE };

type Pitch = { id: string; mph: number; rpm: number; dir: number; gyro: number; seam?: boolean; q?: Quaternion };
// dir: catcher view, 0 = pure backspin lift (up), 90 = toward +x (1B side, glove side for a RHP). gyro = spin.z / |spin|.
const PITCHES: Pitch[] = [
  { id: 'FF', mph: 94, rpm: 2300, dir: -35, gyro: .1 },
  { id: 'SI', mph: 93, rpm: 2150, dir: -60, gyro: .1 },
  { id: 'FC', mph: 89, rpm: 2400, dir: 30, gyro: .85 },
  { id: 'SL', mph: 85, rpm: 2450, dir: 120, gyro: .9 },
  { id: 'SLneg', mph: 85, rpm: 2450, dir: 120, gyro: -.9 },
  { id: 'ST', mph: 82, rpm: 2600, dir: 95, gyro: .6 },
  { id: 'CU', mph: 79, rpm: 2550, dir: 160, gyro: .6 },
  { id: 'CH', mph: 85.5, rpm: 1750, dir: -60, gyro: .5 },
  { id: 'FS', mph: 86, rpm: 1450, dir: -50, gyro: .7 },
  // Seam model on (authored, uncalibrated): same pitches with the release orientations the V78 presets use.
  { id: 'SIseam', mph: 93, rpm: 2150, dir: -60, gyro: .1, seam: true, q: { w: .9238795325112867, x: 0, y: 0, z: .3826834323650898 } },
  { id: 'SLseam', mph: 85, rpm: 2450, dir: 120, gyro: .9, seam: true, q: { w: 1, x: 0, y: 0, z: 0 } },
  { id: 'FSseam', mph: 86, rpm: 1450, dir: -50, gyro: .7, seam: true, q: { w: 1, x: 0, y: 0, z: 0 } },
];

type Sample = { t: number; p: V; v: V; w: V; q?: Quaternion; grav: V; drag: V; lift: V; seam: V; activeRpm: number };
function deriv(v: V, w: V, a: BaseballAerodynamicsParameters, q?: Quaternion) {
  const s = calculateBaseballAerodynamics(v, w, a, q);
  return { s, acc: { x: s.totalAcceleration.x, y: s.totalAcceleration.y + g, z: s.totalAcceleration.z },
    dw: a.spinDecay ? calculateBaseballSpinDecayDerivative(w, sub(v, a.windVelocityMps), a.spinDecay) : { x: 0, y: 0, z: 0 } };
}
// Same RK4 graph as the engine (positions from stage velocities, orientation advanced by stage spins).
function fly(p0: V, v0: V, w0: V, a: BaseballAerodynamicsParameters, q0?: Quaternion, untilZ = -.85): Sample[] {
  const out: Sample[] = []; let p = p0, v = v0, w = w0, q = q0, t = 0;
  for (;;) {
    const d1 = deriv(v, w, a, q), s = d1.s;
    out.push({ t, p, v, w, q, grav: { x: 0, y: g, z: 0 }, drag: s.dragAcceleration, lift: s.liftAcceleration,
      seam: s.seamAcceleration ?? { x: 0, y: 0, z: 0 }, activeRpm: len(s.activeSpin) / RPM });
    if (p.z <= untilZ || t > 2.5) return out;
    const v2 = add(v, sc(d1.acc, DT / 2)), w2 = add(w, sc(d1.dw, DT / 2)), q2 = q && advanceBaseballOrientation(q, w, DT / 2), d2 = deriv(v2, w2, a, q2);
    const v3 = add(v, sc(d2.acc, DT / 2)), w3 = add(w, sc(d2.dw, DT / 2)), q3 = q && advanceBaseballOrientation(q, w2, DT / 2), d3 = deriv(v3, w3, a, q3);
    const v4 = add(v, sc(d3.acc, DT)), w4 = add(w, sc(d3.dw, DT)), q4 = q && advanceBaseballOrientation(q, w3, DT), d4 = deriv(v4, w4, a, q4);
    const ws = (A: V, B: V, C: V, D: V) => sc(add(add(A, sc(B, 2)), add(sc(C, 2), D)), DT / 6);
    p = add(p, ws(v, v2, v3, v4)); const vn = add(v, ws(d1.acc, d2.acc, d3.acc, d4.acc));
    q = q && advanceBaseballOrientation(q, sc(add(add(w, w2), add(w3, w4)), .25), DT);
    w = add(w, ws(d1.dw, d2.dw, d3.dw, d4.dw)); v = vn; t += DT;
  }
}
const at = (path: Sample[], t: number) => { const i = Math.min(path.length - 2, Math.floor(t / DT)), f = (t - path[i].t) / DT;
  return add(path[i].p, sc(sub(path[i + 1].p, path[i].p), f)); };
const crossT = (path: Sample[], z = PLATE) => { for (let i = 1; i < path.length; i++) if (path[i].p.z <= z) {
  const a = path[i - 1], b = path[i]; return a.t + (a.p.z - z) / (a.p.z - b.p.z) * DT; } return NaN; };
// Aim like the match inverse solver: correct the release velocity until the plate crossing hits the target.
function aim(spd: number, w: V, a: BaseballAerodynamicsParameters, tgt: V, q?: Quaternion, z = PLATE) {
  const T0 = (release.z - tgt.z) / spd; let v: V = { x: (tgt.x - release.x) / T0, y: (tgt.y - release.y - g * T0 * T0 / 2) / T0, z: 0 };
  v.z = -Math.sqrt(spd * spd - v.x * v.x - v.y * v.y);
  for (let i = 0; i < 6; i++) { const path = fly(release, v, w, a, q, z - .05), T = crossT(path, z), hit = at(path, T);
    v = { x: v.x + (tgt.x - hit.x) / T, y: v.y + (tgt.y - hit.y) / T, z: 0 }; v.z = -Math.sqrt(spd * spd - v.x * v.x - v.y * v.y); }
  return v;
}
const seamAero = (on: boolean): BaseballAerodynamicsParameters => on
  ? { ...air.aerodynamics, seamForce: { version: 'baseball_seam_force_v1', coefficientScale: 1 } } : air.aerodynamics;
const noSpin = { x: 0, y: 0, z: 0 };

// Match batter (cfg-mlbstd16): positions every 20 ms, no latency, commit from 0.14 s once t + 0.26 + 0.08 >= forecast arrival.
const TPS = 1_000_000, SAMPLE = .02, FIRST = .14, LEAD = .26 + .08;
function forecast(pos: (t: number) => V, cutoff: number) {
  const observations = []; for (let k = 1; k * SAMPLE <= cutoff + 1e-9; k++) { const tick = Math.round(k * SAMPLE * TPS);
    observations.push({ observationId: 'o' + tick, observedTick: tick, availableTick: tick, position: pos(k * SAMPLE) }); }
  return forecastObservedPitchV151({ originTick: 0, ticksPerSecond: TPS, cutoffTick: Math.round(cutoff * TPS), planeZ: PLATE,
    maximumAfterReleaseSeconds: 2.5, observations });
}
function commit(pos: (t: number) => V) {
  for (let t = FIRST; t < 1; t += SAMPLE) { const f = forecast(pos, t); if (!f.prediction || t + LEAD >= f.prediction.arrivalAfterReleaseSeconds) return { t, f }; }
  return { t: NaN, f: null };
}
// A batter who reads position and velocity but not acceleration (only gravity known): the unseen part of the break.
function velocityOnlyMiss(pos: (t: number) => V, tc: number, T: number, truth: V) {
  const p1 = pos(tc - SAMPLE), p2 = pos(tc), v = sc(sub(p2, p1), 1 / SAMPLE), dt = (PLATE - p2.z) / v.z;
  return { x: (p2.x + v.x * dt - truth.x) / IN, y: (p2.y + v.y * dt + .5 * g * dt * dt - truth.y) / IN, T };
}

const outDir = process.argv[2] ?? 'work/pitching/force-timeline';
mkdirSync(outDir, { recursive: true });
const rows: Record<string, unknown>[] = [], series: Record<string, unknown> = {};
for (const P of PITCHES) {
  const w = pitchSpinFromControlsV77({ spinRpm: P.rpm, breakDirectionDegrees: P.dir, gyroFraction: P.gyro });
  const a = seamAero(!!P.seam), v0 = aim(P.mph * MPH, w, a, target, P.q), path = fly(release, v0, w, a, P.q), T = crossT(path), hit = at(path, T);
  const twin = fly(release, v0, noSpin, a, P.q), mv = (t: number) => sub(at(path, t), at(twin, t));
  const plateMv = mv(T), m = Math.hypot(plateMv.x, plateMv.y), dirU = sc(plateMv, 1 / m), along = (t: number) => dot(mv(t), dirU);
  // Engine check: the match kernel's own integrator at the same elapsed time.
  const eng = sampleAerodynamicPitchStateAtElapsedSeconds({ tick: 0, position: release, velocity: v0, spin: w }, T, { ...air, aerodynamics: a } as never, P.q);
  const share = (f: number) => along(f * T) / m, fit = Math.log(share(.5)) / Math.log(.5);
  const pos = (t: number) => at(path, t), c = commit(pos), pred = c.f?.prediction?.position;
  const miss151 = pred ? { x: (pred.x - hit.x) / IN, y: (pred.y - hit.y) / IN } : null, vmiss = velocityOnlyMiss(pos, c.t, T, hit);
  const i0 = 0, iT = Math.floor(T / DT), lift0 = len(path[i0].lift), liftT = len(path[iT].lift);
  const third = (lo: number, hi: number) => { const pick = path.filter(x => x.t >= lo * T && x.t <= hi * T); return pick.reduce((n, x) => n + len(x.seam), 0) / pick.length; };
  const row = { id: P.id, seamEarly: +third(0, 1 / 3).toFixed(3), seamLate: +third(2 / 3, 1).toFixed(3), mph: P.mph, rpm: P.rpm, gyro: P.gyro, flightS: +T.toFixed(4), plateSpeedMph: +(len(path[iT].v) / MPH).toFixed(1),
    engineDiffMm: +(len(sub(eng.position, hit)) * 1000).toFixed(3),
    moveXin: +(plateMv.x / IN).toFixed(1), moveYin: +(plateMv.y / IN).toFixed(1), moveIn: +(m / IN).toFixed(1),
    shareAtHalf: +share(.5).toFixed(3), shareLast20: +(1 - share(.8)).toFixed(3), exponent: +fit.toFixed(3),
    activeRpm0: +path[i0].activeRpm.toFixed(0), activeRpmT: +path[iT].activeRpm.toFixed(0),
    magnus0: +lift0.toFixed(2), magnusT: +liftT.toFixed(2), magnusRatio: +(liftT / lift0).toFixed(3),
    dragDecelPct: +((1 - len(path[iT].v) / len(path[0].v)) * 100).toFixed(1),
    commitS: +c.t.toFixed(2), visibleBefore: +(along(c.t) / m).toFixed(3),
    v151MissIn: miss151 && { x: +miss151.x.toFixed(2), y: +miss151.y.toFixed(2) }, velocityOnlyMissIn: { x: +vmiss.x.toFixed(1), y: +vmiss.y.toFixed(1) } };
  rows.push(row);
  series[P.id] = path.filter((_, i) => i % 10 === 0 && _.t <= T).map(s => ({ t: +s.t.toFixed(3), z: +s.p.z.toFixed(3),
    grav: s.grav.y, drag: [s.drag.x, s.drag.y, s.drag.z].map(n => +n.toFixed(3)), magnus: [s.lift.x, s.lift.y, s.lift.z].map(n => +n.toFixed(3)),
    seam: [s.seam.x, s.seam.y, s.seam.z].map(n => +n.toFixed(3)), activeRpm: +s.activeRpm.toFixed(0), moveIn: +(along(s.t) / IN).toFixed(2) }));
}
console.table(rows.map(r => ({ ...r, v151MissIn: JSON.stringify(r.v151MissIn), velocityOnlyMissIn: JSON.stringify(r.velocityOnlyMissIn) })));

// Ideal shapes through the same observer: x = B s^2 and x = B s^3 (s = t/T), same 15 in at the plate, on a 94 mph straight line.
const ff = rows[0] as { flightS: number }, Tff = ff.flightS, B = 15 * IN, ideal: Record<string, unknown>[] = [];
for (const [name, n] of [['s2', 2], ['s3', 3]] as const) {
  const vz = -(release.z - PLATE) / Tff, pos = (t: number): V => ({ x: B * (t / Tff) ** n, y: 1, z: release.z + vz * t });
  const c = commit(pos), pr = c.f?.prediction?.position;
  ideal.push({ shape: name, commitS: +c.t.toFixed(2), visibleBefore: +((c.t / Tff) ** n).toFixed(3), v151MissIn: pr ? +((pr.x - B) / IN).toFixed(2) : null });
}
console.table(ideal);

// Tunnels: each pitch aimed so that it passes the fastball's point at the tunnel plane (7.25 m before the plate),
// against the same release point. Report the plate split and the release-direction change it needs.
const ffw = pitchSpinFromControlsV77({ spinRpm: 2300, breakDirectionDegrees: -35, gyroFraction: .1 });
const ffv = aim(94 * MPH, ffw, air.aerodynamics, target), ffPath = fly(release, ffv, ffw, air.aerodynamics), tunnelZ = PLATE + 7.25;
const ffTun = at(ffPath, crossT(ffPath, tunnelZ)), ffHit = at(ffPath, crossT(ffPath)), tunnels: Record<string, unknown>[] = [];
for (const P of PITCHES.slice(1)) {
  const w = pitchSpinFromControlsV77({ spinRpm: P.rpm, breakDirectionDegrees: P.dir, gyroFraction: P.gyro });
  const v = aim(P.mph * MPH, w, air.aerodynamics, ffTun, undefined, tunnelZ), path = fly(release, v, w, air.aerodynamics);
  const hit = at(path, crossT(path)), dAng = Math.acos(Math.min(1, dot(v, ffv) / len(v) / len(ffv))) * 180 / Math.PI;
  // Largest gap before the tunnel plane (the "tube" width), on matching depth.
  let tube = 0; for (let z = release.z - .5; z > tunnelZ; z -= .25) tube = Math.max(tube, len(sub(at(path, crossT(path, z)), at(ffPath, crossT(ffPath, z)))));
  const sameTarget = fly(release, aim(P.mph * MPH, w, air.aerodynamics, target), w, air.aerodynamics);
  tunnels.push({ id: P.id, plateSplitXin: +((hit.x - ffHit.x) / IN).toFixed(1), plateSplitYin: +((hit.y - ffHit.y) / IN).toFixed(1),
    plateHeightM: +hit.y.toFixed(2), plateXm: +hit.x.toFixed(2), tubeIn: +(tube / IN).toFixed(1), releaseAngleDiffDeg: +dAng.toFixed(2),
    sameTargetGapAtTunnelIn: +(len(sub(at(sameTarget, crossT(sameTarget, tunnelZ)), ffTun)) / IN).toFixed(1),
    arrivalGapS: +(crossT(path) - crossT(ffPath)).toFixed(3) });
}
console.table(tunnels);

// accelerationPriorWeightV1 as committed in f3066bb4 (LivePitchV1, calibration desk), restated here with the real V151:
// the V151 forecast at commit is moved by 0.5 (1 - w) (a_fastball - a_seen) dt^2 in x and y, dt from the last look to the
// forecast arrival; a_fastball is the mean acceleration over that span of the pitcher's fastball flown from the same release
// and direction at 0.99 of its speed with its spin, under the mean (no seam) air. Arrival time is unchanged.
// Late look (meetLateLookV1 [.0045,.014,.85,.3]): the real path is re-read later and at most `headroom` of the miss is taken back.
const inZone = (p: V) => Math.abs(p.x) <= .2159 + .0366 && p.y >= .46 && p.y <= 1.07, WEIGHTS = [1, .6, .3, 0];
const lateFor = { avg: meetLateLookV1(.013, [.0045, .014, .85, .3]), best: meetLateLookV1(.0045, [.0045, .014, .85, .3]) };
function perceived(pos: (t: number) => V, v0: V) {
  const c = commit(pos), f = c.f!, pr = f.prediction!, t1 = f.observedThroughTick! / TPS, t2 = pr.arrivalAfterReleaseSeconds, dt = t2 - t1;
  const start = { tick: 0, position: release, velocity: sc(v0, 94 * MPH * .99 / len(v0)), spin: ffw };
  const s1 = sampleAerodynamicPitchStateAtElapsedSeconds(start, t1, air as never), s2 = sampleAerodynamicPitchStateAtElapsedSeconds(start, t2, air as never);
  const ex = 2 * (s2.position.x - s1.position.x - s1.velocity.x * dt) / (dt * dt), ey = 2 * (s2.position.y - s1.position.y - s1.velocity.y * dt) / (dt * dt);
  return (w: number) => { const k = .5 * (1 - w) * dt * dt; return { x: pr.position.x + k * (ex - pr.estimatedAcceleration.x), y: pr.position.y + k * (ey - pr.estimatedAcceleration.y), z: PLATE }; };
}
const blend: Record<string, unknown>[] = [];
const record = (id: string, mode: string, pos: (t: number) => V, v0: V, hit: V) => {
  const at151 = perceived(pos, v0), row: Record<string, unknown> = { id, mode, actualIn: `${(hit.x / IN).toFixed(1)},${(hit.y / IN).toFixed(1)}`, actualInZone: inZone(hit) };
  for (const wt of WEIGHTS) { const pr = at151(wt), miss = Math.hypot(pr.x - hit.x, pr.y - hit.y) / IN;
    row['miss_w' + wt] = +miss.toFixed(1); row['zone_w' + wt] = inZone(pr); }
  const m0 = row.miss_w0 as number; row.afterLateAvg_w0 = +(m0 * (1 - lateFor.avg)).toFixed(1); row.afterLateBest_w0 = +(m0 * (1 - lateFor.best)).toFixed(1);
  blend.push(row); cases.push({ id, mode, pos, v0, hit });
};
const cases: { id: string; mode: string; pos: (t: number) => V; v0: V; hit: V }[] = [];
for (const P of PITCHES.filter(p => !p.seam)) {
  const w = pitchSpinFromControlsV77({ spinRpm: P.rpm, breakDirectionDegrees: P.dir, gyroFraction: P.gyro });
  for (const mode of ['target', 'tunnel'] as const) {
    if (mode === 'tunnel' && P.id === 'FF') continue;
    const v = mode === 'target' ? aim(P.mph * MPH, w, air.aerodynamics, target) : aim(P.mph * MPH, w, air.aerodynamics, ffTun, undefined, tunnelZ);
    const path = fly(release, v, w, air.aerodynamics);
    record(P.id, mode, t => at(path, t), v, at(path, crossT(path)));
  }
}
// Ideal shapes on the fastball: its physical path plus x = B s^n (s = t / T), 15 in at the plate.
const Tf = crossT(ffPath);
for (const n of [2, 3]) { const pos = (t: number) => add(at(ffPath, t), { x: B * (t / Tf) ** n, y: 0, z: 0 });
  record('FF+s' + n, 'target', pos, ffv, pos(Tf)); }
console.table(blend);
console.log('late-look headroom', lateFor);

// e26eb913: the same bend on the later look too, and accelerationViewTimeV1 = tau makes w = look / (look + tau), the look
// being release to the last sample. The later look is read at decision + (arrival - decision) * headroom / 2 and the bat
// takes at most `headroom` of (later forecast - placement); the speed budget is not modelled, so the take-back is an upper bound.
function bentAt(pos: (t: number) => V, v0: V, cutoff: number, tau: number) {
  const f = forecast(pos, cutoff), pr = f.prediction!, t1 = f.observedThroughTick! / TPS, t2 = pr.arrivalAfterReleaseSeconds, dt = t2 - t1, w = t1 / (t1 + tau);
  if (!(dt > .005)) return { p: pr.position as V, w, t1, t2 };
  const start = { tick: 0, position: release, velocity: sc(v0, 94 * MPH * .99 / len(v0)), spin: ffw };
  const s1 = sampleAerodynamicPitchStateAtElapsedSeconds(start, t1, air as never), s2 = sampleAerodynamicPitchStateAtElapsedSeconds(start, t2, air as never);
  const ex = 2 * (s2.position.x - s1.position.x - s1.velocity.x * dt) / (dt * dt), ey = 2 * (s2.position.y - s1.position.y - s1.velocity.y * dt) / (dt * dt), k = .5 * (1 - w) * dt * dt;
  return { p: { x: pr.position.x + k * (ex - pr.estimatedAcceleration.x), y: pr.position.y + k * (ey - pr.estimatedAcceleration.y), z: PLATE }, w, t1, t2 };
}
const miss = (p: V, hit: V) => +(Math.hypot(p.x - hit.x, p.y - hit.y) / IN).toFixed(1), viewTime: Record<string, unknown>[] = [];
for (const tau of [.15, .3]) for (const c of cases) {
  const tc = commit(c.pos).t, d = bentAt(c.pos, c.v0, tc, tau), row: Record<string, unknown> = { tau, id: c.id, mode: c.mode,
    wDecision: +d.w.toFixed(2), missDecision: miss(d.p, c.hit), zoneDecision: inZone(d.p), actualInZone: inZone(c.hit) };
  for (const [who, h] of Object.entries(lateFor)) {
    const late = bentAt(c.pos, c.v0, tc + (d.t2 - tc) * h / 2, tau), final = add(d.p, sc(sub(late.p, d.p), h));
    row['wLate_' + who] = +late.w.toFixed(2); row['missLate_' + who] = miss(late.p, c.hit); row['missAfterBat_' + who] = miss(final, c.hit);
  }
  viewTime.push(row);
}
console.table(viewTime);
writeFileSync(outDir + '/summary.json', JSON.stringify({ physics: 'LIVE_MATCH_PHYSICS_V1.air', release, target, rows, ideal, tunnels, blend, viewTime }, null, 1));
writeFileSync(outDir + '/series.json', JSON.stringify(series));
console.log('wrote', outDir);
